/**
 * Florida browse listings: evidence filters, disclosed sort, Sunbiz firm roll-up.
 * AZ/OR/WA keep listDiscoveryContractors unchanged.
 */

import { query, queryOne } from "@/lib/db";
import { asLicenseStatus } from "@/lib/contractors/format";
import type { SearchResult } from "@/lib/contractors/types";
import { getStateBySlug } from "@/lib/states/config";
import {
  CITY_INDEX_MIN,
  cityLabelFromSlug,
  cityToSlug,
  type DiscoveryBrowse,
} from "./browse";
import { getDiscoveryState } from "./config";
import { buildFilterClause, DISCOVERY_PAGE_SIZE } from "./queries";
import type { CountyDef, DiscoveryFacet, TradeDef } from "./types";

const MIN_SUNBIZ_CONFIDENCE = 0.9;
const PUBLIC = "florida";

export type RelatedProfile = {
  slug: string;
  displayName: string;
  occupationCode: string | null;
  licenseKey: string | null;
  licenseStatus: SearchResult["licenseStatus"];
};

export type FloridaBrowseStats = {
  firms: number;
  activeFirms: number;
  entityLinked: number;
  withDiscipline: number;
};

function appendBrowseFilters(
  where: string,
  params: unknown[],
  browse: DiscoveryBrowse,
  entitySourceIdx: number,
  confIdx: number
): string {
  let w = where;
  if (browse.citySlug) {
    params.push(browse.citySlug);
    w += `
      AND TRIM(BOTH '-' FROM REGEXP_REPLACE(
        LOWER(TRIM(COALESCE(NULLIF(l.city, ''), c.primary_city, ''))),
        '[^a-z0-9]+', '-', 'g'
      )) = $${params.length}
    `;
  }
  if (browse.status === "active") {
    w += ` AND l.status_normalized IN ('active', 'current')`;
  } else if (browse.status === "inactive") {
    w += ` AND COALESCE(l.status_normalized, '') NOT IN ('active', 'current')`;
  }
  if (browse.tenure === "lt5") {
    w += ` AND l.original_licensure_date > (CURRENT_DATE - INTERVAL '5 years')`;
  } else if (browse.tenure === "5to15") {
    w += ` AND l.original_licensure_date <= (CURRENT_DATE - INTERVAL '5 years')
           AND l.original_licensure_date > (CURRENT_DATE - INTERVAL '15 years')`;
  } else if (browse.tenure === "gt15") {
    w += ` AND l.original_licensure_date <= (CURRENT_DATE - INTERVAL '15 years')`;
  }

  const entitySql = `
    EXISTS (
      SELECT 1 FROM contractor_entities ce
      JOIN entities ent ON ent.id = ce.entity_id
      WHERE ce.contractor_id = c.id
        AND ce.role = 'sunbiz_entity'
        AND ent.source_system = $${entitySourceIdx}::text
        AND ce.confidence IS NOT NULL
        AND ce.confidence >= $${confIdx}::numeric
    )
  `;
  if (browse.entity === "linked") w += ` AND ${entitySql}`;
  if (browse.entity === "unlinked") w += ` AND NOT ${entitySql}`;

  if (browse.discipline === "present") {
    w += ` AND EXISTS (SELECT 1 FROM discipline_actions d WHERE d.contractor_id = c.id)`;
  } else if (browse.discipline === "none") {
    w += ` AND NOT EXISTS (SELECT 1 FROM discipline_actions d WHERE d.contractor_id = c.id)`;
  }
  return w;
}

function sortSql(sort: DiscoveryBrowse["sort"]): string {
  if (sort === "longest") {
    return `a.firm_first_licensed ASC NULLS LAST, p.display_name`;
  }
  if (sort === "updated") {
    return `a.firm_last_verified DESC NULLS LAST, p.display_name`;
  }
  if (sort === "entity") {
    return `CASE WHEN p.entity_id IS NULL THEN 1 ELSE 0 END, p.display_name`;
  }
  return `p.display_name`;
}

export async function listFloridaBrowse(opts: {
  county?: CountyDef | null;
  trade?: TradeDef | null;
  browse: DiscoveryBrowse;
  /** City already in the path — same filter as browse.citySlug */
  pathCitySlug?: string | null;
}): Promise<{ results: SearchResult[]; total: number; stats: FloridaBrowseStats }> {
  const empty = {
    results: [] as SearchResult[],
    total: 0,
    stats: { firms: 0, activeFirms: 0, entityLinked: 0, withDiscipline: 0 },
  };
  const disc = getDiscoveryState(PUBLIC);
  if (!disc) return empty;
  const state = getStateBySlug(disc.evidenceSlug);
  if (!state?.live) return empty;

  const browse: DiscoveryBrowse = {
    ...opts.browse,
    citySlug: opts.pathCitySlug || opts.browse.citySlug,
  };

  try {
    const { where: baseWhere, params: filterParams } = buildFilterClause({
      licenseSource: state.licenseSource,
      stateCode: state.code,
      occupationCodes: opts.trade?.occupationCodes ?? null,
      classCodes: opts.trade?.classCodes ?? null,
      descriptionIncludes: opts.trade?.descriptionIncludes ?? null,
      county: opts.county ?? null,
      activeOnly: false,
      requireInStateAddress: disc.requireInStateAddress,
    });

    const entitySourceIdx = filterParams.length + 1;
    const confIdx = filterParams.length + 2;
    filterParams.push(state.entitySource, MIN_SUNBIZ_CONFIDENCE);

    const where = appendBrowseFilters(
      baseWhere,
      filterParams,
      browse,
      entitySourceIdx,
      confIdx
    );

    const matchedCte = `
      matched AS (
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
          l.original_licensure_date,
          l.last_verified_at,
          l.source_system,
          l.secondary_status,
          ent.id AS entity_id,
          ent.legal_name AS entity_name,
          ent.status AS entity_status,
          EXISTS (
            SELECT 1 FROM discipline_actions d WHERE d.contractor_id = c.id
          ) AS has_discipline
        FROM contractors c
        JOIN licenses l ON l.contractor_id = c.id
        LEFT JOIN LATERAL (
          SELECT e.id, e.legal_name, e.status
          FROM contractor_entities ce
          JOIN entities e ON e.id = ce.entity_id
          WHERE ce.contractor_id = c.id
            AND ce.role = 'sunbiz_entity'
            AND e.source_system = $${entitySourceIdx}::text
            AND ce.confidence IS NOT NULL
            AND ce.confidence >= $${confIdx}::numeric
          ORDER BY ce.confidence DESC NULLS LAST
          LIMIT 1
        ) ent ON TRUE
        WHERE ${where}
      ),
      keyed AS (
        SELECT
          m.*,
          COALESCE(m.entity_id::text, 'solo:' || m.id::text) AS firm_key
        FROM matched m
      )
    `;

    const statsRow = await queryOne<{
      firms: string;
      active_firms: string;
      linked: string;
      disc: string;
    }>(
      `
      WITH ${matchedCte}
      SELECT
        COUNT(DISTINCT firm_key)::text AS firms,
        COUNT(DISTINCT firm_key) FILTER (
          WHERE status_normalized IN ('active', 'current')
        )::text AS active_firms,
        COUNT(DISTINCT firm_key) FILTER (WHERE entity_id IS NOT NULL)::text AS linked,
        COUNT(DISTINCT firm_key) FILTER (WHERE has_discipline)::text AS disc
      FROM keyed
      `,
      filterParams
    );

    const stats: FloridaBrowseStats = {
      firms: Number(statsRow?.firms || 0),
      activeFirms: Number(statsRow?.active_firms || 0),
      entityLinked: Number(statsRow?.linked || 0),
      withDiscipline: Number(statsRow?.disc || 0),
    };
    const total = stats.firms;
    if (total === 0) return { results: [], total: 0, stats };

    const limit = DISCOVERY_PAGE_SIZE;
    const offset = (browse.page - 1) * limit;
    const limitIdx = filterParams.length + 1;
    const offsetIdx = filterParams.length + 2;
    const listParams = [...filterParams, limit, offset];

    const firmRows = await query<{
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
      entity_id: string | null;
      entity_name: string | null;
      entity_status: string | null;
      has_discipline: boolean;
      firm_key: string;
    }>(
      `
      WITH ${matchedCte},
      firm_agg AS (
        SELECT
          firm_key,
          MIN(original_licensure_date) AS firm_first_licensed,
          MAX(last_verified_at) AS firm_last_verified
        FROM keyed
        GROUP BY firm_key
      ),
      picked AS (
        SELECT DISTINCT ON (k.firm_key)
          k.*
        FROM keyed k
        ORDER BY k.firm_key,
          CASE k.status_normalized WHEN 'active' THEN 0 WHEN 'current' THEN 1 ELSE 2 END,
          k.display_name
      )
      SELECT p.*
      FROM picked p
      JOIN firm_agg a ON a.firm_key = p.firm_key
      ORDER BY ${sortSql(browse.sort)}
      LIMIT $${limitIdx}::int OFFSET $${offsetIdx}::int
      `,
      listParams
    );

    const firmKeys = firmRows.map((r) => r.firm_key).filter(Boolean);
    const relatedByFirm = new Map<string, RelatedProfile[]>();
    if (firmKeys.length) {
      const sibParams = [...filterParams, firmKeys];
      const sibIdx = filterParams.length + 1;
      const siblings = await query<{
        firm_key: string;
        id: string;
        slug: string;
        display_name: string;
        occupation_code: string | null;
        external_key: string | null;
        status_normalized: string | null;
      }>(
        `
        WITH ${matchedCte}
        SELECT firm_key, id, slug, display_name, occupation_code, external_key, status_normalized
        FROM keyed
        WHERE firm_key = ANY($${sibIdx}::text[])
        `,
        sibParams
      );
      for (const s of siblings) {
        const list = relatedByFirm.get(s.firm_key) || [];
        if (!list.some((x) => x.slug === s.slug && x.licenseKey === s.external_key)) {
          list.push({
            slug: s.slug,
            displayName: s.display_name,
            occupationCode: s.occupation_code,
            licenseKey: s.external_key,
            licenseStatus: asLicenseStatus(s.status_normalized),
          });
        }
        relatedByFirm.set(s.firm_key, list);
      }
    }

    const results: SearchResult[] = firmRows.map((r) => {
      const related = (relatedByFirm.get(r.firm_key) || []).filter(
        (x) => !(x.slug === r.slug && x.licenseKey === r.external_key)
      );
      const rolledName =
        r.entity_id && related.some((x) => x.slug !== r.slug)
          ? r.entity_name || r.display_name
          : r.display_name;
      return {
        id: r.id,
        slug: r.slug,
        displayName: rolledName,
        legalName: r.legal_name,
        dbaName: r.dba_name,
        city: r.primary_city,
        county: r.primary_county,
        state: r.home_state,
        primaryLicenseKey: r.external_key,
        occupationCode: r.occupation_code,
        licenseStatus: asLicenseStatus(r.status_normalized),
        primaryStatus: r.primary_status,
        entityStatus: r.entity_status,
        entityName: r.entity_name,
        hasDiscipline: r.has_discipline,
        lastVerifiedAt: r.last_verified_at ? r.last_verified_at.toISOString() : null,
        sourceSystem: r.source_system,
        secondaryStatus: r.secondary_status,
        relatedProfiles: related.length ? related : undefined,
      };
    });

    return { results, total, stats };
  } catch (err) {
    console.error(
      "[discovery] listFloridaBrowse failed:",
      err instanceof Error ? err.message : err
    );
    return empty;
  }
}

export async function listFloridaCities(
  county: CountyDef,
  trade?: TradeDef | null
): Promise<DiscoveryFacet[]> {
  const disc = getDiscoveryState(PUBLIC);
  if (!disc) return [];
  const state = getStateBySlug(disc.evidenceSlug);
  if (!state?.live) return [];

  try {
    const { where, params } = buildFilterClause({
      licenseSource: state.licenseSource,
      stateCode: state.code,
      occupationCodes: trade?.occupationCodes ?? null,
      classCodes: trade?.classCodes ?? null,
      descriptionIncludes: trade?.descriptionIncludes ?? null,
      county,
      activeOnly: false,
      requireInStateAddress: disc.requireInStateAddress,
    });
    const rows = await query<{ city: string; n: string }>(
      `
      SELECT
        TRIM(BOTH '-' FROM REGEXP_REPLACE(
          LOWER(TRIM(COALESCE(NULLIF(l.city, ''), c.primary_city, ''))),
          '[^a-z0-9]+', '-', 'g'
        )) AS city,
        COUNT(DISTINCT c.id)::text AS n
      FROM contractors c
      JOIN licenses l ON l.contractor_id = c.id
      WHERE ${where}
        AND TRIM(COALESCE(NULLIF(l.city, ''), c.primary_city, '')) <> ''
      GROUP BY 1
      HAVING COUNT(DISTINCT c.id) >= ${CITY_INDEX_MIN}
      ORDER BY COUNT(DISTINCT c.id) DESC, 1
      LIMIT 24
      `,
      params
    );
    return rows
      .map((r) => {
        const slug = cityToSlug(r.city);
        if (!slug) return null;
        return { slug, label: cityLabelFromSlug(slug), count: Number(r.n) };
      })
      .filter((x): x is DiscoveryFacet => Boolean(x));
  } catch (err) {
    console.error(
      "[discovery] listFloridaCities failed:",
      err instanceof Error ? err.message : err
    );
    return [];
  }
}
