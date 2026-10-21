/**
 * Adapter boundary for verified OSHA inspection detail.
 *
 * This is a display contract only. It intentionally contains no DB column
 * names or query assumptions; a production adapter must map B2's verified
 * source contract into these fields before this UI can receive production data.
 */
export type OshaCitationType = "Serious" | "Willful" | "Repeat" | "Other" | "Unclassified";

export type OshaCitationDetail = {
  citationId: string;
  standard: string;
  citationType: OshaCitationType;
  currentPenalty: number;
  /** Exact, source-provided text only; do not derive a status from missing facts. */
  officialStatus?: string;
};

export type OshaInspectionDetail = {
  activityNumber: string;
  openDate: string;
  city?: string;
  state?: string;
  inspectionType: string;
  /** Exact, source-provided status text only. */
  officialStatus?: string;
  /** Trusted URL supplied by the source adapter; never construct it from activityNumber. */
  officialUrl?: string;
  /** null means citation detail is unavailable; [] means verified zero citation rows. */
  citations: readonly OshaCitationDetail[] | null;
};

export type OshaDetailMatchTier = "exact" | "strong" | "weak" | "unmatched";

export type OshaInspectionDetailsPage = {
  inspections: readonly OshaInspectionDetail[];
  totalInspections: number;
  nextCursor: string | null;
  /** Expected and complete detail totals are reconciled before any rows are returned. */
  reconciliation: {
    expectedCitationItems: number;
    detailCitationItems: number;
  } | null;
};

export const OSHA_INSPECTION_DETAILS_PAGE_SIZE = 10;

function stableCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Sort newest-first, with a stable unique activity-number tie-breaker. */
export function sortOshaInspectionDetails(
  inspections: readonly OshaInspectionDetail[],
): OshaInspectionDetail[] {
  const seen = new Set<string>();
  for (const inspection of inspections) {
    if (seen.has(inspection.activityNumber)) {
      throw new Error("Duplicate OSHA activity number in detail source");
    }
    seen.add(inspection.activityNumber);
  }
  return [...inspections].sort(
    (a, b) => stableCompare(b.openDate, a.openDate) || stableCompare(b.activityNumber, a.activityNumber),
  );
}

export function isPublicOshaDetailTier(tier: OshaDetailMatchTier): tier is "exact" | "strong" {
  return tier === "exact" || tier === "strong";
}

/** A verified source URL is rendered only when it is the matching OSHA detail page. */
export function verifiedOshaInspectionUrl(inspection: OshaInspectionDetail): string | null {
  if (!inspection.officialUrl) return null;
  try {
    const url = new URL(inspection.officialUrl);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "www.osha.gov" ||
      url.pathname !== "/ords/imis/establishment.inspection_detail" ||
      url.searchParams.get("id") !== inspection.activityNumber ||
      [...url.searchParams.keys()].some((key) => key !== "id")
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function countKnownCitationItems(inspections: readonly OshaInspectionDetail[]): number | null {
  let total = 0;
  for (const inspection of inspections) {
    if (inspection.citations == null) return null;
    total += inspection.citations.length;
  }
  return total;
}
