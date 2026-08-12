import { query, queryOne } from "@/lib/db";
import { asLicenseStatus } from "@/lib/contractors/format";
import type { SearchResult } from "@/lib/contractors/types";
import { getStateBySlug } from "@/lib/states/config";
import {
  getCounty,
  getDiscoveryState,
  getTrade,
} from "./config";
import type { CountyDef, DiscoveryFacet, TradeDef } from "./types";

const MIN_SUNBIZ_CONFIDENCE = 0.9;
export const DISCOVERY_PAGE_SIZE = 24;

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
  };
}

/**
 * Build WHERE clause + params for discovery filters.
 * Param $1 = licenseSource, $2 = state code. Additional filters append from $3.
 */
function buildFilterClause(opts: {
  licenseSource: string;
  stateCode: string;
  occupationCodes?: string[] | null;
  county?: CountyDef | null;
}): { where: string; params: unknown[] } {
  const params: unknown[] = [opts.licenseSource, opts.stateCode];
  let where = `
    l.source_system = $1
    AND c.is_thin_profile = FALSE
    AND (c.home_state = $2 OR l.state = $2)
  `;

  if (opts.occupationCodes?.length) {
    params.push(opts.occupationCodes);
    where += ` AND l.occupation_code = ANY($${params.length}::text[])`;
  }

  if (opts.county?.matchNames.length) {
    const clauses: string[] = [];
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
    where += ` AND (${clauses.join(" OR ")})`;
  }

  return { where, params };
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

  const limit = filters.limit ?? DISCOVERY_PAGE_SIZE;
  const offset = filters.offset ?? 0;

  const { where, params: filterParams } = buildFilterClause({
    licenseSource: state.licenseSource,
    stateCode: state.code,
    occupationCodes: filters.trade?.occupationCodes ?? null,
    county: filters.county ?? null,
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
        l.last_verified_at
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
        SELECT 1 FROM discipline_actions d WHERE d.contractor_id = p.id
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

export async function countByTrade(
  publicStateSlug: string,
  county?: CountyDef | null
): Promise<DiscoveryFacet[]> {
  const disc = getDiscoveryState(publicStateSlug);
  if (!disc) return [];

  // Parallel trade counts for a fixed county (bounded set of trades)
  const facets = await Promise.all(
    disc.trades.map(async (trade) => {
      const { total } = await listDiscoveryContractors({
        publicStateSlug,
        county: county ?? null,
        trade,
        limit: 1,
        offset: 0,
      });
      return { slug: trade.slug, label: trade.label, count: total };
    })
  );
  return facets.filter((f) => f.count > 0).sort((a, b) => b.count - a.count);
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

  try {
    const rows = await query<{ county: string; n: string }>(
      `
      SELECT LOWER(TRIM(COALESCE(NULLIF(TRIM(l.county_name), ''), c.primary_county))) AS county,
             COUNT(DISTINCT c.id)::text AS n
      FROM contractors c
      JOIN licenses l ON l.contractor_id = c.id
      WHERE l.source_system = $1
        AND c.is_thin_profile = FALSE
        AND (c.home_state = $2 OR l.state = $2)
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
        AND (c.home_state = $2 OR l.state = $2)
      GROUP BY l.occupation_code
      `,
      [state.licenseSource, state.code]
    );
    const byCode = new Map(rows.map((r) => [r.occupation_code.toUpperCase(), Number(r.n)]));
    return disc.trades
      .map((t) => ({
        slug: t.slug,
        label: t.label,
        count: t.occupationCodes.reduce(
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

export async function countCountiesBatch(publicStateSlug: string): Promise<DiscoveryFacet[]> {
  const disc = getDiscoveryState(publicStateSlug);
  if (!disc) return [];
  const state = getStateBySlug(disc.evidenceSlug);
  if (!state?.live) return [];

  try {
    const rows = await query<{ county: string; n: string }>(
      `
      SELECT LOWER(TRIM(COALESCE(NULLIF(TRIM(l.county_name), ''), c.primary_county))) AS county,
             COUNT(DISTINCT c.id)::text AS n
      FROM contractors c
      JOIN licenses l ON l.contractor_id = c.id
      WHERE l.source_system = $1
        AND c.is_thin_profile = FALSE
        AND (c.home_state = $2 OR l.state = $2)
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
  } catch {
    const results = await Promise.all(
      disc.counties.map(async (county) => {
        const { total } = await listDiscoveryContractors({
          publicStateSlug,
          county,
          limit: 1,
          offset: 0,
        });
        return { slug: county.slug, label: county.name, count: total };
      })
    );
    return results.filter((f) => f.count > 0).sort((a, b) => b.count - a.count);
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
