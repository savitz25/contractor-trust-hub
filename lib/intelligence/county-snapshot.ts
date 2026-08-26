/**
 * Contractor County Intelligence snapshot — cached aggregation for
 * /florida/broward and /florida/palm-beach. Living numbers come from SQL.
 */
import "server-only";
import { unstable_cache } from "next/cache";
import { query, queryOne } from "@/lib/db";
import { FLORIDA_COUNTY_INTEL_CATALOG } from "./county-catalog";
import {
  buildCountyIntelligencePayload,
  CTH_FL_COUNTY_INTEL_VERSION,
  type CountyLiveCounts,
  type CountyMoveLikePayload,
} from "./county-payload";
import { isFloridaCountyIntelSlug, type FloridaCountyIntelSlug } from "./coverage";

export type { CountyMoveLikePayload } from "./county-payload";
export { CTH_FL_COUNTY_INTEL_VERSION, publicCountyMetrics } from "./county-payload";

const REVALIDATE_SEC = 1_800;
const TIMEOUT_MS = 12_000;

function iso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

async function loadLive(slug: FloridaCountyIntelSlug): Promise<CountyMoveLikePayload> {
  const generatedAt = new Date().toISOString();
  const catalog = FLORIDA_COUNTY_INTEL_CATALOG[slug];
  const code = catalog.dbprCountyCode;

  const stats = await queryOne<{
    tracked: string;
    active: string;
    trade_tracked: string;
    trade_active: string;
    last_verified_at: Date | string | null;
  }>(
    `
      SELECT
        COUNT(*)::text AS tracked,
        COUNT(*) FILTER (WHERE status_normalized = 'active')::text AS active,
        COUNT(*) FILTER (
          WHERE UPPER(COALESCE(occupation_code, '')) NOT IN ('FRO', 'CRS1', 'PVDR')
        )::text AS trade_tracked,
        COUNT(*) FILTER (
          WHERE status_normalized = 'active'
            AND UPPER(COALESCE(occupation_code, '')) NOT IN ('FRO', 'CRS1', 'PVDR')
        )::text AS trade_active,
        MAX(last_verified_at) AS last_verified_at
      FROM licenses
      WHERE source_system = 'fl_dbpr'
        AND TRIM(COALESCE(county_code, '')) = $1
      `,
    [code]
  );
  const occRows = await query<{ occupation_code: string; tracked: string; active: string }>(
    `
      SELECT UPPER(COALESCE(occupation_code, '')) AS occupation_code,
             COUNT(*)::text AS tracked,
             COUNT(*) FILTER (WHERE status_normalized = 'active')::text AS active
      FROM licenses
      WHERE source_system = 'fl_dbpr'
        AND TRIM(COALESCE(county_code, '')) = $1
        AND UPPER(COALESCE(occupation_code, '')) NOT IN ('FRO', 'CRS1', 'PVDR')
      GROUP BY 1
      `,
    [code]
  );
  const jurisRows = await query<{ kind: string; n: string }>(
    `
      SELECT kind, COUNT(*)::text AS n
      FROM enhanced_jurisdictions
      WHERE county_slug = $1
      GROUP BY kind
      `,
    [slug]
  ).catch(() => null);

  const counts: CountyLiveCounts = {
    tracked: stats?.tracked != null ? Number(stats.tracked) : null,
    active: stats?.active != null ? Number(stats.active) : null,
    tradeTracked: stats?.trade_tracked != null ? Number(stats.trade_tracked) : null,
    tradeActive: stats?.trade_active != null ? Number(stats.trade_active) : null,
    asOf: iso(stats?.last_verified_at),
    occupationRows: occRows.map((r) => ({
      occupation_code: r.occupation_code,
      tracked: Number(r.tracked) || 0,
      active: Number(r.active) || 0,
    })),
    jurisdictionRows: jurisRows
      ? jurisRows.map((r) => ({ kind: r.kind, n: Number(r.n) || 0 }))
      : null,
    permitRows: 0,
    localCredentialRows: 0,
    contactRows: null,
    sourceFileRows: 0,
  };

  return buildCountyIntelligencePayload({
    countySlug: slug,
    generatedAt,
    timedOut: false,
    counts,
  });
}

function emptyTimedOut(slug: FloridaCountyIntelSlug): CountyMoveLikePayload {
  return buildCountyIntelligencePayload({
    countySlug: slug,
    generatedAt: new Date().toISOString(),
    timedOut: true,
    counts: null,
  });
}

export async function getFloridaCountyIntelligenceSnapshot(
  countySlug: string
): Promise<CountyMoveLikePayload> {
  if (!isFloridaCountyIntelSlug(countySlug)) {
    throw new Error(`County Intelligence is only defined for Broward and Palm Beach: ${countySlug}`);
  }
  const cached = unstable_cache(
    () => loadLive(countySlug),
    ["cth-fl-county-intel-v1b", countySlug],
    {
      revalidate: REVALIDATE_SEC,
      tags: ["florida-county-intelligence", `florida-county-intelligence-${countySlug}`],
    }
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timed = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("county-intel-timeout")), TIMEOUT_MS);
    });
    return await Promise.race([cached(), timed]);
  } catch {
    return emptyTimedOut(countySlug);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
