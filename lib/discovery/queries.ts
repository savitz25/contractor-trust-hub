import { query, queryOne } from "@/lib/db";
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

const MIN_SUNBIZ_CONFIDENCE = 0.9;
export const DISCOVERY_PAGE_SIZE = 24;

function inStateSql(requireInState: boolean | undefined): string {
  return requireInState === false ? "" : "AND (c.home_state = $2 OR l.state = $2)";
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
    county: r.primary_county,
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
  }

  if (opts.activeOnly) {
    where += ` AND l.status_normalized IN ('active', 'current')`;
  }

  if (opts.occupationCodes?.length) {
    params.push(opts.occupationCodes.map((c) => c.toUpperCase()));
    where += ` AND UPPER(l.occupation_code) = ANY($${params.length}::text[])`;
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
    // When extract stores only county_code (null name), match known DBPR codes
    for (const code of opts.county.matchCodes || []) {
      params.push(code);
      const i = params.length;
      clauses.push(`TRIM(COALESCE(l.county_code, '')) = $${i}`);
    }
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
    SELECT COUNT(DISTINCT c.id)::text AS n
    FROM contractors c
    JOIN licenses l ON l.contractor_id = c.id
    WHERE ${where}
    `,
    params
  );
  return Number(row?.n || 0);
}

type ListFilters = {
  publicStateSlug: string;
  county?: CountyDef | null;
  trade?: TradeDef | null;
  limit?: number;
  offset?: number;
};

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
    SELECT COUNT(DISTINCT c.id)::text AS n
    FROM contractors c
    JOIN licenses l ON l.contractor_id = c.id
    WHERE ${where}
    `,
    filterParams
  );
  const total = countRow ? Number(countRow.n) : 0;
  if (total === 0) return { results: [], total: 0 };

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
  county?: CountyDef | null
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
  } catch {
    return [];
  }
}

/** County facets for a single trade — one SQL pass + map to curated slugs. */
export async function countCountiesForTrade(
  publicStateSlug: string,
  trade: TradeDef
): Promise<DiscoveryFacet[]> {
  const disc = getDiscoveryState(publicStateSlug);
  if (!disc) return [];
  const state = getStateBySlug(disc.evidenceSlug);
  if (!state?.live) return [];

  const usesPostalGeo = disc.counties.some((c) => (c.matchPostalPrefixes || []).length > 0);
  if (usesPostalGeo) {
    try {
      const byZip = await countByPostalPrefix(publicStateSlug, trade);
      const facets = rollupGeosFromZips(disc.counties, byZip);
      return await appendOutOfStateFacet(publicStateSlug, facets, trade);
    } catch {
      return [];
    }
  }

  const usesCityGeo = disc.counties.some((c) => (c.matchCities || []).length > 0);
  if (usesCityGeo) {
    try {
      const byCity = await countByCity(publicStateSlug, trade);
      return rollupGeosFromCities(disc.counties, byCity);
    } catch {
      return [];
    }
  }

  try {
    const rows = await query<{ county: string; n: string }>(
      `
      SELECT LOWER(TRIM(COALESCE(NULLIF(TRIM(l.county_name), ''), c.primary_county))) AS county,
             COUNT(DISTINCT c.id)::text AS n
      FROM contractors c
      JOIN licenses l ON l.contractor_id = c.id
      WHERE l.source_system = $1
        AND c.is_thin_profile = FALSE
        ${inStateSql(disc.requireInStateAddress)}
        AND l.occupation_code = ANY($3::text[])
        AND COALESCE(NULLIF(TRIM(l.county_name), ''), c.primary_county) IS NOT NULL
        AND COALESCE(NULLIF(TRIM(l.county_name), ''), c.primary_county) ~ '[A-Za-z]'
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
      .map((county) => {
        let count = 0;
        for (const name of county.matchNames) {
          const k = name.toLowerCase().replace(/\s+/g, " ").trim();
          count = Math.max(
            count,
            byKey.get(k) || 0,
            byKey.get(k.replace(/\s+/g, "-")) || 0,
            byKey.get(k.replace(/-/g, " ")) || 0
          );
        }
        return { slug: county.slug, label: county.name, count };
      })
      .filter((f) => f.count > 0)
      .sort((a, b) => b.count - a.count);
  } catch {
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
  trade?: TradeDef | null
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
  } catch {
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
      SELECT LOWER(TRIM(COALESCE(NULLIF(TRIM(l.county_name), ''), c.primary_county))) AS county,
             COUNT(DISTINCT c.id)::text AS n
      FROM contractors c
      JOIN licenses l ON l.contractor_id = c.id
      WHERE l.source_system = $1
        AND c.is_thin_profile = FALSE
        ${inStateSql(disc.requireInStateAddress)}
        AND COALESCE(NULLIF(TRIM(l.county_name), ''), c.primary_county) IS NOT NULL
        AND COALESCE(NULLIF(TRIM(l.county_name), ''), c.primary_county) ~ '[A-Za-z]'
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
      .map((county) => {
        let count = 0;
        for (const name of county.matchNames) {
          const k = name.toLowerCase().replace(/\s+/g, " ").trim();
          count = Math.max(
            count,
            byKey.get(k) || 0,
            byKey.get(k.replace(/\s+/g, "-")) || 0,
            byKey.get(k.replace(/-/g, " ")) || 0
          );
        }
        return { slug: county.slug, label: county.name, count };
      })
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
