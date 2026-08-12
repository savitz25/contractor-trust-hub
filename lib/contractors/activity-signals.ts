/**
 * Stage 6.1 Trust Report activity — live / empty / partial QA states.
 * Auto-join activity only via exact license key match in extracts/DB.
 */

import { contractorActivityFromExtracts } from "@/lib/property/permits";
import type { ContractorDetail } from "./types";

export type ActivitySignalState =
  | {
      status: "unavailable";
      message: string;
      qa: "no_license_keys" | "no_extract_match";
      matchedLicenseKeys?: string[];
    }
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
      matchedLicenseKeys?: string[];
      note: string;
      qa: "zero_volume" | "thin_fields";
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
      matchedLicenseKeys: string[];
      note: string;
      qa: "live";
    };

export function getActivitySignals(
  contractor: ContractorDetail
): ActivitySignalState {
  const keys = contractor.licenses
    .map((l) => l.externalKey)
    .filter(Boolean) as string[];

  if (!keys.length) {
    return {
      status: "unavailable",
      qa: "no_license_keys",
      message:
        "No license keys on this profile to join against activity extracts. Permit/activity history not linked.",
    };
  }

  const fromExtract = contractorActivityFromExtracts(keys);

  if (fromExtract && fromExtract.permitCount > 0) {
    const thin =
      fromExtract.counties.length === 0 ||
      !fromExtract.recentWindow ||
      fromExtract.sampleTypes.length === 0;

    if (thin) {
      return {
        status: "partial",
        qa: "thin_fields",
        message:
          "License matched activity extracts, but some fields (counties, window, or samples) are thin in current data.",
        permitCount: fromExtract.permitCount,
        counties: fromExtract.counties,
        recentWindow: fromExtract.recentWindow,
        categories: fromExtract.categories,
        sampleTypes: fromExtract.sampleTypes,
        sourceLabel: fromExtract.sourceLabel,
        retrievedAt: fromExtract.retrievedAt,
        matchMethod: fromExtract.matchMethod,
        matchedLicenseKeys: fromExtract.matchedLicenseKeys,
        note: "Partial evidence — missing pieces are not invented. Matched by exact license number only.",
      };
    }

    return {
      status: "available",
      qa: "live",
      permitCount: fromExtract.permitCount,
      counties: fromExtract.counties,
      recentWindow: fromExtract.recentWindow,
      categories: fromExtract.categories,
      sampleTypes: fromExtract.sampleTypes,
      sourceLabel: fromExtract.sourceLabel,
      retrievedAt: fromExtract.retrievedAt,
      matchMethod: fromExtract.matchMethod,
      matchedLicenseKeys: fromExtract.matchedLicenseKeys,
      note: "Associated in available datasets only — not a quality rating or complete work history. Matched by exact license number. Confirm with the AHJ and written proposals.",
    };
  }

  if (fromExtract && fromExtract.permitCount === 0) {
    return {
      status: "partial",
      qa: "zero_volume",
      message:
        "License keys matched the activity index but permit volume is zero in current extracts.",
      permitCount: 0,
      counties: fromExtract.counties,
      recentWindow: fromExtract.recentWindow,
      categories: fromExtract.categories,
      sampleTypes: fromExtract.sampleTypes,
      sourceLabel: fromExtract.sourceLabel,
      retrievedAt: fromExtract.retrievedAt,
      matchMethod: fromExtract.matchMethod,
      matchedLicenseKeys: fromExtract.matchedLicenseKeys,
      note: "Partial evidence — missing pieces are not invented.",
    };
  }

  return {
    status: "unavailable",
    qa: "no_extract_match",
    message:
      "Permit/activity history not yet linked for this record in current extracts. We do not invent permit volume or recency. Use Check My Address for property-level research.",
    matchedLicenseKeys: [],
  };
}

/** Async path: try DB rollups first (migration 006), then file extracts. */
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
        qa: "live",
        permitCount: db.permitCount,
        counties: db.counties,
        recentWindow: db.recentWindow,
        categories: db.categories,
        sampleTypes: db.sampleTypes,
        sourceLabel: db.sourceLabel,
        retrievedAt: db.retrievedAt,
        matchMethod: "license",
        matchedLicenseKeys: keys.map((k) => k.toUpperCase().replace(/[^A-Z0-9]/g, "")),
        note: "Associated in available datasets only — not a quality rating. Matched by exact license number (DB rollup).",
      };
    }
  } catch {
    /* fall through to file extracts */
  }

  return getActivitySignals(contractor);
}
