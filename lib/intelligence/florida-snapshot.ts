/**
 * Florida State Intelligence payload — one cached aggregation for /florida.
 * Living numbers come from SQL. UI copy must not embed production counts.
 */

import "server-only";
import { unstable_cache } from "next/cache";
import { query, queryOne } from "@/lib/db";
import { FLORIDA_TRADES } from "@/lib/discovery/trades";
import { discoveryPath, getDiscoveryState } from "@/lib/discovery/config";
import { FLORIDA_CILB_OCCUPATIONS, INTELLIGENCE_TRADE_BUCKETS } from "./occupations";
import { classifyFloridaCountyCode } from "./florida-county-codes";
import { countyResearchCoverage } from "./coverage";
import { FLORIDA_INTELLIGENCE_EDUCATION } from "./education";
import { FLORIDA_SOURCE_CATALOG } from "./source-catalog";
import type { SourceFamily } from "./types";
import type {
  FloridaIntelligencePayload,
  IntelligenceCategory,
  IntelligenceCategorySplit,
  IntelligenceCoverageItem,
  IntelligenceCounty,
  IntelligenceEvidenceSource,
  IntelligenceMetricValue,
} from "./payload-types";

export type {
  FloridaIntelligencePayload,
  IntelligenceCategory,
  IntelligenceCategorySplit,
  IntelligenceCoverageItem,
  IntelligenceCounty,
  IntelligenceEvidenceSource,
  IntelligenceMetricValue,
} from "./payload-types";

export const FL_STATE_INTEL_VERSION = "fl-state-intel-v1";
const REVALIDATE_SEC = 1_800;
const TIMEOUT_MS = 6_000;

const CONSUMER_BUCKETS = [
  "general",
  "building",
  "residential",
  "roofing",
  "hvac_air_conditioning",
  "plumbing",
  "mechanical",
  "pool_spa",
  "underground_utility",
  "specialty_structure",
  "solar",
] as const;

const BUCKET_TO_TRADE_SLUG: Record<(typeof CONSUMER_BUCKETS)[number], string> = {
  general: "general-contractors",
  building: "building-contractors",
  residential: "residential-contractors",
  roofing: "roofers",
  hvac_air_conditioning: "air-conditioning",
  plumbing: "plumbing",
  mechanical: "mechanical",
  pool_spa: "pool-spa",
  underground_utility: "underground-utility",
  specialty_structure: "specialty-structures",
  solar: "solar",
};

const BUCKET_LABEL: Record<(typeof CONSUMER_BUCKETS)[number], string> = {
  general: "General contractor",
  building: "Building contractor",
  residential: "Residential",
  roofing: "Roofing",
  hvac_air_conditioning: "HVAC / air conditioning",
  plumbing: "Plumbing",
  mechanical: "Mechanical",
  pool_spa: "Pool / spa",
  underground_utility: "Underground utility",
  specialty_structure: "Specialty structure",
  solar: "Solar",
};

type OccRow = { occupation_code: string; tracked: string; active: string };
type CountyRow = { county_code: string; tracked: string; active: string };
type DiscRow = { source_system: string; source_dataset: string; n: string };
type BatchRow = {
  source_system: string;
  source_dataset: string;
  extracted_at: Date | string | null;
  source_url: string | null;
  source_file: string | null;
  row_count: string | number | null;
};

function iso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

function classifyDiscFamily(sourceSystem: string, dataset: string): SourceFamily | null {
  const sys = (sourceSystem || "").toLowerCase();
  const ds = (dataset || "").toLowerCase();
  if (sys === "fl_dfs" || ds.includes("stop") || ds.includes("workers_comp")) {
    return "fl_dfs_stop_work";
  }
  if (ds.includes("ula")) return "fl_dbpr_unlicensed_activity";
  if (ds.includes("_rf") || ds.includes("recovery")) return "fl_dbpr_recovery_fund";
  if (ds.includes("disc_lic") || ds.includes("contractor_disc_lic") || ds.includes("licensed")) {
    return "fl_dbpr_discipline";
  }
  if (sys === "fl_dbpr" && ds.includes("disc")) return "fl_dbpr_discipline";
  return null;
}

function fyLabelFromFile(file: string | null): string | null {
  if (!file) return null;
  const m = file.match(/(\d{2})(\d{2})/);
  if (!m) return null;
  return `FY 20${m[1]}/${m[2]}`;
}

async function loadFloridaIntelligenceUncached(): Promise<
  Omit<FloridaIntelligencePayload, "timedOut">
> {
  const generatedAt = new Date().toISOString();
  const state = getDiscoveryState("florida");
  const basePath = state ? discoveryPath(state) : "/florida";

  const [stats, occRows, countyRows, discRows, batchRows] = await Promise.all([
    queryOne<{
      dbpr_credentials: string;
      trade_credentials: string;
      active_credentials: string;
      active_trade_credentials: string;
      last_verified_at: Date | string | null;
    }>(
      `
      SELECT
        COUNT(*)::text AS dbpr_credentials,
        COUNT(*) FILTER (
          WHERE UPPER(COALESCE(occupation_code, '')) NOT IN ('FRO', 'CRS1', 'PVDR')
        )::text AS trade_credentials,
        COUNT(*) FILTER (WHERE status_normalized = 'active')::text AS active_credentials,
        COUNT(*) FILTER (
          WHERE status_normalized = 'active'
            AND UPPER(COALESCE(occupation_code, '')) NOT IN ('FRO', 'CRS1', 'PVDR')
        )::text AS active_trade_credentials,
        MAX(last_verified_at) AS last_verified_at
      FROM licenses
      WHERE source_system = 'fl_dbpr'
      `
    ),
    query<OccRow>(
      `
      SELECT UPPER(COALESCE(occupation_code, '')) AS occupation_code,
             COUNT(*)::text AS tracked,
             COUNT(*) FILTER (WHERE status_normalized = 'active')::text AS active
      FROM licenses
      WHERE source_system = 'fl_dbpr'
      GROUP BY 1
      `
    ),
    query<CountyRow>(
      `
      SELECT TRIM(COALESCE(county_code, '')) AS county_code,
             COUNT(*)::text AS tracked,
             COUNT(*) FILTER (WHERE status_normalized = 'active')::text AS active
      FROM licenses
      WHERE source_system = 'fl_dbpr'
      GROUP BY 1
      `
    ),
    query<DiscRow>(
      `
      SELECT source_system, source_dataset, COUNT(*)::text AS n
      FROM discipline_actions
      WHERE source_system IN ('fl_dbpr', 'fl_dfs')
      GROUP BY 1, 2
      `
    ),
    query<BatchRow>(
      `
      SELECT DISTINCT ON (source_system, source_dataset)
        source_system, source_dataset, extracted_at, source_url, source_file, row_count
      FROM ingest_batches
      WHERE source_system IN ('fl_dbpr', 'fl_dfs', 'fl_sunbiz')
      ORDER BY source_system, source_dataset, extracted_at DESC
      `
    ).catch(() => [] as BatchRow[]),
  ]);

  const asOf = iso(stats?.last_verified_at) || generatedAt;
  const occMap = new Map(
    occRows.map((r) => [
      r.occupation_code,
      { tracked: Number(r.tracked) || 0, active: Number(r.active) || 0 },
    ])
  );

  const tradeBucketCount = CONSUMER_BUCKETS.length;

  const geography: IntelligenceCounty[] = [];
  let hqCredentialTracked = 0;
  for (const row of countyRows) {
    const cls = classifyFloridaCountyCode(row.county_code);
    if (!cls || cls.kind !== "florida_county") continue;
    const tracked = Number(row.tracked) || 0;
    const active = Number(row.active) || 0;
    hqCredentialTracked += tracked;
    geography.push({
      code: cls.code,
      slug: cls.slug,
      name: cls.name,
      href: state ? discoveryPath(state, { countySlug: cls.slug }) : `${basePath}/${cls.slug}`,
      tracked,
      active,
      coverageLevel: countyResearchCoverage(cls.slug),
      metricKind: "hq",
    });
  }
  geography.sort((a, b) => b.tracked - a.tracked || a.name.localeCompare(b.name));
  const countiesRepresented = geography.filter((g) => g.tracked > 0).length;

  const categories: IntelligenceCategory[] = CONSUMER_BUCKETS.map((bucket) => {
    const codes = INTELLIGENCE_TRADE_BUCKETS[bucket] || [];
    const tradeSlug = BUCKET_TO_TRADE_SLUG[bucket];
    const trade = FLORIDA_TRADES.find((t) => t.slug === tradeSlug);
    const splits: IntelligenceCategorySplit[] = codes.map((code) => {
      const def = FLORIDA_CILB_OCCUPATIONS[code];
      const n = occMap.get(code) || { tracked: 0, active: 0 };
      return {
        code,
        officialName: def?.officialName || code,
        kind: def?.kind || "other",
        tracked: n.tracked,
        active: n.active,
      };
    });
    return {
      id: `category_${bucket}`,
      slug: tradeSlug,
      label: BUCKET_LABEL[bucket],
      href: state ? discoveryPath(state, { tradeSlug }) : `${basePath}/${tradeSlug}`,
      tracked: splits.reduce((s, x) => s + x.tracked, 0),
      active: splits.reduce((s, x) => s + x.active, 0),
      occupationCodes: trade?.occupationCodes || codes,
      splits,
      disclosure:
        "Counts are DBPR credentials in this occupation bucket (certified and registered classes listed). Not distinct businesses.",
    };
  });

  const familyCounts = new Map<SourceFamily, number>();
  for (const row of discRows) {
    const fam = classifyDiscFamily(row.source_system, row.source_dataset);
    if (!fam) continue;
    familyCounts.set(fam, (familyCounts.get(fam) || 0) + (Number(row.n) || 0));
  }

  const batchesByFamily = new Map<SourceFamily, BatchRow[]>();
  for (const b of batchRows) {
    const fam =
      b.source_system === "fl_sunbiz"
        ? "fl_sunbiz"
        : classifyDiscFamily(b.source_system, b.source_dataset);
    if (!fam) continue;
    const list = batchesByFamily.get(fam) || [];
    list.push(b);
    batchesByFamily.set(fam, list);
  }
  const licenseBatch = batchRows.filter(
    (b) =>
      b.source_system === "fl_dbpr" &&
      /construction|licensee/i.test(`${b.source_dataset} ${b.source_file}`)
  );
  if (licenseBatch.length) {
    batchesByFamily.set("fl_dbpr_licensing", licenseBatch);
  } else {
    const anyDbpr = batchRows.filter((b) => b.source_system === "fl_dbpr");
    if (anyDbpr.length) batchesByFamily.set("fl_dbpr_licensing", anyDbpr.slice(0, 1));
  }

  const evidenceSources: IntelligenceEvidenceSource[] = FLORIDA_SOURCE_CATALOG.map((cat) => {
    const batches = batchesByFamily.get(cat.id) || [];
    const fys = [
      ...new Set(batches.map((b) => fyLabelFromFile(b.source_file)).filter(Boolean)),
    ] as string[];
    const latest = batches
      .map((b) => iso(b.extracted_at))
      .filter(Boolean)
      .sort()
      .at(-1);
    const observationCount =
      cat.id === "fl_dbpr_licensing" || cat.id === "fl_sunbiz"
        ? null
        : familyCounts.get(cat.id) ?? 0;
    const coveragePeriod =
      fys.length > 0
        ? fys.sort().join(", ")
        : latest
          ? `Extract as of ${latest.slice(0, 10)}`
          : cat.cadence;
    return {
      id: cat.id,
      agency: cat.agency,
      label: cat.label,
      whatItContains: cat.whatItContains,
      coveragePeriod,
      observationCount,
      attributionStatus: cat.attributionStatus,
      limitation: cat.limitation,
      lastExtractedAt: latest || null,
      sourceUrl: batches.find((b) => b.source_url)?.source_url || null,
      cadence: cat.cadence,
    };
  });

  const regulatoryObservations = ["fl_dbpr_discipline", "fl_dbpr_unlicensed_activity", "fl_dbpr_recovery_fund", "fl_dfs_stop_work"]
    .map((id) => familyCounts.get(id as SourceFamily) || 0)
    .reduce((a, b) => a + b, 0);

  const metrics: IntelligenceMetricValue[] = [
    {
      id: "trade_credentials_tracked",
      label: "Trade credentials available for contractor research",
      value: Number(stats?.trade_credentials || 0),
      entityCounted: "credential",
      definition:
        "fl_dbpr licenses excluding FRO, CRS1, and PVDR. QB shells are not in this table. Not distinct businesses or people.",
      querySource: "licenses WHERE source_system=fl_dbpr AND occupation NOT IN (FRO,CRS1,PVDR)",
      readiness: "READY",
      geographicScope: "florida_statewide",
      asOf,
      disclosure: "Board credentials, not companies. Financially responsible officer and education rows are excluded.",
      publicEligibility: "public",
    },
    {
      id: "active_trade_credentials",
      label: "Active trade credentials",
      value: Number(stats?.active_trade_credentials || 0),
      entityCounted: "credential",
      definition: "status_normalized = active (DBPR secondary status A) among trade occupations. Do not add 'current'.",
      querySource: "licenses status_normalized=active AND occupation NOT IN (FRO,CRS1,PVDR)",
      readiness: "READY",
      geographicScope: "florida_statewide",
      asOf,
      disclosure: "Active is a license status, not an active-business count.",
      publicEligibility: "public",
    },
    {
      id: "dbpr_credentials_tracked",
      label: "Total DBPR credentials tracked",
      value: Number(stats?.dbpr_credentials || 0),
      entityCounted: "credential",
      definition: "All fl_dbpr licenses rows, including FRO / CRS1 / PVDR. Still credentials, not businesses.",
      querySource: "licenses WHERE source_system=fl_dbpr",
      readiness: "READY",
      geographicScope: "florida_statewide",
      asOf,
      disclosure: "Includes financially responsible officer and course/provider rows that are not trade licenses.",
      publicEligibility: "public",
    },
    {
      id: "active_credentials",
      label: "Active credentials (all occupations with secondary A)",
      value: Number(stats?.active_credentials || 0),
      entityCounted: "credential",
      definition: "status_normalized = active across fl_dbpr licenses, including any rare active FRO rows.",
      querySource: "licenses status_normalized=active",
      readiness: "READY",
      geographicScope: "florida_statewide",
      asOf,
      disclosure: "Prefer the active trade-credential figure for homeowner discovery.",
      publicEligibility: "public",
    },
    {
      id: "trade_categories_tracked",
      label: "Trade categories tracked",
      value: tradeBucketCount,
      entityCounted: "occupation_bucket",
      definition: "Count of consumer occupation buckets in the Intelligence category dictionary.",
      querySource: "INTELLIGENCE_TRADE_BUCKETS consumer set",
      readiness: "READY",
      geographicScope: "florida_statewide",
      asOf,
      disclosure: "Dictionary size, not a count of businesses.",
      publicEligibility: "public",
    },
    {
      id: "florida_counties_represented",
      label: "Florida counties represented (credential HQ/base)",
      value: countiesRepresented,
      entityCounted: "florida_county",
      definition: "Distinct official DBPR county codes 11–77 with at least one credential mailing/base county.",
      querySource: "licenses.county_code classified via FLORIDA_DBPR_COUNTY_CODES",
      readiness: "READY",
      geographicScope: "florida_county_hq",
      asOf,
      disclosure: "Headquarters/base county on the credential, not counties where work is performed.",
      publicEligibility: "public",
    },
    {
      id: "credentials_with_florida_hq_county",
      label: "Credentials associated with a Florida HQ/base county",
      value: hqCredentialTracked,
      entityCounted: "credential",
      definition: "fl_dbpr licenses whose county_code maps to a Florida county (11–77).",
      querySource: "licenses.county_code in official 11–77",
      readiness: "READY",
      geographicScope: "florida_county_hq",
      asOf,
      disclosure: "Not operating geography. Statewide totals are not a sum of future operating-county counts.",
      publicEligibility: "public",
    },
    {
      id: "regulatory_observations_researched",
      label: "Regulatory/public-record observations researched",
      value: regulatoryObservations,
      entityCounted: "parsed_observation",
      definition:
        "discipline_actions rows for licensed-contractor discipline, ULA, Recovery Fund, and DFS stop-work. Records collected — not findings against contractors.",
      querySource: "discipline_actions grouped by source family",
      readiness: "READY",
      geographicScope: "florida_statewide",
      asOf,
      disclosure:
        "A regulatory record is not a finding against a contractor. Rows may include complaints, notices, administrative actions, claims, and multiple actions in one matter.",
      publicEligibility: "public",
    },
  ];

  const coverage: IntelligenceCoverageItem[] = STATIC_COVERAGE;

  return {
    state: "florida",
    version: FL_STATE_INTEL_VERSION,
    generatedAt,
    asOf,
    metrics,
    categories,
    geography,
    evidenceSources,
    coverage,
    education: FLORIDA_INTELLIGENCE_EDUCATION,
  };
}

const STATIC_COVERAGE: IntelligenceCoverageItem[] = [
    {
      id: "dbpr_credentials",
      label: "DBPR contractor credentials and license status",
      status: "included",
      note: "Trade and total credential universes, with FRO/education disclosed separately.",
    },
    {
      id: "categories",
      label: "Contractor category research",
      status: "included",
      note: "Certified and registered classes kept distinct inside each bucket.",
    },
    {
      id: "hq_geography",
      label: "Credential geography (HQ/base county)",
      status: "included",
      note: "Official DBPR county codes. Not operating county.",
    },
    {
      id: "regulatory_records",
      label: "Florida disciplinary and public records collected",
      status: "included",
      note: "Observation scale only. Profile publication still uses identity and disposition gates.",
    },
    {
      id: "ula_rf_dfs",
      label: "Unlicensed activity, Recovery Fund, and DFS stop-work records",
      status: "included",
      note: "Labeled as source records, not affected businesses.",
    },
    {
      id: "sunbiz",
      label: "Sunbiz corporate research where sufficiently resolved",
      status: "included",
      note: "High-confidence links are not a legal-business census.",
    },
    {
      id: "provenance",
      label: "Source provenance",
      status: "included",
      note: "Extract files, agencies, and known limitations on this page.",
    },
    {
      id: "qualifier_graph",
      label: "Statewide qualifier / business relationship graph",
      status: "expanding",
      note: "Regulator-backed Primary / Second Qualifying Agent and FRO roles are proven. Statewide counts are not published until coverage supports them.",
    },
    {
      id: "corporate_identity",
      label: "Deeper corporate identity resolution",
      status: "expanding",
      note: "Sunbiz document numbers remain a separate identity until CONFIRMED.",
    },
    {
      id: "permits",
      label: "Local permit activity and operating geography",
      status: "expanding",
      note: "Operating county is not inferred from mailing county.",
    },
    {
      id: "enhanced_counties",
      label: "Broward and Palm Beach enhanced local research",
      status: "expanding",
      note: "Coverage level stays Statewide Research until local ingest exists.",
    },
    {
      id: "contacts",
      label: "Additional public business contacts",
      status: "expanding",
      note: "CBI detail pages sampled do not publish licensee phone/email.",
    },
  ];

const getCached = unstable_cache(
  async () => loadFloridaIntelligenceUncached(),
  [FL_STATE_INTEL_VERSION],
  { revalidate: REVALIDATE_SEC }
);

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(null);
      });
  });
}

export function emptyFloridaIntelligencePayload(): FloridaIntelligencePayload {
  return {
    state: "florida",
    version: FL_STATE_INTEL_VERSION,
    generatedAt: new Date().toISOString(),
    asOf: null,
    timedOut: true,
    metrics: [],
    categories: CONSUMER_BUCKETS.map((bucket) => {
      const slug = BUCKET_TO_TRADE_SLUG[bucket];
      return {
        id: `category_${bucket}`,
        slug,
        label: BUCKET_LABEL[bucket],
        href: `/florida/${slug}`,
        tracked: 0,
        active: 0,
        occupationCodes: INTELLIGENCE_TRADE_BUCKETS[bucket] || [],
        splits: [],
        disclosure: "Counts unavailable on this request.",
      };
    }),
    geography: [],
    evidenceSources: FLORIDA_SOURCE_CATALOG.map((cat) => ({
      id: cat.id,
      agency: cat.agency,
      label: cat.label,
      whatItContains: cat.whatItContains,
      coveragePeriod: cat.cadence,
      observationCount: null,
      attributionStatus: cat.attributionStatus,
      limitation: cat.limitation,
      lastExtractedAt: null,
      sourceUrl: null,
      cadence: cat.cadence,
    })),
    coverage: STATIC_COVERAGE,
    education: FLORIDA_INTELLIGENCE_EDUCATION,
  };
}

export async function getFloridaIntelligenceSnapshot(): Promise<FloridaIntelligencePayload> {
  const hit = await withTimeout(getCached(), TIMEOUT_MS);
  if (!hit) return emptyFloridaIntelligencePayload();
  return { ...hit, timedOut: false };
}

export function metricById(
  payload: FloridaIntelligencePayload,
  id: string
): IntelligenceMetricValue | undefined {
  return payload.metrics.find((m) => m.id === id);
}
