import type {
  OshaDetailMatchTier,
  OshaInspectionDetail,
  OshaInspectionDetailsPage,
} from "./inspection-details";
import {
  countKnownCitationItems,
  isPublicOshaDetailTier,
  OSHA_INSPECTION_DETAILS_PAGE_SIZE,
  sortOshaInspectionDetails,
} from "./inspection-details";

export class OshaDetailUnavailableError extends Error {
  constructor(readonly reason: "weak_or_unmatched" | "duplicate_activity" | "reconciliation_failed" | "invalid_cursor") {
    super(reason);
    this.name = "OshaDetailUnavailableError";
  }
}

export function isPublicOshaDetailParentAllowed(input: {
  parent: { id: string; contractorId: string; state: string; licenseKey: string; matchTier: string } | null;
  request: { publicMatchId: string; contractorId: string; state: string; licenseKey: string };
}): boolean {
  const parent = input.parent;
  return Boolean(
    parent &&
      parent.id === input.request.publicMatchId &&
      parent.contractorId === input.request.contractorId &&
      parent.state === input.request.state &&
      parent.licenseKey === input.request.licenseKey &&
      (parent.matchTier === "exact" || parent.matchTier === "strong"),
  );
}

export type OshaInspectionCursor = { openDate: string | null; activityNumber: string };

export function encodeOshaInspectionCursor(cursor: OshaInspectionCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeOshaInspectionCursor(value: string | null | undefined): OshaInspectionCursor | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object") throw new Error("invalid cursor");
    const cursor = parsed as Partial<OshaInspectionCursor>;
    if (
      typeof cursor.activityNumber !== "string" || cursor.activityNumber.trim() === "" ||
      !(cursor.openDate === null || (typeof cursor.openDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(cursor.openDate)))
    ) throw new Error("invalid cursor");
    return { openDate: cursor.openDate, activityNumber: cursor.activityNumber };
  } catch {
    throw new OshaDetailUnavailableError("invalid_cursor");
  }
}

/**
 * Production adapters must call this only after loading one eligible license
 * match. It validates the full citation count before returning any page rows.
 */
export function buildVerifiedOshaInspectionPage(input: {
  matchTier: OshaDetailMatchTier;
  inspections: readonly OshaInspectionDetail[];
  expectedCitationItems: number;
  cursor?: string | null;
  pageSize?: number;
}): OshaInspectionDetailsPage {
  if (!isPublicOshaDetailTier(input.matchTier)) {
    throw new OshaDetailUnavailableError("weak_or_unmatched");
  }
  return buildReconciledPage(input);
}

/** Fixture-only equivalent; it cannot access DB state or production profiles. */
export function buildPreviewOshaInspectionPage(input: {
  inspections: readonly OshaInspectionDetail[];
  expectedCitationItems: number;
  cursor?: string | null;
}): OshaInspectionDetailsPage {
  return buildReconciledPage(input);
}

/**
 * Pagination-only, unmatched public search rows. This path carries no citation
 * claim and must never be reused for a matched contractor profile.
 */
export function buildUnmatchedPaginationDemoPage(input: {
  inspections: readonly OshaInspectionDetail[];
  cursor?: string | null;
}): OshaInspectionDetailsPage {
  const pageSize = OSHA_INSPECTION_DETAILS_PAGE_SIZE;
  const cursor = input.cursor == null || input.cursor === "" ? 0 : Number(input.cursor);
  if (!Number.isInteger(cursor) || cursor < 0 || cursor % pageSize !== 0) {
    throw new OshaDetailUnavailableError("invalid_cursor");
  }
  let ordered: OshaInspectionDetail[];
  try {
    ordered = sortOshaInspectionDetails(input.inspections);
  } catch {
    throw new OshaDetailUnavailableError("duplicate_activity");
  }
  const inspections = ordered.slice(cursor, cursor + pageSize);
  const nextOffset = cursor + inspections.length;
  return {
    inspections,
    totalInspections: ordered.length,
    nextCursor: nextOffset < ordered.length ? String(nextOffset) : null,
    reconciliation: null,
  };
}

function buildReconciledPage(input: {
  inspections: readonly OshaInspectionDetail[];
  expectedCitationItems: number;
  cursor?: string | null;
  pageSize?: number;
}): OshaInspectionDetailsPage {
  const pageSize = input.pageSize ?? OSHA_INSPECTION_DETAILS_PAGE_SIZE;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > OSHA_INSPECTION_DETAILS_PAGE_SIZE) {
    throw new RangeError("OSHA detail page size must be between 1 and 10");
  }
  const cursor = input.cursor == null || input.cursor === "" ? 0 : Number(input.cursor);
  if (!Number.isInteger(cursor) || cursor < 0 || cursor % pageSize !== 0) {
    throw new OshaDetailUnavailableError("invalid_cursor");
  }

  let ordered: OshaInspectionDetail[];
  try {
    ordered = sortOshaInspectionDetails(input.inspections);
  } catch {
    throw new OshaDetailUnavailableError("duplicate_activity");
  }
  const detailCitationItems = countKnownCitationItems(ordered);
  if (detailCitationItems == null || detailCitationItems !== input.expectedCitationItems) {
    throw new OshaDetailUnavailableError("reconciliation_failed");
  }

  const inspections = ordered.slice(cursor, cursor + pageSize);
  const nextOffset = cursor + inspections.length;
  const nextCursor = nextOffset < ordered.length ? String(nextOffset) : null;
  return {
    inspections,
    totalInspections: ordered.length,
    nextCursor,
    reconciliation: {
      expectedCitationItems: input.expectedCitationItems,
      detailCitationItems,
    },
  };
}
