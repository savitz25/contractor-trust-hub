/**
 * Research coverage is Trust Hub's evidence depth, not provider quality.
 * Enhanced counties are data-driven later — never hard-coded here.
 */

export type ResearchCoverageLevel = "statewide" | "enhanced";

export const COVERAGE_LABEL: Record<ResearchCoverageLevel, string> = {
  statewide: "Statewide Research",
  enhanced: "Enhanced Local Research",
};

/**
 * Default every Florida county to statewide until a coverage table says otherwise.
 * Broward / Palm Beach must not be marked enhanced until local ingest exists.
 */
export function countyResearchCoverage(_countySlug: string): ResearchCoverageLevel {
  return "statewide";
}
