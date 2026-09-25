import { cache } from "react";
import { query, queryOne } from "@/lib/db";
import {
  DEFAULT_STATE_SLUG,
  getStateBySlug,
  licenseSourcesFor,
  type EvidenceState,
} from "@/lib/states/config";
import { evidenceSlugFromHomeState } from "@/lib/states/evidence-copy";
import {
  parseWorkIntent,
  resolveWorkIntent,
  workFilterIsEmpty,
  type WorkSearchFilter,
} from "@/lib/verify/work-intents";
import { asLicenseStatus } from "./format";
import { looksLikeLicenseKey, normalizeLicenseKey } from "./search-normalize";
import { buildNameMatchSql, prepareNameTerms } from "./name-search-core";
import { stateHasEntityLinking } from "./trust-report";
import { PUBLIC_REGULATORY_SQL } from "@/lib/regulatory/publication";
import type {
  ContractorDetail,
  DisciplineDetail,
  EntityDetail,
  LicenseDetail,
  SearchResult,
} from "./types";

const DEFAULT_LIMIT = 25;

/** Only surface Sunbiz links at or above this confidence (matches linker defaults). */
const MIN_SUNBIZ_CONFIDENCE = 0.9;

/** Sitemap page size (Google max is 50k URLs per file). */
export const SITEMAP_PAGE_SIZE = 40_000;

function normalizeSearchInput(q: string): string {
  return q.trim().replace(/\s+/g, " ");
}

export type SearchOptions = {
  stateSlug?: string;
  limit?: number;
  /** Consumer work chip — published class codes and/or name/specialty text. */
  work?: string | null;
};

function workFilterSql(
  filter: WorkSearchFilter,
  startIndex: number
): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  const parts: string[] = [];
  let i = startIndex;
  if (filter.occupationCodes.length) {
    params.push(filter.occupationCodes.map((c) => c.toUpperCase()));
    parts.push(`UPPER(TRIM(COALESCE(l.occupation_code, ''))) = ANY($${i}::text[])`);
    i += 1;
  }
  if (filter.classCodes.length) {
    params.push(filter.classCodes.map((c) => c.toUpperCase()));
    parts.push(`UPPER(TRIM(COALESCE(l.class_code, ''))) = ANY($${i}::text[])`);
    i += 1;
  }
  if (filter.descriptionTerms.length) {
    params.push(filter.descriptionTerms.map((s) => `%${s.toLowerCase()}%`));
    parts.push(`LOWER(COALESCE(l.occupation_description, '')) LIKE ANY($${i}::text[])`);
    i += 1;
  }
  if (filter.nameTerms.length) {
    params.push(filter.nameTerms.map((s) => `%${s.toLowerCase()}%`));
    parts.push(`(
      LOWER(COALESCE(c.display_name, '')) LIKE ANY($${i}::text[])
      OR LOWER(COALESCE(c.legal_name, '')) LIKE ANY($${i}::text[])
      OR LOWER(COALESCE(c.dba_name, '')) LIKE ANY($${i}::text[])
      OR LOWER(COALESCE(l.licensee_name_raw, '')) LIKE ANY($${i}::text[])
      OR LOWER(COALESCE(l.dba_name_raw, '')) LIKE ANY($${i}::text[])
      OR LOWER(COALESCE(l.occupation_description, '')) LIKE ANY($${i}::text[])
    )`);
  }
  if (!parts.length) return { sql: "", params: [] };
  return { sql: ` AND (${parts.join(" OR ")})`, params };
}

export async function searchContractors(
  rawQuery: string,
  options: SearchOptions = {},
  /** Injectable for tests only; production always uses the pooled `query`. */
  db: { query: typeof query } = { query }
): Promise<{ results: SearchResult[]; state: EvidenceState; mode: "license" | "name" }> {
  const state = getStateBySlug(options.stateSlug || "fl");
  if (!state || !state.live) {
    throw new Error("State not available for verify yet.");
  }

  const q = normalizeSearchInput(rawQuery);
  const workId = parseWorkIntent(options.work || undefined);
  const workChip = workId ? resolveWorkIntent(state.slug, workId) : null;
  const workFilter =
    workChip && !workFilterIsEmpty(workChip.filter) ? workChip.filter : null;

  if (q.length < 2 && !workFilter) {
    return { results: [], state, mode: "name" };
  }

  const limit = options.limit ?? DEFAULT_LIMIT;
  const licenseMode = q.length >= 2 && looksLikeLicenseKey(q);

  const wantEntity = stateHasEntityLinking(
    evidenceSlugFromHomeState(state.code, state.slug)
  );

  if (licenseMode) {
    const key = normalizeLicenseKey(q);
    // Prefer exact/prefix license hits; avoid leading-wildcard scans when possible.
    const rows = await db.query<{
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
      primary_status: string | null;
      last_verified_at: Date | null;
      source_system: string | null;
      secondary_status: string | null;
      entity_status: string | null;
      entity_name: string | null;
      has_discipline: boolean;
    }>(
      `
      WITH hits AS (
        SELECT
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
          l.primary_status,
          l.last_verified_at,
          l.source_system,
          l.secondary_status,
          CASE
            WHEN UPPER(REPLACE(l.external_key, ' ', '')) = $1 THEN 0
            WHEN UPPER(l.external_key) = $1 THEN 0
            WHEN UPPER(REPLACE(COALESCE(l.license_number, ''), ' ', '')) = $1 THEN 1
            WHEN UPPER(REPLACE(l.external_key, ' ', '')) LIKE $1 || '%' THEN 2
            WHEN UPPER(REPLACE(COALESCE(l.license_number, ''), ' ', '')) LIKE $1 || '%' THEN 2
            ELSE 3
          END AS rank_score
        FROM licenses l
        JOIN contractors c ON c.id = l.contractor_id
        WHERE l.source_system = ANY($2::text[])
          AND c.is_thin_profile = FALSE
          AND (
            UPPER(REPLACE(l.external_key, ' ', '')) = $1
            OR UPPER(REPLACE(COALESCE(l.license_number, ''), ' ', '')) = $1
            OR UPPER(REPLACE(l.external_key, ' ', '')) LIKE $1 || '%'
            OR UPPER(REPLACE(COALESCE(l.license_number, ''), ' ', '')) LIKE $1 || '%'
            OR UPPER(REPLACE(l.external_key, '-', '')) = REPLACE($1, '-', '')
            OR UPPER(l.external_key) = $1
            OR (
              LENGTH($1) >= 5 AND (
                UPPER(REPLACE(l.external_key, ' ', '')) LIKE '%' || $1 || '%'
                OR UPPER(REPLACE(COALESCE(l.license_number, ''), ' ', '')) LIKE '%' || $1 || '%'
              )
            )
          )
        ORDER BY rank_score,
          CASE l.status_normalized WHEN 'active' THEN 0 WHEN 'current' THEN 1 ELSE 2 END,
          CASE l.occupation_code WHEN 'TRMP' THEN 0 WHEN 'TMP' THEN 1 ELSE 2 END,
          c.display_name
        LIMIT $3
      )
      SELECT
        h.*,
        ${
          wantEntity
            ? `e.status AS entity_status,
        e.legal_name AS entity_name,`
            : `NULL::text AS entity_status,
        NULL::text AS entity_name,`
        }
        EXISTS (
          SELECT 1 FROM discipline_actions d
          WHERE d.contractor_id = h.id AND ${PUBLIC_REGULATORY_SQL}
        ) AS has_discipline
      FROM hits h
      ${
        wantEntity
          ? `LEFT JOIN LATERAL (
        SELECT ent.status, ent.legal_name
        FROM contractor_entities ce
        JOIN entities ent ON ent.id = ce.entity_id
        WHERE ce.contractor_id = h.id
          AND ce.role IN ('sunbiz_entity', 'linked', 'entity')
          AND ent.source_system = $4
          AND ce.confidence IS NOT NULL
          AND ce.confidence >= $5
        ORDER BY ce.confidence DESC NULLS LAST
        LIMIT 1
      ) e ON TRUE`
          : ""
      }
      ORDER BY h.rank_score, h.display_name
      LIMIT $3
      `,
      wantEntity
        ? [
            key,
            licenseSourcesFor(state),
            limit,
            state.entitySource,
            MIN_SUNBIZ_CONFIDENCE,
          ]
        : [key, licenseSourcesFor(state), limit]
    );

    return {
      mode: "license",
      state,
      results: rows.map(mapSearchRow),
    };
  }

  if (q.length < 2 && workFilter) {
    // $1 sources $2 limit; optional $3/$4 entity; work from the next index.
    // Issuing jurisdiction is source_system, not the business address.
    const workStart = wantEntity ? 5 : 3;
    const extra = workFilterSql(workFilter, workStart);
    const workParams: unknown[] = [
      licenseSourcesFor(state),
      limit,
    ];
    if (wantEntity) {
      workParams.push(state.entitySource, MIN_SUNBIZ_CONFIDENCE);
    }
    workParams.push(...extra.params);

    const rows = await db.query<{
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
      primary_status: string | null;
      last_verified_at: Date | null;
      source_system: string | null;
      secondary_status: string | null;
      entity_status: string | null;
      entity_name: string | null;
      has_discipline: boolean;
    }>(
      `
      WITH matched AS (
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
          l.primary_status,
          l.last_verified_at,
          l.source_system,
          l.secondary_status
        FROM contractors c
        JOIN licenses l ON l.contractor_id = c.id AND l.source_system = ANY($1::text[])
        WHERE c.is_thin_profile = FALSE
          ${extra.sql}
        ORDER BY c.id,
          CASE l.status_normalized WHEN 'active' THEN 0 WHEN 'current' THEN 1 ELSE 2 END,
          l.updated_at DESC NULLS LAST
        LIMIT $2
      )
      SELECT
        m.*,
        ${
          wantEntity
            ? `e.status AS entity_status, e.legal_name AS entity_name,`
            : `NULL::text AS entity_status, NULL::text AS entity_name,`
        }
        EXISTS (
          SELECT 1 FROM discipline_actions d
          WHERE d.contractor_id = m.id AND ${PUBLIC_REGULATORY_SQL}
        ) AS has_discipline
      FROM matched m
      ${
        wantEntity
          ? `LEFT JOIN LATERAL (
        SELECT ent.status, ent.legal_name
        FROM contractor_entities ce
        JOIN entities ent ON ent.id = ce.entity_id
        WHERE ce.contractor_id = m.id
          AND ce.role IN ('sunbiz_entity', 'linked', 'entity')
          AND ent.source_system = $3
          AND ce.confidence IS NOT NULL
          AND ce.confidence >= $4
        ORDER BY ce.confidence DESC NULLS LAST
        LIMIT 1
      ) e ON TRUE`
          : ""
      }
      ORDER BY m.display_name
      LIMIT $2
      `,
      workParams
    );
    return { mode: "name", state, results: rows.map(mapSearchRow) };
  }

  // Name search. TH-SEARCH-R1-019B: predicate, rank and index prefilter come from the shared
  // name core (every meaningful word, within one source name field), so the callable
  // name-candidate operation and this native search cannot drift apart.
  const nameTerms = prepareNameTerms(q);
  if (nameTerms.terms.length === 0) {
    return { results: [], state, mode: "name" };
  }

  // Cap candidate set early so a broad name cannot pin the pool client.
  const candidateCap = Math.min(Math.max(limit * 8, 80), 200);
  // $1 sources, $2 limit, $3 cap; entity $4-$5 only when wantEntity; then work filters; then name params.
  // Issuing jurisdiction is source_system. home_state is the business address and is not required.
  const workStart = wantEntity ? 6 : 4;
  const workExtra = workFilter
    ? workFilterSql(workFilter, workStart)
    : { sql: "", params: [] as unknown[] };

  const baseParams: unknown[] = [licenseSourcesFor(state), limit, candidateCap];
  if (wantEntity) {
    baseParams.push(state.entitySource, MIN_SUNBIZ_CONFIDENCE); // $4-$5
  }
  baseParams.push(...workExtra.params);
  const nameMatch = buildNameMatchSql(nameTerms, baseParams.length + 1);
  baseParams.push(...nameMatch.params);

  const rows = await db.query<{
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
    primary_status: string | null;
    last_verified_at: Date | null;
    source_system: string | null;
    secondary_status: string | null;
    entity_status: string | null;
    entity_name: string | null;
    has_discipline: boolean;
  }>(
    `
    WITH per_contractor AS (
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
        l.primary_status,
        l.last_verified_at,
        l.source_system,
        l.secondary_status,
        ${nameMatch.rankSql} AS rank_score
      FROM ${nameMatch.fromSql}
      JOIN licenses l ON l.contractor_id = c.id AND l.source_system = ANY($1::text[])
      WHERE c.is_thin_profile = FALSE
        AND ${nameMatch.predicateSql}
        ${workExtra.sql}
      ORDER BY c.id,
        CASE l.status_normalized WHEN 'active' THEN 0 WHEN 'current' THEN 1 ELSE 2 END,
        l.updated_at DESC NULLS LAST
    ),
    matched AS (
      SELECT *
      FROM per_contractor
      ORDER BY rank_score,
        CASE occupation_code WHEN 'TRMP' THEN 0 WHEN 'TMP' THEN 1 ELSE 2 END,
        display_name
      LIMIT $3
    )
    SELECT
      m.*,
      ${
        wantEntity
          ? `e.status AS entity_status,
      e.legal_name AS entity_name,`
          : `NULL::text AS entity_status,
      NULL::text AS entity_name,`
      }
      EXISTS (
        SELECT 1 FROM discipline_actions d
        WHERE d.contractor_id = m.id AND ${PUBLIC_REGULATORY_SQL}
      ) AS has_discipline
    FROM matched m
    ${
      wantEntity
        ? `LEFT JOIN LATERAL (
      SELECT ent.status, ent.legal_name
      FROM contractor_entities ce
      JOIN entities ent ON ent.id = ce.entity_id
      WHERE ce.contractor_id = m.id
        AND ce.role IN ('sunbiz_entity', 'linked', 'entity')
        AND ent.source_system = $4
        AND ce.confidence IS NOT NULL
        AND ce.confidence >= $5
      ORDER BY ce.confidence DESC NULLS LAST
      LIMIT 1
    ) e ON TRUE`
        : ""
    }
    ORDER BY m.rank_score,
      CASE m.occupation_code WHEN 'TRMP' THEN 0 WHEN 'TMP' THEN 1 ELSE 2 END,
      m.display_name
    LIMIT $2
    `,
    baseParams
  );

  return {
    mode: "name",
    state,
    results: rows.map(mapSearchRow),
  };
}

function mapSearchRow(r: {
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
  primary_status?: string | null;
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
    primaryStatus: r.primary_status || null,
    entityStatus: r.entity_status,
    entityName: r.entity_name,
    hasDiscipline: r.has_discipline,
    lastVerifiedAt: r.last_verified_at ? r.last_verified_at.toISOString() : null,
    sourceSystem: r.source_system || null,
    secondaryStatus: r.secondary_status || null,
  };
}

/** Map contractor home_state / license source to evidence state slug. */
function evidenceSlugForContractor(
  homeState: string | null | undefined,
  preferredSlug?: string
): string {
  // Prefer the contractor's home state so TX/NJ profiles work even when callers pass "fl".
  const hs = (homeState || "").toUpperCase();
  if (hs === "TX") return "tx";
  if (hs === "NJ") return "nj";
  if (hs === "OR") return "or";
  if (hs === "CA") return "ca";
  if (hs === "WA") return "wa";
  if (hs === "AZ") return "az";
  if (hs === "LA") return "la";
  if (hs === "MS") return "ms";
  if (hs === "KY") return "ky";
  if (hs === "WI") return "wi";
  if (hs === "FL") return "fl";
  if (preferredSlug && getStateBySlug(preferredSlug)?.live) {
    return preferredSlug.toLowerCase();
  }
  return preferredSlug?.toLowerCase() || DEFAULT_STATE_SLUG;
}

async function getContractorBySlugUncached(
  slug: string,
  stateSlug = "fl"
): Promise<ContractorDetail | null> {
  const c = await queryOne<{
    id: string;
    slug: string;
    display_name: string;
    legal_name: string | null;
    dba_name: string | null;
    primary_city: string | null;
    primary_county: string | null;
    home_state: string | null;
    is_thin_profile: boolean;
  }>(
    `
    SELECT id, slug, display_name, legal_name, dba_name,
           primary_city, primary_county, home_state, is_thin_profile
    FROM contractors
    WHERE slug = $1
    LIMIT 1
    `,
    [slug]
  );

  if (!c) return null;

  const resolvedSlug = evidenceSlugForContractor(c.home_state, stateSlug);
  const state = getStateBySlug(resolvedSlug);
  if (!state?.live) return null;

  const licenses = await query<{
    id: string;
    external_key: string;
    occupation_code: string;
    license_number: string | null;
    status_normalized: string | null;
    primary_status: string | null;
    secondary_status: string | null;
    original_licensure_date: Date | null;
    effective_date: Date | null;
    expiration_date: Date | null;
    address_line_1: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    county_name: string | null;
    board_number: string | null;
    last_verified_at: Date | null;
    source_system: string;
  }>(
    `
    SELECT id, external_key, occupation_code, license_number, status_normalized,
           primary_status, secondary_status, original_licensure_date, effective_date,
           expiration_date, address_line_1, city, state, postal_code, county_name,
           board_number, last_verified_at, source_system
    FROM licenses
    WHERE contractor_id = $1
    ORDER BY
      CASE status_normalized WHEN 'active' THEN 0 WHEN 'current' THEN 1 ELSE 2 END,
      external_key
    `,
    [c.id]
  );

  const entities = await query<{
    id: string;
    external_key: string;
    legal_name: string;
    status: string | null;
    entity_type: string | null;
    formation_date: Date | null;
    principal_address: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    registered_agent_name: string | null;
    officers: unknown;
    match_method: string | null;
    confidence: string | null;
    last_verified_at: Date | null;
    source_system: string;
  }>(
    `
    SELECT e.id, e.external_key, e.legal_name, e.status, e.entity_type,
           e.formation_date, e.principal_address, e.city, e.state, e.postal_code,
           e.registered_agent_name, e.officers, ce.match_method, ce.confidence,
           e.last_verified_at, e.source_system
    FROM contractor_entities ce
    JOIN entities e ON e.id = ce.entity_id
    WHERE ce.contractor_id = $1
      AND ce.role IN ('sunbiz_entity', 'linked', 'entity')
      AND e.source_system = $2
      AND ce.confidence IS NOT NULL
      AND ce.confidence >= $3
    ORDER BY ce.confidence DESC NULLS LAST
    `,
    [c.id, state.entitySource, MIN_SUNBIZ_CONFIDENCE]
  );

  const discipline = await query<{
    id: string;
    complaint_number: string | null;
    license_type: string | null;
    classification: string | null;
    disposition: string | null;
    disposition_date: Date | null;
    discipline_description: string | null;
    violation_code: string | null;
    entered_date: Date | null;
    source_dataset: string;
    last_verified_at: Date | null;
  }>(
    `
    SELECT id, complaint_number, license_type, classification, disposition,
           disposition_date, discipline_description, violation_code, entered_date,
           source_dataset, last_verified_at
    FROM discipline_actions d
    WHERE d.contractor_id = $1
      AND ${PUBLIC_REGULATORY_SQL}
    ORDER BY disposition_date DESC NULLS LAST, entered_date DESC NULLS LAST
    LIMIT 50
    `,
    [c.id]
  );

  const licenseDetails: LicenseDetail[] = licenses.map((l) => ({
    id: l.id,
    externalKey: l.external_key,
    occupationCode: l.occupation_code,
    licenseNumber: l.license_number,
    statusNormalized: asLicenseStatus(l.status_normalized),
    primaryStatus: l.primary_status,
    secondaryStatus: l.secondary_status,
    originalLicensureDate: l.original_licensure_date?.toISOString() ?? null,
    effectiveDate: l.effective_date?.toISOString() ?? null,
    expirationDate: l.expiration_date?.toISOString() ?? null,
    addressLine1: l.address_line_1,
    city: l.city,
    state: l.state,
    postalCode: l.postal_code,
    countyName: l.county_name,
    boardNumber: l.board_number,
    lastVerifiedAt: l.last_verified_at?.toISOString() ?? null,
    sourceSystem: l.source_system,
  }));

  const entityDetails: EntityDetail[] = entities.map((e) => ({
    id: e.id,
    externalKey: e.external_key,
    legalName: e.legal_name,
    status: e.status,
    entityType: e.entity_type,
    formationDate: e.formation_date?.toISOString() ?? null,
    principalAddress: e.principal_address,
    city: e.city,
    state: e.state,
    postalCode: e.postal_code,
    registeredAgentName: e.registered_agent_name,
    officers: Array.isArray(e.officers)
      ? (e.officers as EntityDetail["officers"])
      : [],
    matchMethod: e.match_method,
    matchConfidence: e.confidence != null ? Number(e.confidence) : null,
    lastVerifiedAt: e.last_verified_at?.toISOString() ?? null,
    sourceSystem: e.source_system,
  }));

  const disciplineDetails: DisciplineDetail[] = discipline.map((d) => ({
    id: d.id,
    complaintNumber: d.complaint_number,
    licenseType: d.license_type,
    classification: d.classification,
    disposition: d.disposition,
    dispositionDate: d.disposition_date?.toISOString() ?? null,
    disciplineDescription: d.discipline_description,
    violationCode: d.violation_code,
    enteredDate: d.entered_date?.toISOString() ?? null,
    sourceDataset: d.source_dataset,
    lastVerifiedAt: d.last_verified_at?.toISOString() ?? null,
  }));

  return {
    id: c.id,
    slug: c.slug,
    displayName: c.display_name,
    legalName: c.legal_name,
    dbaName: c.dba_name,
    primaryCity: c.primary_city,
    primaryCounty: c.primary_county,
    homeState: c.home_state,
    isThinProfile: c.is_thin_profile,
    licenses: licenseDetails,
    entities: entityDetails,
    discipline: disciplineDetails,
  };
}

/** Cached per-request so generateMetadata + page share one load. */
export const getContractorBySlug = cache(getContractorBySlugUncached);

export async function countSearchableContractorSlugs(
  stateSlug = "fl"
): Promise<number> {
  const state = getStateBySlug(stateSlug);
  if (!state?.live) return 0;
  try {
    const row = await queryOne<{ n: string }>(
      `
      SELECT COUNT(*)::text AS n
      FROM contractors c
      WHERE c.is_thin_profile = FALSE
        AND c.slug IS NOT NULL
        AND c.slug <> ''
        AND (
          c.home_state = $1
          OR EXISTS (
            SELECT 1 FROM licenses l
            WHERE l.contractor_id = c.id AND l.source_system = ANY($2::text[])
          )
        )
      `,
      [state.code, licenseSourcesFor(state)]
    );
    return row ? Number(row.n) : 0;
  } catch {
    return 0;
  }
}

export async function listSearchableContractorSlugs(options: {
  stateSlug?: string;
  limit: number;
  offset: number;
}): Promise<{ slug: string; updatedAt: string | null }[]> {
  const state = getStateBySlug(options.stateSlug || "fl");
  if (!state?.live) return [];
  try {
    const rows = await query<{ slug: string; updated_at: Date | null }>(
      `
      SELECT c.slug, c.updated_at
      FROM contractors c
      WHERE c.is_thin_profile = FALSE
        AND c.slug IS NOT NULL
        AND c.slug <> ''
        AND (
          c.home_state = $1
          OR EXISTS (
            SELECT 1 FROM licenses l
            WHERE l.contractor_id = c.id AND l.source_system = ANY($2::text[])
          )
        )
      ORDER BY c.slug
      LIMIT $3 OFFSET $4
      `,
      [state.code, licenseSourcesFor(state), options.limit, options.offset]
    );
    return rows.map((r) => ({
      slug: r.slug,
      updatedAt: r.updated_at ? r.updated_at.toISOString() : null,
    }));
  } catch {
    return [];
  }
}
