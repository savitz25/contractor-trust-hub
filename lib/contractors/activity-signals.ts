/**
 * Activity / permit signals framework.
 * Live data not linked yet — prepared empty state only (no fabricated volume).
 */

import type { ContractorDetail } from "./types";

export type ActivitySignalState =
  | { status: "unavailable"; message: string }
  | {
      status: "available";
      permitCount: number | null;
      counties: string[];
      recentWindow: string | null;
      categories: string[];
      note: string;
    };

/** Feature flag: set true when permit/activity extracts are loaded and linked. */
export const PERMIT_ACTIVITY_LIVE = false;

export function getActivitySignals(
  _contractor: ContractorDetail
): ActivitySignalState {
  if (!PERMIT_ACTIVITY_LIVE) {
    return {
      status: "unavailable",
      message:
        "Permit/activity history is not yet linked for this record. We do not invent permit volume or recency. When Florida permit extracts are connected, associated permit counts, counties, and activity windows will appear here with source attribution.",
    };
  }

  // Placeholder for future integration
  return {
    status: "unavailable",
    message: "Permit/activity history not yet linked for this record.",
  };
}
