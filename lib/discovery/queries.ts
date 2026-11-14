import { query, queryOne } from "@/lib/db";
import { displayCounty } from "@/lib/contractors/county-display";
import { asLicenseStatus } from "@/lib/contractors/format";
import type { SearchResult } from "@/lib/contractors/types";
import { getStateBySlug } from "@/lib/states/config";
import { PUBLIC_REGULATORY_SQL } from "@/lib/regulatory/publication";
import {
  getCounty,
  getDiscoveryState,
  getTrade,
} from "./config";
import type { CountyDef, DiscoveryFacet, TradeDef } from "./types";
import {
  DISCOVERY_COUNTY_EXPR,
  floridaCountyCodePredicates,
  resolvedFloridaCountySql,
} from "./florida-county-sql";

const FACET_COUNTY_SQL = resolvedFloridaCountySql(DISCOVERY_COUNTY_EXPR);

function countyFacetCount(county: CountyDef, byKey: Map<string, number>): number {
  let count = 0;
  for (const name of [...county.matchNames, ...(county.matchCodes ?? [])]) {
    const key = name.toLowerCase().replace(/\s+/g, " ").trim();
    count = Math.max(
      count,
      byKey.get(key) || 0,
      byKey.get(key.replace(/\s+/g, "-")) || 0,
      byKey.get(key.replace(/-/g, " ")) || 0,
    );
  }
  return count;
}

const MIN_SUNBIZ_CONFIDENCE = 0.9;
export const DISCOVERY_PAGE_SIZE = 24;

/**
 * States with requireInStateAddress === false (Oregon) never referenced $2, but
 * $2 (state code) is always bound. Postgres then rejects the statement with
 * "could not determine data type of parameter $2", so every such read failed
 * and the empty fallback hid it (SEO-PATTERN-002 B1 guard). Reference $2 with an
 * explicit type in a predicate that is always true for a bound state code.
 */
const STATE_PARAM_TYPED_SQL = "AND $2::text IS NOT NULL";

function inStateSql(requireInState: boolean | undefined): string {
  return requireInState === false ? STATE_PARAM_TYPED_SQL : "AND (c.home_state = $2 OR l.state = $2)";
}

/**
 * SEO-PATTERN-002 Oregon dedupe. The Oregon loader writes one contractor
 * profile per (CCB license number, endorsement) (external_key
 * OR-CCB:<number>:<code>), so one licensee can have 2-4 profiles.
 *
 * Directory identity, for states with dedupeByLicenseNumber:
 * - A blank or whitespace-only license number is missing identity. The
 *   profile stays alone (`profile:<id>`). It is never a shared key, so
 *   unrelated blank rows cannot merge or cross-link.
 * - The number is qualified by its credential series. or_ccb carries more
 *   than one number space: CCB contractor licenses (all CCB endorsement
 *   codes), Oregon Certified Home Inspector certificates (OCHI, 1-4 digits)
 *   and Oregon Certified Locksmith certificates (OCLS, 8 digits). An OCHI
 *   certificate that equals a CCB license number is a different credential
 *   holder (C3 FAIL at c84ff65: 9 such numbers on Production).
 * - The number is the stored value, compared exactly (the loader strips it).
 *   A whitespace-variant number is never merged with the stripped one, and
 *   the related/discipline lookups use the same exact value, so identity and
 *   evidence lookups can never disagree (no lost chips) and stay on
 *   licenses_license_number_idx.
 * - A present series+number plus the normalized legal name is one business.
 *   Endorsements of that same legal name stay one card. The same number on
 *   a different legal name stays a different card. A present number with no
 *   legal name stays on its own profile id, so it cannot attach to a named
 *   business that happens to reuse the number. The name only ever splits;
 *   two different license numbers stay two entries even when the legal name
 *   matches. Other states keep c.id (byte-identical SQL).
 */
function normalizedLegalNameSql(contractorAlias: string): string {
  return `NULLIF(lower(regexp_replace(TRIM(COALESCE(${contractorAlias}.legal_name, '')), '[[:space:]]+', ' ', 'g')), '')`;
}

/** Credential series inside or_ccb. Every non-certificate code is a CCB license endorsement. */
export const OREGON_CERTIFICATE_SERIES = ["OCHI", "OCLS"] as const;

function licenseSeriesSql(licenseAlias: string): string {
  const code = `UPPER(TRIM(COALESCE(${licenseAlias}.occupation_code, '')))`;
  const list = OREGON_CERTIFICATE_SERIES.map((c) => `'${c}'`).join(", ");
  return `CASE WHEN ${code} IN (${list}) THEN ${code} ELSE 'CCB' END`;
}

/** The stored license number when it is present, else NULL (blank = no identity). */
export function licenseNumberKeySql(licenseAlias = "l"): string {
  return `CASE WHEN NULLIF(TRIM(${licenseAlias}.license_number), '') IS NULL THEN NULL ELSE ${licenseAlias}.license_number END`;
}

export function licenseIdentitySql(licenseAlias = "l", contractorAlias = "c"): string {
  const blank = `NULLIF(TRIM(${licenseAlias}.license_number), '')`;
  const profile = `'profile:' || ${contractorAlias}.id::text`;
  const entity = `COALESCE(${normalizedLegalNameSql(contractorAlias)}, ${profile})`;
  return `CASE WHEN ${blank} IS NULL THEN ${profile} ELSE ${licenseSeriesSql(licenseAlias)} || ':' || ${licenseAlias}.license_number || chr(31) || ${entity} END`;
}

export const LICENSE_IDENTITY_SQL = licenseIdentitySql();

export function directoryIdentitySql(
  disc: { dedupeByLicenseNumber?: boolean } | null | undefined
): string {
  return disc?.dedupeByLicenseNumber ? LICENSE_IDENTITY_SQL : "c.id";
}

function mapRow(r: {
  id: string;
  slug: string;
  display_name: string;
  legal_name: string | null;
  dba_name: string | null;
  primary_city: string | null;
  primary_county: string | null;
  home_state: string | null;
  external_key: string | null;
  occupation_code: string | null;
  status_normalized: string | null;
  last_verified_at: Date | null;
  entity_status: string | null;
  entity_name: string | null;
  has_discipline: boolean;
  source_system?: string | null;
  secondary_status?: string | null;
}): SearchResult {
  return {
    id: r.id,
    slug: r.slug,
    displayName: r.display_name,
    legalName: r.legal_name,
    dbaName: r.dba_name,
    city: r.primary_city,
    county: displayCounty(r.primary_county, r.home_state),
    state: r.home_state,
    primaryLicenseKey: r.external_key,
    occupationCode: r.occupation_code,
    licenseStatus: asLicenseStatus(r.status_normalized),
    entityStatus: r.entity_status,
    entityName: r.entity_name,
    hasDiscipline: r.has_discipline,
    lastVerifiedAt: r.last_verified_at ? r.last_verified_at.toISOString() : null,
    sourceSystem: r.source_system || null,
    secondaryStatus: r.secondary_status || null,
  };
}

/**
 * Build WHERE clause + params for discovery filters.
 * Param $1 = licenseSource, $2 = state code. Additional filters append from $3.
 */
function tradeHasExtraFilters(trade?: TradeDef | null): boolean {
  return Boolean(trade?.classCodes?.length || trade?.descriptionIncludes?.length);
}

export function buildFilterClause(opts: {
  licenseSource: string;
  stateCode: string;
  occupationCodes?: string[] | null;
  classCodes?: string[] | null;
  descriptionIncludes?: string[] | null;
  county?: CountyDef | null;
  activeOnly?: boolean;
  requireInStateAddress?: boolean;
}): { where: string; params: unknown[] } {
  const params: unknown[] = [opts.licenseSource, opts.stateCode];
  let where = `
    l.source_system = $1
    AND c.is_thin_profile = FALSE
  `;
  if (opts.requireInStateAddress !== false) {
    where += ` AND (c.home_state = $2 OR l.state = $2)`;
  } else {
    where += ` ${STATE_PARAM_TYPED_SQL}`;
  }

  if (opts.activeOnly) {
    where += ` AND l.status_normalized IN ('active', 'current')`;
  }

  if (opts.occupationCodes?.length) {
    // FL-DIR-PERF-002: compare the column directly so the planner can use
    // licenses_occupation_source_idx (source_system, occupation_code) as an
    // Index Cond with real row estimates. Wrapping the column in UPPER() was
    // non-sargable (every source row read, ~435-row default estimate).
    // Equivalent: every loader writes occupation_code.upper(), and Production
    // has 0 non-uppercase / untrimmed / NULL codes for fl_dbpr, az_roc, or_ccb
    // and wa_lni (the only sources reaching this clause). The bind values stay
    // uppercased here, matching countCountiesForTrade.
    params.push(opts.occupationCodes.map((c) => c.toUpperCase()));
    where += ` AND l.occupation_code = ANY($${params.length}::text[])`;
  }

  const classCodes = (opts.classCodes || []).map((c) => c.toUpperCase().trim()).filter(Boolean);
  const descParts = (opts.descriptionIncludes || []).map((s) => s.trim()).filter(Boolean);
  if (classCodes.length || descParts.length) {
    const specialty: string[] = [];
    if (classCodes.length) {
      params.push(classCodes);
      specialty.push(
        `UPPER(TRIM(COALESCE(l.class_code, ''))) = ANY($${params.length}::text[])`
      );
    }
    if (descParts.length) {
      params.push(descParts.map((s) => `%${s.toLowerCase()}%`));
      specialty.push(
        `LOWER(COALESCE(l.occupation_description, '')) LIKE ANY($${params.length}::text[])`
      );
    }
    where += ` AND (${specialty.join(" OR ")})`;
  }

  if (opts.county?.matchOutOfStateMailing) {
    where += ` AND UPPER(TRIM(COALESCE(l.state, ''))) <> UPPER($2)`;
  } else if (opts.county) {
    const states = (opts.county.matchStates || [])
      .map((s) => s.toUpperCase().trim())
      .filter(Boolean);
    if (states.length) {
      params.push(states);
      where += ` AND UPPER(TRIM(COALESCE(l.state, ''))) = ANY($${params.length}::text[])`;
    }
    const clauses: string[] = [];
    const cities = (opts.county.matchCities || []).map((c) => c.toLowerCase().trim()).filter(Boolean);
    if (cities.length > 0) {
      params.push(cities);
      const i = params.length;
      clauses.push(`LOWER(TRIM(COALESCE(l.city, ''))) = ANY($${i}::text[])`);
      clauses.push(`LOWER(TRIM(COALESCE(c.primary_city, ''))) = ANY($${i}::text[])`);
    }
    const zips = (opts.county.matchPostalPrefixes || [])
      .map((z) => z.replace(/\D/g, "").slice(0, 5))
      .filter((z) => z.length === 5);
    if (zips.length > 0) {
      params.push(zips);
      clauses.push(
        `LEFT(REGEXP_REPLACE(COALESCE(l.postal_code, ''), '[^0-9]', '', 'g'), 5) = ANY($${params.length}::text[])`
      );
    }
    for (const name of opts.county.matchNames) {
      params.push(name.toLowerCase());
      const i = params.length;
      clauses.push(`LOWER(TRIM(COALESCE(l.county_name, ''))) = $${i}`);
      clauses.push(`LOWER(TRIM(COALESCE(c.primary_county, ''))) = $${i}`);
      clauses.push(
        `LOWER(REPLACE(TRIM(COALESCE(l.county_name, '')), ' ', '-')) = REPLACE($${i}, ' ', '-')`
      );
      clauses.push(
        `LOWER(REPLACE(TRIM(COALESCE(c.primary_county, '')), ' ', '-')) = REPLACE($${i}, ' ', '-')`
      );
    }
    // Match a bare DBPR code on the license or on contractors.primary_county.
    clauses.push(...floridaCountyCodePredicates(params, opts.county.matchCodes || []));
    if (clauses.length) {
      where += ` AND (${clauses.join(" OR ")})`;
    }
  }

  return { where, params };
}

async function countDistinctForTrade(
  disc: NonNullable<ReturnType<typeof getDiscoveryState>>,
  state: NonNullable<ReturnType<typeof getStateBySlug>>,
  trade: TradeDef,
  county?: CountyDef | null
): Promise<number> {
  const { where, params } = buildFilterClause({
    licenseSource: state.licenseSource,
    stateCode: state.code,
    occupationCodes: trade.occupationCodes,
    classCodes: trade.classCodes,
    descriptionIncludes: trade.descriptionIncludes,
    county: county ?? null,
    activeOnly: Boolean(disc.activeOnlyDefault),
    requireInStateAddress: disc.requireInStateAddress,
  });
  const row = await queryOne<{ n: string }>(
    `
    SELECT COUNT(DISTINCT ${directoryIdentitySql(disc)})::text AS n
    FROM contractors c
    JOIN licenses l ON l.contractor_id = c.id
    WHERE ${where}
    `,
    params
  );
  return Number(row?.n || 0);
}

/**
 * SEO-PATTERN-002 B1 guard: a discovery directory read failed (statement
 * timeout, pool/connect timeout, SQL error). It is NOT an empty directory.
 * Only callers that opt in with `strict` receive it; they let it propagate so
 * the response is a non-200 error (noindex) instead of an indexable
 * "No active licenses found" page. Non-strict callers keep the old
 * empty-on-failure behavior unchanged. Mirrors FloridaDirectoryUnavailableError
 * (FL-DIR-PERF-001, lib/discovery/florida-list.ts).
 */
export class DiscoveryDirectoryUnavailableError extends Error {
  readonly op: string;
  constructor(op: string, cause: unknown) {
    super(`${op} failed: directory data unavailable`, { cause });
    this.name = "DiscoveryDirectoryUnavailableError";
    this.op = op;
  }
}

export function isDiscoveryDirectoryUnavailableError(
  err: unknown
): err is DiscoveryDirectoryUnavailableError {
  return err instanceof DiscoveryDirectoryUnavailableError;
}

/** Opt-in: throw DiscoveryDirectoryUnavailableError instead of returning empty on a failed read. */
export type DiscoveryReadOptions = { strict?: boolean };

type ListFilters = {
  publicStateSlug: string;
  county?: CountyDef | null;
  trade?: TradeDef | null;
  limit?: number;
  offset?: number;
  /** See DiscoveryReadOptions. A real zero-row result still returns total 0. */
  strict?: boolean;
};

type LicenseCardRow = Parameters<typeof mapRow>[0] & {
  license_identity: string;
  license_number_key: string | null;
  license_number: string | null;
  related: {
    slug: string;
    display_name: string;
    occupation_code: string | null;
    external_key: string | null;
    status_normalized: string | null;
  }[] | null;
};

/**
 * SEO-PATTERN-002 Oregon dedupe: one card per directory identity
 * (see LICENSE_IDENTITY_SQL). Same filter (`where`, $1 = license source) as the
 * per-profile listing. The representative profile is chosen deterministically
 * (active first, then external_key, then id). Every other published profile
 * of that same identity stays on the card as relatedProfiles, and discipline
 * is checked across those profiles only. Blank numbers and a reused number
 * on a different legal name are not that identity. Pagination uses the
 * identity as the unique final tie-breaker.
 */
async function listByLicenseNumber(opts: {
  where: string;
  filterParams: unknown[];
  entitySource: string;
  activeOnly: boolean;
  limit: number;
  offset: number;
}): Promise<SearchResult[]> {
  const { where, filterParams } = opts;
  const entitySourceIdx = filterParams.length + 1;
  const confIdx = filterParams.length + 2;
  const limitIdx = filterParams.length + 3;
  const offsetIdx = filterParams.length + 4;
  const params = [...filterParams, opts.entitySource, MIN_SUNBIZ_CONFIDENCE, opts.limit, opts.offset];
  const statusRank = (alias: string) =>
    `CASE ${alias}.status_normalized WHEN 'active' THEN 0 WHEN 'current' THEN 1 ELSE 2 END`;

  const rows = await query<LicenseCardRow>(
    `
    WITH picked AS (
      SELECT DISTINCT ON (license_identity)
        ${LICENSE_IDENTITY_SQL} AS license_identity,
        ${licenseNumberKeySql("l")} AS license_number_key,
        l.license_number,
        c.id,
        c.slug,
        c.display_name,
        c.legal_name,
        c.dba_name,
        c.primary_city,
        c.primary_county,
        c.home_state,
        l.external_key,
        l.occupation_code,
        l.status_normalized,
        l.last_verified_at,
        l.source_system,
        l.secondary_status
      FROM contractors c
      JOIN licenses l ON l.contractor_id = c.id
      WHERE ${where}
      ORDER BY license_identity, ${statusRank("l")}, l.external_key, c.id
    ),
    page AS (
      SELECT * FROM picked
      ORDER BY ${statusRank("picked")}, picked.display_name, picked.license_identity
      LIMIT $${limitIdx}::int OFFSET $${offsetIdx}::int
    )
    SELECT
      p.*,
      e.status AS entity_status,
      e.legal_name AS entity_name,
      (
        EXISTS (
          SELECT 1 FROM discipline_actions d
          WHERE d.contractor_id = p.id AND ${PUBLIC_REGULATORY_SQL}
        )
        OR EXISTS (
          SELECT 1
          FROM licenses l3
          JOIN contractors c3 ON c3.id = l3.contractor_id
          JOIN discipline_actions d ON d.contractor_id = l3.contractor_id
          WHERE p.license_number_key IS NOT NULL
            AND l3.license_number = p.license_number_key
            AND l3.source_system = $1
            AND c3.id <> p.id
            AND ${licenseIdentitySql("l3", "c3")} = p.license_identity
            AND ${PUBLIC_REGULATORY_SQL}
        )
      ) AS has_discipline,
      rel.related
    FROM page p
    LEFT JOIN LATERAL (
      SELECT ent.status, ent.legal_name
      FROM contractor_entities ce
      JOIN entities ent ON ent.id = ce.entity_id
      WHERE ce.contractor_id = p.id
        AND ce.role = 'sunbiz_entity'
        AND ent.source_system = $${entitySourceIdx}::text
        AND ce.confidence IS NOT NULL
        AND ce.confidence >= $${confIdx}::numeric
      ORDER BY ce.confidence DESC NULLS LAST
      LIMIT 1
    ) e ON TRUE
    LEFT JOIN LATERAL (
      SELECT json_agg(
        json_build_object(
          'slug', c2.slug,
          'display_name', c2.display_name,
          'occupation_code', l2.occupation_code,
          'external_key', l2.external_key,
          'status_normalized', l2.status_normalized
        )
        ORDER BY l2.occupation_code, l2.external_key, c2.id
      ) AS related
      FROM licenses l2
      JOIN contractors c2 ON c2.id = l2.contractor_id
      WHERE p.license_number_key IS NOT NULL
        AND l2.license_number = p.license_number_key
        AND l2.source_system = $1
        AND ${licenseIdentitySql("l2", "c2")} = p.license_identity
        AND c2.id <> p.id
        AND c2.is_thin_profile = FALSE
        ${opts.activeOnly ? "AND l2.status_normalized IN ('active', 'current')" : ""}
    ) rel ON TRUE
    ORDER BY ${statusRank("p")}, p.display_name, p.license_identity
    `,
    params
  );

  return rows.map((r) => {
    const card = mapRow(r);
    const related = (r.related || []).map((x) => ({
      slug: x.slug,
      displayName: x.display_name,
      occupationCode: x.occupation_code,
      licenseKey: x.external_key,
      licenseStatus: asLicenseStatus(x.status_normalized),
    }));
    return related.length ? { ...card, relatedProfiles: related } : card;
  });
}

export async function listDiscoveryContractors(filters: ListFilters): Promise<{
  results: SearchResult[];
  total: number;
}> {
  const disc = getDiscoveryState(filters.publicStateSlug);
  if (!disc) return { results: [], total: 0 };
  const state = getStateBySlug(disc.evidenceSlug);
  if (!state?.live) return { results: [], total: 0 };

  try {
  const limit = filters.limit ?? DISCOVERY_PAGE_SIZE;
  const offset = filters.offset ?? 0;

  const { where, params: filterParams } = buildFilterClause({
    licenseSource: state.licenseSource,
    stateCode: state.code,
    occupationCodes: filters.trade?.occupationCodes ?? null,
    classCodes: filters.trade?.classCodes ?? null,
    descriptionIncludes: filters.trade?.descriptionIncludes ?? null,
    county: filters.county ?? null,
    activeOnly: Boolean(disc.activeOnlyDefault),
    requireInStateAddress: disc.requireInStateAddress,
  });

  const countRow = await queryOne<{ n: string }>(
    `
    SELECT COUNT(DISTINCT ${directoryIdentitySql(disc)})::text AS n
    FROM contractors c
    JOIN licenses l ON l.contractor_id = c.id
    WHERE ${where}
    `,
    filterParams
  );
  const total = countRow ? Number(countRow.n) : 0;
  if (total === 0) return { results: [], total: 0 };

  if (disc.dedupeByLicenseNumber) {
    const results = await listByLicenseNumber({
      where,
      filterParams,
      entitySource: state.entitySource,
      activeOnly: Boolean(disc.activeOnlyDefault),
      limit,
      offset,
    });
    return { results, total };
  }

  // Entity lateral uses two extra params after filters
  const entitySourceIdx = filterParams.length + 1;
  const confIdx = filterParams.length + 2;
  const limitIdx = filterParams.length + 3;
  const offsetIdx = filterParams.length + 4;
  const listParams = [
    ...filterParams,
    state.entitySource,
    MIN_SUNBIZ_CONFIDENCE,
    limit,
    offset,
  ];

  const rows = await query<{
    id: string;
    slug: string;
    display_name: string;
    legal_name: string | null;
    dba_name: string | null;
    primary_city: string | null;
    primary_county: string | null;
    home_state: string | null;
    external_key: string | null;
    occupation_code: string | null;
    status_normalized: string | null;
    last_verified_at: Date | null;
    source_system?: string | null;
    secondary_status?: string | null;
    entity_status: string | null;
    entity_name: string | null;
    has_discipline: boolean;
  }>(
    `
    WITH picked AS (
      SELECT DISTINCT ON (c.id)
        c.id,
        c.slug,
        c.display_name,
        c.legal_name,
        c.dba_name,
        c.primary_city,
        c.primary_county,
        c.home_state,
        l.external_key,
        l.occupation_code,
        l.status_normalized,
        l.last_verified_at,
        l.source_system,
        l.secondary_status
      FROM contractors c
      JOIN licenses l ON l.contractor_id = c.id
      WHERE ${where}
      ORDER BY c.id,
        CASE l.status_normalized WHEN 'active' THEN 0 WHEN 'current' THEN 1 ELSE 2 END,
        l.updated_at DESC NULLS LAST
    )
    SELECT
      p.*,
      e.status AS entity_status,
      e.legal_name AS entity_name,
      EXISTS (
        SELECT 1 FROM discipline_actions d
        WHERE d.contractor_id = p.id AND ${PUBLIC_REGULATORY_SQL}
      ) AS has_discipline
    FROM picked p
    LEFT JOIN LATERAL (
      SELECT ent.status, ent.legal_name
      FROM contractor_entities ce
      JOIN entities ent ON ent.id = ce.entity_id
      WHERE ce.contractor_id = p.id
        AND ce.role = 'sunbiz_entity'
        AND ent.source_system = $${entitySourceIdx}::text
        AND ce.confidence IS NOT NULL
        AND ce.confidence >= $${confIdx}::numeric
      ORDER BY ce.confidence DESC NULLS LAST
      LIMIT 1
    ) e ON TRUE
    ORDER BY
      CASE p.status_normalized WHEN 'active' THEN 0 WHEN 'current' THEN 1 ELSE 2 END,
      p.display_name
    LIMIT $${limitIdx}::int OFFSET $${offsetIdx}::int
    `,
    listParams
  );

  return { results: rows.map(mapRow), total };
  } catch (err) {
    console.error("[discovery] listDiscoveryContractors failed:", err instanceof Error ? err.message : err);
    if (filters.strict) throw new DiscoveryDirectoryUnavailableError("listDiscoveryContractors", err);
    return { results: [], total: 0 };
  }
}

export async function getStateDiscoveryStats(publicStateSlug: string): Promise<{
  contractors: number;
  licenses: number;
  sunbizLinks: number;
}> {
  const disc = getDiscoveryState(publicStateSlug);
  if (!disc) return { contractors: 0, licenses: 0, sunbizLinks: 0 };
  const state = getStateBySlug(disc.evidenceSlug);
  if (!state?.live) return { contractors: 0, licenses: 0, sunbizLinks: 0 };

  try {
    const row = await queryOne<{ contractors: string; licenses: string; links: string }>(
      `
      SELECT
        (SELECT COUNT(*)::text FROM contractors c
         WHERE c.is_thin_profile = FALSE
           AND (c.home_state = $1 OR EXISTS (
             SELECT 1 FROM licenses l
             WHERE l.contractor_id = c.id AND l.source_system = $2
           ))
        ) AS contractors,
        (SELECT COUNT(*)::text FROM licenses l WHERE l.source_system = $2) AS licenses,
        (SELECT COUNT(*)::text FROM contractor_entities ce
         JOIN entities e ON e.id = ce.entity_id
         WHERE ce.role = 'sunbiz_entity'
           AND e.source_system = $3
           AND ce.confidence >= 0.9
        ) AS links
      `,
      [state.code, state.licenseSource, state.entitySource]
    );
    return {
      contractors: Number(row?.contractors || 0),
      licenses: Number(row?.licenses || 0),
      sunbizLinks: Number(row?.links || 0),
    };
  } catch {
    return { contractors: 0, licenses: 0, sunbizLinks: 0 };
  }
}

/**
 * Trade facets — one SQL group-by when scoped to a county; batch occupation
 * counts statewide otherwise. Avoids N full listDiscoveryContractors calls.
 */
export async function countByTrade(
  publicStateSlug: string,
  county?: CountyDef | null,
  opts?: DiscoveryReadOptions
): Promise<DiscoveryFacet[]> {
  const disc = getDiscoveryState(publicStateSlug);
  if (!disc) return [];
  const state = getStateBySlug(disc.evidenceSlug);
  if (!state?.live) return [];

  if (!county) {
    return countTradesBatch(publicStateSlug);
  }

  try {
    const extraTrades = disc.trades.filter((t) => tradeHasExtraFilters(t));
    const extraCounts = new Map<string, number>();
    if (extraTrades.length) {
      await Promise.all(
        extraTrades.map(async (t) => {
          extraCounts.set(t.slug, await countDistinctForTrade(disc, state, t, county));
        })
      );
    }

    const { where, params } = buildFilterClause({
      licenseSource: state.licenseSource,
      stateCode: state.code,
      county,
      activeOnly: Boolean(disc.activeOnlyDefault),
      requireInStateAddress: disc.requireInStateAddress,
    });

    if (disc.dedupeByLicenseNumber) {
      // One count per trade over directory identity, so endorsements of one
      // legal entity in one trade family are counted once and the facet
      // equals the deduplicated [county]/[trade] listing total.
      const codeTrades = disc.trades.filter((t) => !tradeHasExtraFilters(t));
      const codes: string[] = [];
      const slugs: string[] = [];
      for (const t of codeTrades) {
        for (const code of t.occupationCodes) {
          codes.push(code.toUpperCase());
          slugs.push(t.slug);
        }
      }
      const codesIdx = params.length + 1;
      const slugsIdx = params.length + 2;
      const tradeRows = codes.length
        ? await query<{ slug: string; n: string }>(
            `
      SELECT tc.slug, COUNT(DISTINCT ${LICENSE_IDENTITY_SQL})::text AS n
      FROM contractors c
      JOIN licenses l ON l.contractor_id = c.id
      JOIN unnest($${codesIdx}::text[], $${slugsIdx}::text[]) AS tc(code, slug)
        ON tc.code = l.occupation_code
      WHERE ${where}
      GROUP BY tc.slug
      `,
            [...params, codes, slugs]
          )
        : [];
      const bySlug = new Map(tradeRows.map((r) => [r.slug, Number(r.n)]));
      return disc.trades
        .map((t) => ({
          slug: t.slug,
          label: t.label,
          count: tradeHasExtraFilters(t) ? extraCounts.get(t.slug) || 0 : bySlug.get(t.slug) || 0,
        }))
        .filter((f) => f.count > 0)
        .sort((a, b) => b.count - a.count);
    }

    const rows = await query<{ occupation_code: string; n: string }>(
      `
      SELECT l.occupation_code, COUNT(DISTINCT c.id)::text AS n
      FROM contractors c
      JOIN licenses l ON l.contractor_id = c.id
      WHERE ${where}
      GROUP BY l.occupation_code
      `,
      params
    );
    const byCode = new Map(
      rows.map((r) => [r.occupation_code.toUpperCase(), Number(r.n)])
    );
    return disc.trades
      .map((t) => ({
        slug: t.slug,
        label: t.label,
        count: tradeHasExtraFilters(t)
          ? extraCounts.get(t.slug) || 0
          : t.occupationCodes.reduce(
              (sum, code) => sum + (byCode.get(code.toUpperCase()) || 0),
              0
            ),
      }))
      .filter((f) => f.count > 0)
      .sort((a, b) => b.count - a.count);
  } catch (err) {
    if (opts?.strict) throw new DiscoveryDirectoryUnavailableError("countByTrade", err);
    return [];
  }
}

/**
 * Oregon county facets. One statement, same predicate as the active listing
 * (buildFilterClause county match, activeOnly, occupation codes, directory
 * identity). CCB county codes are not translated through the Florida DBPR
 * code table: code 12 is Grant, not Baker.
 */
async function countDedupeCountiesForTrade(
  disc: NonNullable<ReturnType<typeof getDiscoveryState>>,
  state: NonNullable<ReturnType<typeof getStateBySlug>>,
  trade: TradeDef
): Promise<DiscoveryFacet[]> {
  const codes = (trade.occupationCodes || []).map((code) => code.toUpperCase()).filter(Boolean);
  if (!codes.length) return [];
  const nameSlugs: string[] = [];
  const nameTokens: string[] = [];
  const codeSlugs: string[] = [];
  const codeTokens: string[] = [];
  for (const county of disc.counties) {
    for (const name of county.matchNames) {
      const token = name.toLowerCase().trim();
      if (!token) continue;
      nameSlugs.push(county.slug);
      nameTokens.push(token);
    }
    for (const code of county.matchCodes || []) {
      const token = code.trim();
      if (!token) continue;
      codeSlugs.push(county.slug);
      codeTokens.push(token);
    }
  }
  if (!nameTokens.length && !codeTokens.length) return [];
  // Each license row emits its normalized county keys once and is hash-joined
  // to the curated tokens by equality. Same matches as buildFilterClause:
  // a name token matches LOWER(TRIM(county_name|primary_county)) with spaces
  // and dashes equivalent; a code token matches TRIM or zero-stripped
  // county_code|primary_county. (The per-row OR across every county token was
  // the slowest statement on /oregon/<trade> pages.)
  const rows = await query<{ slug: string; n: string }>(
    `
    WITH r AS (
      SELECT
        ${LICENSE_IDENTITY_SQL} AS ident,
        REPLACE(LOWER(TRIM(COALESCE(l.county_name, ''))), ' ', '-') AS n1,
        REPLACE(LOWER(TRIM(COALESCE(c.primary_county, ''))), ' ', '-') AS n2,
        TRIM(COALESCE(l.county_code, '')) AS k1,
        TRIM(COALESCE(c.primary_county, '')) AS k2
      FROM contractors c
      JOIN licenses l ON l.contractor_id = c.id
      WHERE l.source_system = $1
        AND c.is_thin_profile = FALSE
        ${inStateSql(disc.requireInStateAddress)}
        ${disc.activeOnlyDefault ? "AND l.status_normalized IN ('active', 'current')" : ""}
        AND l.occupation_code = ANY($7::text[])
    ),
    keys AS (
      SELECT DISTINCT r.ident, k.kind, k.val
      FROM r
      CROSS JOIN LATERAL (
        VALUES ('name', r.n1), ('name', r.n2),
               ('code', r.k1), ('code', r.k2),
               ('code', LTRIM(r.k1, '0')), ('code', LTRIM(r.k2, '0'))
      ) AS k(kind, val)
    ),
    m AS (
      SELECT slug, REPLACE(token, ' ', '-') AS val, 'name'::text AS kind
      FROM unnest($3::text[], $4::text[]) AS u(slug, token)
      UNION
      SELECT slug, token, 'code'::text
      FROM unnest($5::text[], $6::text[]) AS u(slug, token)
    )
    SELECT m.slug, COUNT(DISTINCT keys.ident)::text AS n
    FROM keys
    JOIN m ON m.kind = keys.kind AND m.val = keys.val
    GROUP BY m.slug
    `,
    [state.licenseSource, state.code, nameSlugs, nameTokens, codeSlugs, codeTokens, codes]
  );
  const bySlug = new Map(rows.map((row) => [row.slug, Number(row.n)]));
  return disc.counties
    .map((county) => ({ slug: county.slug, label: county.name, count: bySlug.get(county.slug) || 0 }))
    .filter((facet) => facet.count > 0)
    .sort((a, b) => b.count - a.count);
}

/** County facets for a single trade — one SQL pass + map to curated slugs. */
export async function countCountiesForTrade(
  publicStateSlug: string,
  trade: TradeDef,
  opts?: DiscoveryReadOptions
): Promise<DiscoveryFacet[]> {
  const disc = getDiscoveryState(publicStateSlug);
  if (!disc) return [];
  const state = getStateBySlug(disc.evidenceSlug);
  if (!state?.live) return [];

  if (disc.dedupeByLicenseNumber) {
    try {
      return await countDedupeCountiesForTrade(disc, state, trade);
    } catch (err) {
      if (opts?.strict) throw new DiscoveryDirectoryUnavailableError("countCountiesForTrade", err);
      return [];
    }
  }

  const usesPostalGeo = disc.counties.some((c) => (c.matchPostalPrefixes || []).length > 0);
  if (usesPostalGeo) {
    try {
      const byZip = await countByPostalPrefix(publicStateSlug, trade);
      const facets = rollupGeosFromZips(disc.counties, byZip);
      return await appendOutOfStateFacet(publicStateSlug, facets, trade, opts);
    } catch (err) {
      if (opts?.strict) {
        if (isDiscoveryDirectoryUnavailableError(err)) throw err;
        throw new DiscoveryDirectoryUnavailableError("countCountiesForTrade", err);
      }
      return [];
    }
  }

  const usesCityGeo = disc.counties.some((c) => (c.matchCities || []).length > 0);
  if (usesCityGeo) {
    try {
      const byCity = await countByCity(publicStateSlug, trade);
      return rollupGeosFromCities(disc.counties, byCity);
    } catch (err) {
      if (opts?.strict) throw new DiscoveryDirectoryUnavailableError("countCountiesForTrade", err);
      return [];
    }
  }

  try {
    const rows = await query<{ county: string; n: string }>(
      `
      SELECT ${FACET_COUNTY_SQL} AS county,
             COUNT(DISTINCT ${directoryIdentitySql(disc)})::text AS n
      FROM contractors c
      JOIN licenses l ON l.contractor_id = c.id
      WHERE l.source_system = $1
        AND c.is_thin_profile = FALSE
        ${inStateSql(disc.requireInStateAddress)}
        AND l.occupation_code = ANY($3::text[])
        AND ${FACET_COUNTY_SQL} IS NOT NULL
      GROUP BY 1
      `,
      [state.licenseSource, state.code, trade.occupationCodes]
    );

    const byKey = new Map<string, number>();
    for (const r of rows) {
      const raw = (r.county || "").toLowerCase().replace(/\s+/g, " ").trim();
      if (!raw) continue;
      const n = Number(r.n);
      byKey.set(raw, Math.max(byKey.get(raw) || 0, n));
      byKey.set(raw.replace(/\s+/g, "-"), Math.max(byKey.get(raw.replace(/\s+/g, "-")) || 0, n));
      byKey.set(raw.replace(/-/g, " "), Math.max(byKey.get(raw.replace(/-/g, " ")) || 0, n));
    }

    return disc.counties
      .map((county) => ({ slug: county.slug, label: county.name, count: countyFacetCount(county, byKey) }))
      .filter((f) => f.count > 0)
      .sort((a, b) => b.count - a.count);
  } catch (err) {
    if (opts?.strict) throw new DiscoveryDirectoryUnavailableError("countCountiesForTrade", err);
    return [];
  }
}

export async function countTradesBatch(publicStateSlug: string): Promise<DiscoveryFacet[]> {
  const disc = getDiscoveryState(publicStateSlug);
  if (!disc) return [];
  const state = getStateBySlug(disc.evidenceSlug);
  if (!state?.live) return [];

  try {
    const rows = await query<{ occupation_code: string; n: string }>(
      `
      SELECT l.occupation_code, COUNT(DISTINCT c.id)::text AS n
      FROM contractors c
      JOIN licenses l ON l.contractor_id = c.id
      WHERE l.source_system = $1
        AND c.is_thin_profile = FALSE
        ${inStateSql(disc.requireInStateAddress)}
        ${disc.activeOnlyDefault ? "AND l.status_normalized IN ('active', 'current')" : ""}
      GROUP BY l.occupation_code
      `,
      [state.licenseSource, state.code]
    );
    const byCode = new Map(rows.map((r) => [r.occupation_code.toUpperCase(), Number(r.n)]));
    const extraCounts = new Map<string, number>();
    const extraTrades = disc.trades.filter((t) => tradeHasExtraFilters(t));
    if (extraTrades.length) {
      await Promise.all(
        extraTrades.map(async (t) => {
          extraCounts.set(t.slug, await countDistinctForTrade(disc, state, t));
        })
      );
    }
    return disc.trades
      .map((t) => ({
        slug: t.slug,
        label: t.label,
        count: tradeHasExtraFilters(t)
          ? extraCounts.get(t.slug) || 0
          : t.occupationCodes.reduce(
              (sum, code) => sum + (byCode.get(code.toUpperCase()) || 0),
              0
            ),
      }))
      .filter((f) => f.count > 0)
      .sort((a, b) => b.count - a.count);
  } catch {
    return [];
  }
}

async function countByCity(
  publicStateSlug: string,
  trade?: TradeDef | null
): Promise<Map<string, number>> {
  const disc = getDiscoveryState(publicStateSlug);
  const state = disc ? getStateBySlug(disc.evidenceSlug) : null;
  const out = new Map<string, number>();
  if (!disc || !state?.live) return out;
  const { where, params } = buildFilterClause({
    licenseSource: state.licenseSource,
    stateCode: state.code,
    occupationCodes: trade?.occupationCodes ?? null,
    classCodes: trade?.classCodes ?? null,
    descriptionIncludes: trade?.descriptionIncludes ?? null,
    activeOnly: Boolean(disc.activeOnlyDefault),
    requireInStateAddress: disc.requireInStateAddress,
  });
  const rows = await query<{ city: string; n: string }>(
    `
    SELECT LOWER(TRIM(COALESCE(l.city, c.primary_city, ''))) AS city,
           COUNT(DISTINCT c.id)::text AS n
    FROM contractors c
    JOIN licenses l ON l.contractor_id = c.id
    WHERE ${where}
      AND COALESCE(NULLIF(TRIM(l.city), ''), NULLIF(TRIM(c.primary_city), '')) IS NOT NULL
    GROUP BY 1
    `,
    params
  );
  for (const r of rows) {
    const key = (r.city || "").toLowerCase().replace(/\s+/g, " ").trim();
    if (key) out.set(key, Number(r.n));
  }
  return out;
}

async function countByPostalPrefix(
  publicStateSlug: string,
  trade?: TradeDef | null
): Promise<Map<string, number>> {
  const disc = getDiscoveryState(publicStateSlug);
  const state = disc ? getStateBySlug(disc.evidenceSlug) : null;
  const out = new Map<string, number>();
  if (!disc || !state?.live) return out;
  const { where, params } = buildFilterClause({
    licenseSource: state.licenseSource,
    stateCode: state.code,
    occupationCodes: trade?.occupationCodes ?? null,
    classCodes: trade?.classCodes ?? null,
    descriptionIncludes: trade?.descriptionIncludes ?? null,
    activeOnly: Boolean(disc.activeOnlyDefault),
    requireInStateAddress: disc.requireInStateAddress,
  });
  const rows = await query<{ zip: string; n: string }>(
    `
    SELECT LEFT(REGEXP_REPLACE(COALESCE(l.postal_code, ''), '[^0-9]', '', 'g'), 5) AS zip,
           COUNT(DISTINCT c.id)::text AS n
    FROM contractors c
    JOIN licenses l ON l.contractor_id = c.id
    WHERE ${where}
      AND LENGTH(REGEXP_REPLACE(COALESCE(l.postal_code, ''), '[^0-9]', '', 'g')) >= 5
    GROUP BY 1
    `,
    params
  );
  for (const r of rows) {
    const key = (r.zip || "").trim();
    if (key.length === 5) out.set(key, Number(r.n));
  }
  return out;
}

function rollupGeosFromZips(
  geos: CountyDef[],
  byZip: Map<string, number>
): DiscoveryFacet[] {
  return geos
    .filter((geo) => !geo.matchOutOfStateMailing)
    .map((geo) => {
      const zips = geo.matchPostalPrefixes || [];
      const count = zips.reduce((sum, zip) => {
        const key = zip.replace(/\D/g, "").slice(0, 5);
        return sum + (byZip.get(key) || 0);
      }, 0);
      return {
        slug: geo.slug,
        label:
          geo.matchOutOfStateMailing || geo.kind === "city"
            ? geo.name
            : `${geo.name} County`,
        count,
      };
    })
    .filter((f) => f.count > 0)
    .sort((a, b) => b.count - a.count);
}

async function appendOutOfStateFacet(
  publicStateSlug: string,
  facets: DiscoveryFacet[],
  trade?: TradeDef | null,
  opts?: DiscoveryReadOptions
): Promise<DiscoveryFacet[]> {
  const disc = getDiscoveryState(publicStateSlug);
  const state = disc ? getStateBySlug(disc.evidenceSlug) : null;
  const oos = disc?.counties.find((c) => c.matchOutOfStateMailing);
  if (!disc || !state?.live || !oos) return facets;
  try {
    const n = trade
      ? await countDistinctForTrade(disc, state, trade, oos)
      : await countDistinctForTrade(
          disc,
          state,
          { slug: "_all", label: "", title: "", description: "", occupationCodes: [] },
          oos
        );
    if (n <= 0) return facets;
    return [...facets, { slug: oos.slug, label: oos.name, count: n }].sort(
      (a, b) => b.count - a.count
    );
  } catch (err) {
    // Strict callers: a missing out-of-state facet is a partial read, not zero.
    if (opts?.strict) throw new DiscoveryDirectoryUnavailableError("appendOutOfStateFacet", err);
    return facets;
  }
}

function rollupGeosFromCities(
  geos: CountyDef[],
  byCity: Map<string, number>
): DiscoveryFacet[] {
  return geos
    .map((geo) => {
      const cities = geo.matchCities || [];
      const count = cities.reduce((sum, city) => {
        return sum + (byCity.get(city.toLowerCase().trim()) || 0);
      }, 0);
      return { slug: geo.slug, label: geo.kind === "city" ? geo.name : geo.name, count };
    })
    .filter((f) => f.count > 0)
    .sort((a, b) => b.count - a.count);
}

export async function countCitiesBatch(publicStateSlug: string): Promise<DiscoveryFacet[]> {
  const disc = getDiscoveryState(publicStateSlug);
  if (!disc?.cities?.length) return [];
  try {
    const byCity = await countByCity(publicStateSlug);
    return rollupGeosFromCities(disc.cities, byCity);
  } catch (err) {
    console.error(
      "[discovery] countCitiesBatch failed:",
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

export async function countCountiesBatch(publicStateSlug: string): Promise<DiscoveryFacet[]> {
  const disc = getDiscoveryState(publicStateSlug);
  if (!disc) return [];
  const state = getStateBySlug(disc.evidenceSlug);
  if (!state?.live) return [];

  const usesPostalGeo = disc.counties.some((c) => (c.matchPostalPrefixes || []).length > 0);
  if (usesPostalGeo) {
    try {
      const byZip = await countByPostalPrefix(publicStateSlug);
      const facets = rollupGeosFromZips(disc.counties, byZip);
      return await appendOutOfStateFacet(publicStateSlug, facets);
    } catch (err) {
      console.error(
        "[discovery] countCountiesBatch (ZIP rollup) failed:",
        err instanceof Error ? err.message : err
      );
      return [];
    }
  }

  const usesCityGeo = disc.counties.some((c) => (c.matchCities || []).length > 0);
  if (usesCityGeo) {
    try {
      const byCity = await countByCity(publicStateSlug);
      return rollupGeosFromCities(disc.counties, byCity);
    } catch (err) {
      console.error(
        "[discovery] countCountiesBatch (city rollup) failed:",
        err instanceof Error ? err.message : err
      );
      return [];
    }
  }

  try {
    const rows = await query<{ county: string; n: string }>(
      `
      SELECT ${FACET_COUNTY_SQL} AS county,
             COUNT(DISTINCT c.id)::text AS n
      FROM contractors c
      JOIN licenses l ON l.contractor_id = c.id
      WHERE l.source_system = $1
        AND c.is_thin_profile = FALSE
        ${inStateSql(disc.requireInStateAddress)}
        AND ${FACET_COUNTY_SQL} IS NOT NULL
      GROUP BY 1
      `,
      [state.licenseSource, state.code]
    );

    const byKey = new Map<string, number>();
    for (const r of rows) {
      const raw = (r.county || "").toLowerCase().replace(/\s+/g, " ").trim();
      if (!raw) continue;
      const n = Number(r.n);
      byKey.set(raw, Math.max(byKey.get(raw) || 0, n));
      byKey.set(raw.replace(/\s+/g, "-"), Math.max(byKey.get(raw.replace(/\s+/g, "-")) || 0, n));
      byKey.set(raw.replace(/-/g, " "), Math.max(byKey.get(raw.replace(/-/g, " ")) || 0, n));
    }

    return disc.counties
      .map((county) => ({ slug: county.slug, label: county.name, count: countyFacetCount(county, byKey) }))
      .filter((f) => f.count > 0)
      .sort((a, b) => b.count - a.count);
  } catch (err) {
    // Do NOT fall back to N per-county queries — that multiplies pool usage
    // and can exhaust Supabase session mode (EMAXCONNSESSION) during SSG.
    console.error(
      "[discovery] countCountiesBatch failed:",
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

export function resolveListFilters(
  publicStateSlug: string,
  opts: { countySlug?: string; tradeSlug?: string }
): {
  disc: NonNullable<ReturnType<typeof getDiscoveryState>>;
  county: CountyDef | null;
  trade: TradeDef | null;
} | null {
  const disc = getDiscoveryState(publicStateSlug);
  if (!disc) return null;
  const county = opts.countySlug ? getCounty(disc, opts.countySlug) : null;
  const trade = opts.tradeSlug ? getTrade(disc, opts.tradeSlug) : null;
  if (opts.countySlug && !county) return null;
  if (opts.tradeSlug && !trade) return null;
  return { disc, county, trade };
}
