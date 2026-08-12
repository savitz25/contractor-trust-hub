/**
 * Stage 6.1 — permit status normalization for Wave A production reliability.
 * Maps common AHJ wording → canonical PermitStatus. Unknown stays unknown.
 */

import type { PermitStatus } from "./types";

export type StatusNormalizeResult = {
  status: PermitStatus;
  statusRaw: string;
  /** Short reason for audit / UI */
  statusNote?: string;
};

const FINALED = [
  "finaled",
  "final",
  "finaled/closed",
  "final inspection",
  "co final",
  "certificate of occupancy",
  "completed",
  "complete",
  "closed final",
  "finaled - closed",
];

const ISSUED = ["issued", "issue", "permit issued", "active issued", "approved issued"];

const OPEN = [
  "open",
  "in progress",
  "in-progress",
  "under review",
  "pending",
  "applied",
  "application",
  "submitted",
  "active",
  "work in progress",
];

const CLOSED = ["closed", "closed - complete", "closed complete", "done", "archived"];

const EXPIRED = [
  "expired",
  "void",
  "voided",
  "cancelled",
  "canceled",
  "withdrawn",
  "revoked",
  "denied",
  "rejected",
];

function containsAny(hay: string, needles: string[]): boolean {
  return needles.some((n) => hay === n || hay.includes(n));
}

/**
 * Normalize raw AHJ status strings to canonical set.
 * Prefer more specific finaled/expired before generic open/closed.
 */
export function normalizePermitStatus(
  raw: string | null | undefined
): StatusNormalizeResult {
  const statusRaw = (raw || "").trim();
  if (!statusRaw) {
    return { status: "unknown", statusRaw: "", statusNote: "No status in extract" };
  }

  const h = statusRaw.toLowerCase().replace(/\s+/g, " ").trim();

  // Exact canonical passthrough
  if (
    h === "open" ||
    h === "closed" ||
    h === "expired" ||
    h === "issued" ||
    h === "finaled" ||
    h === "unknown"
  ) {
    return { status: h, statusRaw };
  }

  if (containsAny(h, EXPIRED)) {
    return {
      status: "expired",
      statusRaw,
      statusNote: "Mapped from AHJ wording → expired",
    };
  }
  if (containsAny(h, FINALED)) {
    return {
      status: "finaled",
      statusRaw,
      statusNote: "Mapped from AHJ wording → finaled",
    };
  }
  if (containsAny(h, ISSUED)) {
    return {
      status: "issued",
      statusRaw,
      statusNote: "Mapped from AHJ wording → issued",
    };
  }
  if (containsAny(h, CLOSED)) {
    return {
      status: "closed",
      statusRaw,
      statusNote: "Mapped from AHJ wording → closed",
    };
  }
  if (containsAny(h, OPEN)) {
    return {
      status: "open",
      statusRaw,
      statusNote: "Mapped from AHJ wording → open",
    };
  }

  return {
    status: "unknown",
    statusRaw,
    statusNote: "Unmapped AHJ status — left as unknown",
  };
}

/** Attention helpers for property UI */
export function isAttentionOpen(status: PermitStatus): boolean {
  return status === "open" || status === "issued";
}

export function needsFinalization(
  status: PermitStatus,
  finalDate: string | null | undefined
): boolean {
  return isAttentionOpen(status) && !finalDate;
}
