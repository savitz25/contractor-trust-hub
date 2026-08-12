/**
 * Stage 6 Trust Report activity signals — live from extracts / optional DB rollups.
 */

import { contractorActivityFromExtracts } from "@/lib/property/permits";
import type { ContractorDetail } from "./types";

export type ActivitySignalState =
  | { status: "unavailable"; message: string }
  | {
      status: "partial";
      message: string;
      permitCount: number | null;
      counties: string[];
      recentWindow: string | null;
      categories: string[];
      sampleTypes?: string[];
      sourceLabel?: string;
      retrievedAt?: string | null;
      matchMethod?: string;
      note: string;
    }
  | {
      status: "available";
      permitCount: number | null;
      counties: string[];
      recentWindow: string | null;
      categories: string[];
      sampleTypes: string[];
      sourceLabel: string;
      retrievedAt: string | null;
      matchMethod: string;
      note: string;
    };

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
      sampleTypes: fromExtract.sampleTypes,
      sourceLabel: fromExtract.sourceLabel,
      retrievedAt: fromExtract.retrievedAt,
      matchMethod: fromExtract.matchMethod,
      note: "Associated in available datasets only — not a quality rating or complete work history. Confirm with the AHJ and written proposals.",
    };
  }

  if (fromExtract && fromExtract.permitCount === 0) {
    return {
      status: "partial",
      message: "License keys matched the activity index but no permit volume is shown.",
      permitCount: 0,
      counties: fromExtract.counties,
      recentWindow: fromExtract.recentWindow,
      categories: fromExtract.categories,
      sampleTypes: fromExtract.sampleTypes,
      sourceLabel: fromExtract.sourceLabel,
      retrievedAt: fromExtract.retrievedAt,
      matchMethod: fromExtract.matchMethod,
      note: "Partial evidence — missing pieces are not invented.",
    };
  }

  if (keys.length > 0) {
    return {
      status: "unavailable",
      message:
        "Permit/activity history not yet linked for this record in current extracts. We do not invent permit volume or recency. Use Check My Address for property-level research.",
    };
  }

  return {
    status: "unavailable",
    message:
      "No license keys on this profile to join against activity extracts. Permit/activity history not linked.",
  };
}

/** Async path: try DB rollups first, then file extracts. */
export async function getActivitySignalsAsync(
  contractor: ContractorDetail
): Promise<ActivitySignalState> {
  const keys = contractor.licenses
    .map((l) => l.externalKey)
    .filter(Boolean) as string[];
  if (!keys.length) return getActivitySignals(contractor);

  try {
    const { activityFromDb } = await import("@/lib/property/join-db");
    const db = await activityFromDb(keys);
    if (db && db.permitCount > 0) {
      return {
        status: "available",
        permitCount: db.permitCount,
        counties: db.counties,
        recentWindow: db.recentWindow,
        categories: db.categories,
        sampleTypes: db.sampleTypes,
        sourceLabel: db.sourceLabel,
        retrievedAt: db.retrievedAt,
        matchMethod: "license",
        note: "Associated in available datasets only — not a quality rating. Matched by license number.",
      };
    }
  } catch {
    /* fall through to file extracts */
  }

  return getActivitySignals(contractor);
}
