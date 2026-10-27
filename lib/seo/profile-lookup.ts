import type { Metadata } from "next";
import { isDbCapacityError, isDbConnectTimeout, isDbQueryTimeout } from "@/lib/db";

/** Timeouts and pool-capacity failures are transient. A missing row is not an error. */
export function isTransientProfileDbError(err: unknown): boolean {
  return isDbQueryTimeout(err) || isDbConnectTimeout(err) || isDbCapacityError(err);
}

/** Database failures that the profile route can safely present as unavailable. */
export function isSoftProfileLookupError(err: unknown): boolean {
  if (isTransientProfileDbError(err) || !(err instanceof Error)) return false;

  const code = "code" in err && typeof err.code === "string" ? err.code : "";
  const sqlStateClass = code.slice(0, 2);
  const transientSqlStateClasses = ["08", "40", "53", "54", "55", "57", "58", "XX"];
  return (
    (/^[0-9A-Z]{5}$/.test(code) && !transientSqlStateClasses.includes(sqlStateClass)) ||
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
