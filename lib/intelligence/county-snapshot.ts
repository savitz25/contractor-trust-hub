/**
 * Contractor County Intelligence snapshot — cached aggregation for
 * /florida/{county} County Intelligence. Living numbers come from SQL.
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
const TIMEOUT_MS = 20_000;

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

  const statsP = queryOne<{
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
  const occP = query<{ occupation_code: string; tracked: string; active: string }>(
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
  const jurisP = query<{ kind: string; n: string }>(
    `
      SELECT kind, COUNT(*)::text AS n
      FROM enhanced_jurisdictions
      WHERE county_slug = $1
      GROUP BY kind
      `,
    [slug]
  ).catch(() => null);

  const permitP =
    slug === "miami-dade"
      ? queryOne<{
          source_rows: string;
          confirmed: string;
          last12: string;
          distinct_licenses: string;
          unincorporated: string;
          associated_review: string;
          with_valuation: string;
          recorded_valuation: string | null;
          contacts: string;
          contact_licenses: string;
        }>(
          `
      SELECT
        (SELECT COUNT(*) FROM permit_source_records
          WHERE county_slug = 'miami-dade' AND source_system = 'mdc_opendata_issued')::text AS source_rows,
        COUNT(*)::text AS confirmed,
        COUNT(*) FILTER (WHERE p.issue_date >= (CURRENT_DATE - INTERVAL '12 months'))::text AS last12,
        COUNT(DISTINCT a.matched_license_id)::text AS distinct_licenses,
        COUNT(*) FILTER (WHERE p.source_jurisdiction = 'unincorporated')::text AS unincorporated,
        COUNT(*) FILTER (WHERE p.source_jurisdiction = 'associated_county_review')::text AS associated_review,
        COUNT(*) FILTER (WHERE p.valuation IS NOT NULL)::text AS with_valuation,
        SUM(p.valuation) FILTER (WHERE p.valuation IS NOT NULL)::text AS recorded_valuation,
        (SELECT COUNT(*) FROM public_contact_observations
          WHERE source_system = 'mdc_opendata_issued'
            AND attribution_class = 'CONFIRMED'
            AND is_agency_number = false)::text AS contacts,
        (SELECT COUNT(DISTINCT attributed_license_id) FROM public_contact_observations
          WHERE source_system = 'mdc_opendata_issued'
            AND attribution_class = 'CONFIRMED'
            AND attributed_license_id IS NOT NULL)::text AS contact_licenses
      FROM permit_attributions a
      JOIN permit_source_records p ON p.id = a.permit_source_record_id
      WHERE a.identity_state = 'CONFIRMED'
        AND p.county_slug = 'miami-dade'
        AND p.source_system = 'mdc_opendata_issued'
      `,
          [],
          { statementTimeoutMs: 15_000 }
        ).catch(() => null)
      : Promise.resolve(null);

  const floridaP = queryOne<{
    tracked: string;
    active: string;
    roofing: string;
    general: string;
  }>(
    `
      SELECT
        COUNT(*)::text AS tracked,
        COUNT(*) FILTER (WHERE status_normalized = 'active')::text AS active,
        COUNT(*) FILTER (WHERE UPPER(COALESCE(occupation_code, '')) IN ('CCC', 'RR'))::text AS roofing,
        COUNT(*) FILTER (WHERE UPPER(COALESCE(occupation_code, '')) = 'CGC')::text AS general
      FROM licenses
      WHERE source_system = 'fl_dbpr'
      `
  ).catch(() => null);

  const [stats, occRows, jurisRows, ev, fl] = await Promise.all([
    statsP,
    occP,
    jurisP,
    permitP,
    floridaP,
  ]);

  let permitEvidence: CountyLiveCounts["permitEvidence"] = null;
  if (ev) {
    permitEvidence = {
      sourceRows: Number(ev.source_rows) || 0,
      confirmed: Number(ev.confirmed) || 0,
      confirmedLast12Months: Number(ev.last12) || 0,
      distinctLicenses: Number(ev.distinct_licenses) || 0,
      unincorporated: Number(ev.unincorporated) || 0,
      associatedReview: Number(ev.associated_review) || 0,
      withValuation: Number(ev.with_valuation) || 0,
      recordedValuation: ev.recorded_valuation != null ? Number(ev.recorded_valuation) : null,
      contactObservations: Number(ev.contacts) || 0,
      contactDistinctLicenses: Number(ev.contact_licenses) || 0,
    };
  }

  const counts: CountyLiveCounts = {
    tracked: stats?.tracked != null ? Number(stats.tracked) : null,
    active: stats?.active != null ? Number(stats.active) : null,
    tradeTracked: stats?.trade_tracked != null ? Number(stats.trade_tracked) : null,
    tradeActive: stats?.trade_active != null ? Number(stats.trade_active) : null,
    asOf: iso(stats?.last_verified_at),
    floridaTracked: fl?.tracked != null ? Number(fl.tracked) : null,
    floridaActive: fl?.active != null ? Number(fl.active) : null,
    floridaRoofing: fl?.roofing != null ? Number(fl.roofing) : null,
    floridaGeneral: fl?.general != null ? Number(fl.general) : null,
    occupationRows: occRows.map((r) => ({
      occupation_code: r.occupation_code,
      tracked: Number(r.tracked) || 0,
      active: Number(r.active) || 0,
    })),
    jurisdictionRows: jurisRows
      ? jurisRows.map((r) => ({ kind: r.kind, n: Number(r.n) || 0 }))
      : null,
    permitRows: permitEvidence?.sourceRows ?? 0,
    localCredentialRows: 0,
    contactRows: permitEvidence?.contactObservations ?? null,
    sourceFileRows: 0,
    permitEvidence,
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
    throw new Error(`County Intelligence is only defined for cataloged Florida counties: ${countySlug}`);
  }
  const cached = unstable_cache(
    () => loadLive(countySlug),
    ["cth-fl-county-intel-v1c", countySlug],
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
