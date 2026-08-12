import type { CoverageLevel } from "./types";

/**
 * Progressive jurisdiction coverage matrix (Florida-first).
 * Expand as permit extracts are connected — never claim full statewide coverage.
 */
export type JurisdictionCoverage = {
  county: string;
  countySlug: string;
  level: CoverageLevel;
  sourceLabel: string;
  portalUrl?: string;
  buildingDeptNote?: string;
  note: string;
};

/** Counties with any connected or pilot extract path. */
const MATRIX: JurisdictionCoverage[] = [
  {
    county: "Miami-Dade",
    countySlug: "miami-dade",
    level: "partial",
    sourceLabel: "Miami-Dade permit extracts (pilot)",
    portalUrl: "https://www.miamidade.gov/permits/",
    buildingDeptNote: "Miami-Dade County building / permitting services",
    note: "Partial pilot coverage. Many addresses will show no records even when permits exist at the AHJ.",
  },
  {
    county: "Broward",
    countySlug: "broward",
    level: "partial",
    sourceLabel: "Broward permit extracts (pilot)",
    portalUrl: "https://www.broward.org/Building/Pages/default.aspx",
    note: "Partial pilot coverage. Confirm all requirements with Broward or municipal AHJ.",
  },
  {
    county: "Orange",
    countySlug: "orange",
    level: "partial",
    sourceLabel: "Orange County permit extracts (pilot)",
    portalUrl: "https://www.orangecountyfl.net/PermitsLicenses.aspx",
    note: "Partial pilot coverage. Municipalities may issue separately.",
  },
  {
    county: "Hillsborough",
    countySlug: "hillsborough",
    level: "partial",
    sourceLabel: "Hillsborough permit extracts (pilot)",
    note: "Partial pilot coverage. Verify with Hillsborough or City of Tampa as applicable.",
  },
  {
    county: "Palm Beach",
    countySlug: "palm-beach",
    level: "jurisdiction_unsupported",
    sourceLabel: "Not connected",
    note: "Jurisdiction not yet connected to Trust Hub permit extracts.",
  },
  {
    county: "Duval",
    countySlug: "duval",
    level: "jurisdiction_unsupported",
    sourceLabel: "Not connected",
    note: "Jurisdiction not yet connected to Trust Hub permit extracts.",
  },
  {
    county: "Pinellas",
    countySlug: "pinellas",
    level: "jurisdiction_unsupported",
    sourceLabel: "Not connected",
    note: "Jurisdiction not yet connected to Trust Hub permit extracts.",
  },
  {
    county: "Lee",
    countySlug: "lee",
    level: "jurisdiction_unsupported",
    sourceLabel: "Not connected",
    note: "Jurisdiction not yet connected to Trust Hub permit extracts.",
  },
];

const DEFAULT_UNSUPPORTED: Omit<JurisdictionCoverage, "county" | "countySlug"> = {
  level: "jurisdiction_unsupported",
  sourceLabel: "Not connected",
  note: "This Florida county is not yet in our permit extract matrix. Address was resolved to county only.",
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
