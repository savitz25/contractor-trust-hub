/**
 * Florida browse listings: evidence filters, disclosed sort, Sunbiz firm roll-up.
 * AZ/OR/WA keep listDiscoveryContractors unchanged.
 */

import { cache } from "react";
import { query } from "@/lib/db";
import { displayCounty } from "@/lib/contractors/county-display";
import { asLicenseStatus } from "@/lib/contractors/format";
import type { SearchResult } from "@/lib/contractors/types";
import { getStateBySlug } from "@/lib/states/config";
import { PUBLIC_REGULATORY_SQL } from "@/lib/regulatory/publication";
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

/**
 * A Florida directory read failed (statement timeout, pool/connect timeout,
 * SQL error). It is NOT an empty directory: callers must never render it as
 * "No matches". Pages let it propagate so the response is a non-200 error
 * instead of an indexable empty listing (FL-DIR-PERF-001).
 */
export class FloridaDirectoryUnavailableError extends Error {
  readonly op: string;
  constructor(op: string, cause: unknown) {
    super(`${op} failed: directory data unavailable`, { cause });
    this.name = "FloridaDirectoryUnavailableError";
    this.op = op;
  }
}

export function isFloridaDirectoryUnavailableError(
  err: unknown
): err is FloridaDirectoryUnavailableError {
  return err instanceof FloridaDirectoryUnavailableError;
}

type FloridaBrowseRow = {
  firms: string;
  active_firms: string;
  linked: string;
  disc: string;
  /** NULL on the single stats-only row (zero results or a page past the end). */
  page_pos: string | null;
  id: string | null;
  slug: string | null;
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
  firm_key: string | null;
  siblings: Array<{
    slug: string;
    display_name: string;
    occupation_code: string | null;
    external_key: string | null;
    status_normalized: string | null;
  }> | null;
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
    w += ` AND EXISTS (SELECT 1 FROM discipline_actions d WHERE d.contractor_id = c.id AND ${PUBLIC_REGULATORY_SQL})`;
  } else if (browse.discipline === "none") {
    w += ` AND NOT EXISTS (SELECT 1 FROM discipline_actions d WHERE d.contractor_id = c.id AND ${PUBLIC_REGULATORY_SQL})`;
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
            SELECT 1 FROM discipline_actions d
            WHERE d.contractor_id = c.id AND ${PUBLIC_REGULATORY_SQL}
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
      keyed AS MATERIALIZED (
        SELECT
          m.*,
          COALESCE(m.entity_id::text, 'solo:' || m.id::text) AS firm_key
        FROM matched m
      )
    `;

    // FL-DIR-PERF-002: one statement instead of three. The stats, the page
    // and the sibling roll-up used to re-run the whole `matched` CTE in three
    // separate queries (three full evaluations per render, each with its own
    // statement budget, queued on a max:1 pool). Here `keyed` is MATERIALIZED
    // once and every part reads it. Same filters, same firm roll-up, same
    // sort keys; `p.firm_key` is only a tie-break so ROW_NUMBER() and the
    // final ORDER BY agree and pages never overlap or skip a firm.
    const limit = DISCOVERY_PAGE_SIZE;
    const offset = (browse.page - 1) * limit;
    const offsetIdx = filterParams.length + 1;
    const limitIdx = filterParams.length + 2;
    const listParams = [...filterParams, offset, limit];

    const rows = await query<FloridaBrowseRow>(
      `
      WITH ${matchedCte},
      stats AS (
        SELECT
          COUNT(DISTINCT firm_key)::text AS firms,
          COUNT(DISTINCT firm_key) FILTER (
            WHERE status_normalized IN ('active', 'current')
          )::text AS active_firms,
          COUNT(DISTINCT firm_key) FILTER (WHERE entity_id IS NOT NULL)::text AS linked,
          COUNT(DISTINCT firm_key) FILTER (WHERE has_discipline)::text AS disc
        FROM keyed
      ),
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
          k.display_name,
          -- tie-break only: one contractor with two same-status licenses
          -- used to show an arbitrary license as the card's primary key.
          k.external_key
      ),
      ranked AS (
        SELECT p.*,
          ROW_NUMBER() OVER (ORDER BY ${sortSql(browse.sort)}, p.firm_key) AS page_pos
        FROM picked p
        JOIN firm_agg a ON a.firm_key = p.firm_key
      ),
      page AS (
        SELECT * FROM ranked
        WHERE page_pos > $${offsetIdx}::int
          AND page_pos <= $${offsetIdx}::int + $${limitIdx}::int
      ),
      sibs AS (
        SELECT k.firm_key,
          json_agg(json_build_object(
            'slug', k.slug,
            'display_name', k.display_name,
            'occupation_code', k.occupation_code,
            'external_key', k.external_key,
            'status_normalized', k.status_normalized
          )) AS siblings
        FROM keyed k
        WHERE k.firm_key IN (SELECT firm_key FROM page)
        GROUP BY k.firm_key
      )
      SELECT
        s.firms, s.active_firms, s.linked, s.disc,
        pg.page_pos, pg.id, pg.slug, pg.display_name, pg.legal_name, pg.dba_name,
        pg.primary_city, pg.primary_county, pg.home_state, pg.external_key,
        pg.occupation_code, pg.status_normalized, pg.primary_status,
        pg.last_verified_at, pg.source_system, pg.secondary_status,
        pg.entity_id, pg.entity_name, pg.entity_status, pg.has_discipline,
        pg.firm_key, sb.siblings
      FROM stats s
      LEFT JOIN page pg ON TRUE
      LEFT JOIN sibs sb ON sb.firm_key = pg.firm_key
      ORDER BY pg.page_pos
      `,
      listParams
    );

    // The stats CTE always yields exactly one row, so a successful read
    // returns >= 1 row. Zero rows means the read did not complete.
    const statsRow = rows[0];
    if (!statsRow) {
      throw new Error("listFloridaBrowse: stats row missing (incomplete read)");
    }
    const stats: FloridaBrowseStats = {
      firms: Number(statsRow.firms || 0),
      activeFirms: Number(statsRow.active_firms || 0),
      entityLinked: Number(statsRow.linked || 0),
      withDiscipline: Number(statsRow.disc || 0),
    };
    const total = stats.firms;
    if (total === 0) return { results: [], total: 0, stats };

    const firmRows = rows.filter(
      (r): r is FloridaBrowseRow & { id: string; slug: string; firm_key: string } =>
        r.page_pos !== null && Boolean(r.id) && Boolean(r.firm_key)
    );

    const relatedByFirm = new Map<string, RelatedProfile[]>();
    for (const r of firmRows) {
      for (const s of r.siblings || []) {
        const list = relatedByFirm.get(r.firm_key) || [];
        if (!list.some((x) => x.slug === s.slug && x.licenseKey === s.external_key)) {
          list.push({
            slug: s.slug,
            displayName: s.display_name,
            occupationCode: s.occupation_code,
            licenseKey: s.external_key,
            licenseStatus: asLicenseStatus(s.status_normalized),
          });
        }
        relatedByFirm.set(r.firm_key, list);
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
        county: displayCounty(r.primary_county, r.home_state),
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
    // Never turn a failed or partial read into an empty directory. A real
    // zero-result query returns above with total 0; a failure throws.
    throw new FloridaDirectoryUnavailableError("listFloridaBrowse", err);
  }
}

type FloridaBrowseOpts = Parameters<typeof listFloridaBrowse>[0];

/**
 * Request-scoped identity of a listFloridaBrowse read. Two calls with the same
 * key run the same SQL with the same parameters (county/trade come from the
 * curated config by slug; the path city wins over ?city= exactly as inside
 * listFloridaBrowse).
 */
export function floridaBrowseRequestKey(opts: FloridaBrowseOpts): string {
  const b = opts.browse;
  return JSON.stringify([
    opts.county?.slug ?? null,
    opts.trade?.slug ?? null,
    opts.pathCitySlug || b.citySlug || null,
    b.status,
    b.entity,
    b.discipline,
    b.tenure,
    b.sort,
    b.page,
  ]);
}

/** One Map per server request (React cache); a fresh Map outside a request. */
const floridaBrowseRequestStore = cache(
  () => new Map<string, ReturnType<typeof listFloridaBrowse>>()
);

/**
 * FL-DIR-PERF-003: per-instance memo of FAILED directory reads only.
 * Next re-renders a page that threw (the error pass gets a fresh React cache
 * store), and crawler bursts repeat the same URL within seconds. Without this
 * memo each repeat re-ran an 8 s statement on the single pooled client.
 * Successes are never memoised (no stale data); a failure is reused for at
 * most FAILURE_MEMO_TTL_MS for the exact same request key in this instance.
 */
export const FLORIDA_FAILURE_MEMO_TTL_MS = 15_000;
const FAILURE_MEMO_MAX = 256;
const floridaBrowseFailureMemo = new Map<string, { cause: unknown; until: number }>();

function memoFailure(key: string, cause: unknown, now = Date.now()): void {
  if (floridaBrowseFailureMemo.size >= FAILURE_MEMO_MAX) {
    for (const [k, v] of floridaBrowseFailureMemo) {
      if (v.until <= now) floridaBrowseFailureMemo.delete(k);
    }
    while (floridaBrowseFailureMemo.size >= FAILURE_MEMO_MAX) {
      const oldest = floridaBrowseFailureMemo.keys().next().value;
      if (oldest === undefined) break;
      floridaBrowseFailureMemo.delete(oldest);
    }
  }
  floridaBrowseFailureMemo.set(key, { cause, until: now + FLORIDA_FAILURE_MEMO_TTL_MS });
}

function recentFailure(key: string, now = Date.now()): { cause: unknown } | null {
  const hit = floridaBrowseFailureMemo.get(key);
  if (!hit) return null;
  if (hit.until <= now) {
    floridaBrowseFailureMemo.delete(key);
    return null;
  }
  return hit;
}

/** Test hooks (never needed at runtime). */
export function resetFloridaFailureMemoForTests(): void {
  floridaBrowseFailureMemo.clear();
}
export function floridaFailureMemoSizeForTests(): number {
  return floridaBrowseFailureMemo.size;
}

/**
 * FL-DIR-PERF-002: listFloridaBrowse, de-duplicated within one request.
 * /florida/{county}/{city}/{trade} reads the same directory in
 * generateMetadata (thin check) and in the page body. Sharing the promise
 * halves that route's directory SQL. A failed read is shared too, so the
 * metadata (noindex) and the page (error, not "No matches") stay consistent.
 * FL-DIR-PERF-003: every Florida directory route uses this, and a failure is
 * remembered per instance for FLORIDA_FAILURE_MEMO_TTL_MS (no SQL on repeat).
 */
export function listFloridaBrowseOnce(
  opts: FloridaBrowseOpts
): ReturnType<typeof listFloridaBrowse> {
  const store = floridaBrowseRequestStore();
  const key = floridaBrowseRequestKey(opts);
  let pending = store.get(key);
  if (!pending) {
    const recent = recentFailure(key);
    if (recent) {
      console.warn("[discovery] listFloridaBrowse skipped: same read failed in this instance <15 s ago");
      pending = Promise.reject(
        new FloridaDirectoryUnavailableError("listFloridaBrowse (recent failure)", recent.cause)
      );
    } else {
      pending = listFloridaBrowse(opts).catch((err: unknown) => {
        if (isFloridaDirectoryUnavailableError(err)) memoFailure(key, err.cause);
        throw err;
      });
    }
    store.set(key, pending);
  }
  return pending;
}

/**
 * A facet (side list) read. ok:false means the read FAILED: callers must not
 * render it as a real "no cities / no trades" list on an indexable page.
 */
export type FloridaFacetResult =
  | { ok: true; facets: DiscoveryFacet[] }
  | { ok: false; facets: DiscoveryFacet[] };

/** Legacy shape (failure collapses to []); Florida routes use listFloridaCitiesChecked. */
export async function listFloridaCities(
  county: CountyDef,
  trade?: TradeDef | null
): Promise<DiscoveryFacet[]> {
  return (await listFloridaCitiesChecked(county, trade)).facets;
}

/**
 * FL-DIR-PERF-003: city facet read that reports failure explicitly instead of
 * returning an empty list that looks like "no cities".
 */
export async function listFloridaCitiesChecked(
  county: CountyDef,
  trade?: TradeDef | null
): Promise<FloridaFacetResult> {
  const disc = getDiscoveryState(PUBLIC);
  if (!disc) return { ok: true, facets: [] };
  const state = getStateBySlug(disc.evidenceSlug);
  if (!state?.live) return { ok: true, facets: [] };

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
    const facets = rows
      .map((r) => {
        const slug = cityToSlug(r.city);
        if (!slug) return null;
        return { slug, label: cityLabelFromSlug(slug), count: Number(r.n) };
      })
      .filter((x): x is DiscoveryFacet => Boolean(x));
    return { ok: true, facets };
  } catch (err) {
    console.error(
      "[discovery] listFloridaCities failed:",
      err instanceof Error ? err.message : err
    );
    return { ok: false, facets: [] };
  }
}
