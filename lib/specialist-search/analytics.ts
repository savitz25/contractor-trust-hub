import { SPECIALIST_SEARCH_ANALYTICS_EVENTS } from "./contract";

export type SpecialistSearchEvent = (typeof SPECIALIST_SEARCH_ANALYTICS_EVENTS)[number];
export type SpecialistSearchDimensions = {
  hub: "contractor";
  intent: string;
  state?: string;
  classification?: string;
  hasIdentifier: boolean;
  hasEvidenceFilter: boolean;
  resultCountBucket?: "0" | "1" | "2-10" | "11-24" | "25+";
  coverageState?: "KNOWN" | "UNKNOWN" | "PARTIAL" | "NOT_ACQUIRED" | "REQUEST_ONLY" | "UNSUPPORTED";
};

/** Raw query text and exact profile identifiers are deliberately absent. */
export function searchResultCountBucket(count: number): SpecialistSearchDimensions["resultCountBucket"] {
  if (count <= 0) return "0";
  if (count === 1) return "1";
  if (count <= 10) return "2-10";
  if (count <= 24) return "11-24";
  return "25+";
}
