/**
 * Activity / permit signals for Trust Report.
 * Progressive: live extract map when present, otherwise honest empty/partial.
 */

import { contractorActivityFromExtracts } from "@/lib/property/permits";
import type { ContractorDetail } from "./types";

export type ActivitySignalState =
  | { status: "unavailable"; message: string }
  | { status: "partial"; message: string; permitCount: number | null; counties: string[]; recentWindow: string | null; categories: string[]; note: string }
  | {
      status: "available";
      permitCount: number | null;
      counties: string[];
      recentWindow: string | null;
      categories: string[];
      note: string;
    };

/**
 * Feature path: when contractorActivityByLicense (or future DB) has rows, show available/partial.
 * Otherwise empty state with links to property tools.
 */
export function getActivitySignals(
  contractor: ContractorDetail
): ActivitySignalState {
  const keys = contractor.licenses
    .map((l) => l.externalKey)
    .filter(Boolean) as string[];

  const fromExtract = contractorActivityFromExtracts(keys);
  if (fromExtract && fromExtract.permitCount > 0) {
    return {
      status: "available",
      permitCount: fromExtract.permitCount,
      counties: fromExtract.counties,
      recentWindow: fromExtract.recentWindow,
      categories: fromExtract.categories,
      note: "Associated in available datasets only — not a quality rating or complete work history. Confirm with the AHJ and written proposals.",
    };
  }

  // Partial: we attempted license-key join but found nothing
  if (keys.length > 0) {
    return {
      status: "unavailable",
      message:
        "Permit/activity history not yet linked for this record. We do not invent permit volume or recency. Use Check My Address for property-level research and the Permit Planner for project-type guidance.",
    };
  }

  return {
    status: "unavailable",
    message:
      "No license keys on this profile to join against activity extracts. Permit/activity history not linked.",
  };
}
