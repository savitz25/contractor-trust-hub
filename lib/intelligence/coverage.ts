/**
 * Research coverage is Trust Hub's evidence depth, not provider quality.
 * Enhanced counties are data-driven later — never hard-coded here.
 *
 * Jurisdiction metadata count alone must never flip a county to Enhanced.
 */

export type ResearchCoverageLevel = "statewide" | "enhanced";

export const COVERAGE_LABEL: Record<ResearchCoverageLevel, string> = {
  statewide: "Statewide Research",
  enhanced: "Enhanced Local Research",
};

/**
 * Proposed Enhanced Local Research gate — DOCUMENTED, NOT ACTIVATED.
 *
 * All conjuncts must be true. Mapped AHJs, HQ/mailing county_code, and PRA
 * request IDs are not sufficient. countyResearchCoverage() does not call this.
 */
export type EnhancedLocalResearchGateInput = {
  sourceFilesLoaded: boolean;
  permitOrLocalCredentialCoverage: boolean;
  identityAttributionValidated: boolean;
  jurisdictionDenominatorKnown: boolean;
  recencySufficient: boolean;
  noCriticalCoverageAmbiguity: boolean;
  operatingActivityEvidence: boolean;
};

export function evaluateEnhancedLocalResearchGate(
  input: EnhancedLocalResearchGateInput
): ResearchCoverageLevel {
  const pass =
    input.sourceFilesLoaded &&
    input.permitOrLocalCredentialCoverage &&
    input.identityAttributionValidated &&
    input.jurisdictionDenominatorKnown &&
    input.recencySufficient &&
    input.noCriticalCoverageAmbiguity &&
    input.operatingActivityEvidence;
  return pass ? "enhanced" : "statewide";
}

/**
 * Public coverage for county pages. Always statewide until the gate is activated.
 * Broward / Palm Beach must not be marked enhanced until local ingest exists.
 */
export function countyResearchCoverage(_countySlug: string): ResearchCoverageLevel {
  return "statewide";
}

export const FLORIDA_COUNTY_INTEL_SLUGS = ["broward", "palm-beach"] as const;
export type FloridaCountyIntelSlug = (typeof FLORIDA_COUNTY_INTEL_SLUGS)[number];

export function isFloridaCountyIntelSlug(slug: string): slug is FloridaCountyIntelSlug {
  return (FLORIDA_COUNTY_INTEL_SLUGS as readonly string[]).includes(slug);
}
