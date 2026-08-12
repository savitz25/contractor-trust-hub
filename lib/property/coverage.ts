import type { CoverageLevel } from "./types";

/**
 * Progressive jurisdiction coverage matrix (Florida-first).
 * Stage 6 waves A–C — never claim complete statewide coverage.
 */
export type JurisdictionCoverage = {
  county: string;
  countySlug: string;
  level: CoverageLevel;
  sourceLabel: string;
  portalUrl?: string;
  buildingDeptNote?: string;
  note: string;
  /** Expansion wave for prioritization docs */
  wave: "A" | "B" | "C" | "future";
  /** Approximate extract record count in shipped sample/batch (docs/analytics) */
  sampleRecordCount?: number;
  freshness?: string;
};

/** Wave A: deepen pilots · Wave B: next metros · Wave C: high-demand add-ons */
const MATRIX: JurisdictionCoverage[] = [
  // Wave A — deepen pilots
  {
    county: "Miami-Dade",
    countySlug: "miami-dade",
    level: "partial",
    wave: "A",
    sourceLabel: "Miami-Dade permit extracts (Wave A)",
    portalUrl: "https://www.miamidade.gov/permits/",
    buildingDeptNote: "Miami-Dade County building / permitting services",
    note: "Partial Wave A coverage. Many addresses still return no rows even when AHJ has permits.",
    sampleRecordCount: 12,
    freshness: "2026-03-01",
  },
  {
    county: "Broward",
    countySlug: "broward",
    level: "partial",
    wave: "A",
    sourceLabel: "Broward / municipal permit extracts (Wave A)",
    portalUrl: "https://www.broward.org/Building/Pages/default.aspx",
    note: "Partial Wave A. Confirm municipal vs county AHJ.",
    sampleRecordCount: 6,
    freshness: "2026-03-01",
  },
  {
    county: "Orange",
    countySlug: "orange",
    level: "partial",
    wave: "A",
    sourceLabel: "Orange County permit extracts (Wave A)",
    portalUrl: "https://www.orangecountyfl.net/PermitsLicenses.aspx",
    note: "Partial Wave A. Municipalities may issue separately.",
    sampleRecordCount: 4,
    freshness: "2026-03-01",
  },
  {
    county: "Hillsborough",
    countySlug: "hillsborough",
    level: "partial",
    wave: "A",
    sourceLabel: "Hillsborough / Tampa permit extracts (Wave A)",
    note: "Partial Wave A. Verify City of Tampa vs county as applicable.",
    sampleRecordCount: 4,
    freshness: "2026-03-01",
  },
  // Wave B — next top metros
  {
    county: "Palm Beach",
    countySlug: "palm-beach",
    level: "partial",
    wave: "B",
    sourceLabel: "Palm Beach permit extracts (Wave B)",
    note: "Partial Wave B pilot. Municipal AHJs common.",
    sampleRecordCount: 3,
    freshness: "2026-03-01",
  },
  {
    county: "Duval",
    countySlug: "duval",
    level: "partial",
    wave: "B",
    sourceLabel: "Duval / Jacksonville permit extracts (Wave B)",
    note: "Partial Wave B pilot.",
    sampleRecordCount: 3,
    freshness: "2026-03-01",
  },
  {
    county: "Pinellas",
    countySlug: "pinellas",
    level: "partial",
    wave: "B",
    sourceLabel: "Pinellas permit extracts (Wave B)",
    note: "Partial Wave B pilot.",
    sampleRecordCount: 2,
    freshness: "2026-03-01",
  },
  {
    county: "Lee",
    countySlug: "lee",
    level: "partial",
    wave: "B",
    sourceLabel: "Lee County permit extracts (Wave B)",
    note: "Partial Wave B pilot.",
    sampleRecordCount: 2,
    freshness: "2026-03-01",
  },
  // Wave C — additional high-demand
  {
    county: "Collier",
    countySlug: "collier",
    level: "partial",
    wave: "C",
    sourceLabel: "Collier permit extracts (Wave C)",
    note: "Partial Wave C pilot.",
    sampleRecordCount: 2,
    freshness: "2026-03-01",
  },
  {
    county: "Sarasota",
    countySlug: "sarasota",
    level: "partial",
    wave: "C",
    sourceLabel: "Sarasota permit extracts (Wave C)",
    note: "Partial Wave C pilot.",
    sampleRecordCount: 2,
    freshness: "2026-03-01",
  },
  {
    county: "Pasco",
    countySlug: "pasco",
    level: "partial",
    wave: "C",
    sourceLabel: "Pasco permit extracts (Wave C)",
    note: "Partial Wave C pilot.",
    sampleRecordCount: 1,
    freshness: "2026-03-01",
  },
  {
    county: "Polk",
    countySlug: "polk",
    level: "partial",
    wave: "C",
    sourceLabel: "Polk permit extracts (Wave C)",
    note: "Partial Wave C pilot.",
    sampleRecordCount: 1,
    freshness: "2026-03-01",
  },
  {
    county: "Brevard",
    countySlug: "brevard",
    level: "jurisdiction_unsupported",
    wave: "future",
    sourceLabel: "Not connected",
    note: "Planned for a future expansion wave.",
  },
  {
    county: "Volusia",
    countySlug: "volusia",
    level: "jurisdiction_unsupported",
    wave: "future",
    sourceLabel: "Not connected",
    note: "Planned for a future expansion wave.",
  },
  {
    county: "Seminole",
    countySlug: "seminole",
    level: "jurisdiction_unsupported",
    wave: "future",
    sourceLabel: "Not connected",
    note: "Planned for a future expansion wave.",
  },
];

const DEFAULT_UNSUPPORTED: Omit<JurisdictionCoverage, "county" | "countySlug"> = {
  level: "jurisdiction_unsupported",
  sourceLabel: "Not connected",
  note: "This Florida county is not yet in our permit extract matrix. Address was resolved to county only.",
  wave: "future",
};

export function coverageForCounty(
  county: string | null
): JurisdictionCoverage | null {
  if (!county) return null;
  const found = MATRIX.find(
    (m) => m.county.toLowerCase() === county.toLowerCase()
  );
  if (found) return found;
  return {
    county,
    countySlug: county.toLowerCase().replace(/\s+/g, "-"),
    ...DEFAULT_UNSUPPORTED,
  };
}

export function coverageLabel(level: CoverageLevel): string {
  switch (level) {
    case "full":
      return "Full extract coverage (still confirm with AHJ)";
    case "partial":
      return "Partial extract coverage";
    case "jurisdiction_unsupported":
      return "Jurisdiction not yet connected";
    case "source_unavailable":
      return "Source temporarily unavailable";
  }
}

export function allCoverageMatrix(): JurisdictionCoverage[] {
  return [...MATRIX];
}

export function coverageAnalyticsSnapshot() {
  const enabled = MATRIX.filter((m) => m.level === "partial" || m.level === "full");
  const unsupported = MATRIX.filter((m) => m.level === "jurisdiction_unsupported");
  const byWave = {
    A: enabled.filter((m) => m.wave === "A"),
    B: enabled.filter((m) => m.wave === "B"),
    C: enabled.filter((m) => m.wave === "C"),
  };
  const sampleRecords = enabled.reduce((n, m) => n + (m.sampleRecordCount || 0), 0);
  return {
    generatedAt: new Date().toISOString(),
    jurisdictionsEnabled: enabled.length,
    jurisdictionsUnsupportedListed: unsupported.length,
    sampleRecordCountShipped: sampleRecords,
    byWave: {
      A: byWave.A.map((m) => m.county),
      B: byWave.B.map((m) => m.county),
      C: byWave.C.map((m) => m.county),
    },
    matrix: MATRIX.map((m) => ({
      county: m.county,
      level: m.level,
      wave: m.wave,
      sourceLabel: m.sourceLabel,
      sampleRecordCount: m.sampleRecordCount ?? 0,
      freshness: m.freshness ?? null,
    })),
    matching: {
      preferred: ["exact_license_number", "never_name_only"],
      falseJoinPolicy: "refuse_when_uncertain",
    },
  };
}
