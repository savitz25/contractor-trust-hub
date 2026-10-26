import type { Metadata } from "next";
import { isDbCapacityError, isDbConnectTimeout, isDbQueryTimeout } from "@/lib/db";

/** Timeouts and pool-capacity failures are transient. A missing row is not an error. */
export function isTransientProfileDbError(err: unknown): boolean {
  return isDbQueryTimeout(err) || isDbConnectTimeout(err) || isDbCapacityError(err);
}

/**
 * Non-transient lookup failures keep the existing soft noindex metadata.
 * A timeout or pool error must throw so Next does not answer 200 with noindex
 * for a profile that may still exist.
 */
export function metadataAfterProfileLookupError(err: unknown): Metadata {
  if (isTransientProfileDbError(err)) throw err;
  return {
    title: "Contractor Trust Report",
    description:
      "Contractor license evidence from official public records on Contractor Trust Hub.",
    robots: { index: false, follow: true },
  };
}
