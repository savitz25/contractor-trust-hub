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

/**
 * One click classifies as one event. Save is never a profile activation.
 * Profile text on the Ask card is "View profile"; discovery search still says "Research this contractor".
 */
export function classifySpecialistSearchClick(action: string | null, text: string): "profile" | "trace" | null {
  if (action === "save") return null;
  if (action === "trace" || text.includes("Trace this result")) return "trace";
  if (action === "profile" || text.includes("Research this contractor") || text.includes("View profile")) return "profile";
  return null;
}

/** Raw query text and exact profile identifiers are deliberately absent. */
export function searchResultCountBucket(count: number): SpecialistSearchDimensions["resultCountBucket"] {
  if (count <= 0) return "0";
  if (count === 1) return "1";
  if (count <= 10) return "2-10";
  if (count <= 24) return "11-24";
  return "25+";
}
