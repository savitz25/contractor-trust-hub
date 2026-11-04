import type { Metadata } from "next";
import { isDbCapacityError, isDbConnectTimeout, isDbQueryTimeout } from "@/lib/db";

/** Timeouts and pool-capacity failures are transient. A missing row is not an error. */
export function isTransientProfileDbError(err: unknown): boolean {
  return isDbQueryTimeout(err) || isDbConnectTimeout(err) || isDbCapacityError(err);
}

/**
 * Only explicit setup failures and pg transport errors are safe for the
 * existing soft-failure UI. PostgreSQL SQLSTATEs are never soft failures:
 * they may identify query or schema defects (for example, 42601 or 42P01).
 */
export function isSoftProfileLookupError(err: unknown): boolean {
  if (isTransientProfileDbError(err) || !(err instanceof Error)) return false;

  const code = "code" in err && typeof err.code === "string" ? err.code : "";
  return (
    [
      "ECONNREFUSED",
      "ECONNRESET",
      "EPIPE",
      "ENOTFOUND",
      "EAI_AGAIN",
      "ERR_INVALID_URL",
    ].includes(code) ||
    err.message.startsWith("DATABASE_URL is not set") ||
    err.message.startsWith("DATABASE_URL is missing or invalid")
  );
}

/**
 * Recognized database failures keep the existing soft noindex metadata.
 * Transient or unexpected errors propagate so a possibly existing profile is
 * never presented as missing or as an ordinary noindex report.
 */
export function metadataAfterProfileLookupError(err: unknown): Metadata {
  if (!isSoftProfileLookupError(err)) throw err;
  return {
    title: "Contractor Trust Report",
    description:
      "Contractor license evidence from official public records on Contractor Trust Hub.",
    robots: { index: false, follow: true },
  };
}
