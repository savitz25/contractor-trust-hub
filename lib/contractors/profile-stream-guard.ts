import { notFound } from "next/navigation";
import { stampDbError } from "@/lib/db";
import { getContractorBySlug } from "@/lib/contractors/queries";
import {
  isSoftProfileLookupError,
  isTransientProfileDbError,
} from "@/lib/seo/profile-lookup";

/**
 * Check existence before the profile segment renders. The segment does not
 * ship a loading.tsx fallback, so a lookup timeout stays a 5xx. This module
 * is not a route file, so the layout can keep a single default export.
 */
export async function assertContractorExistsBeforeStreaming(
  slug: string,
  lookup: typeof getContractorBySlug = getContractorBySlug,
): Promise<void> {
  let contractor;
  try {
    contractor = await lookup(slug);
  } catch (error) {
    if (isTransientProfileDbError(error) || !isSoftProfileLookupError(error)) {
      stampDbError(error);
      throw error;
    }
    // Keep the page's existing soft-failure renderer for other database errors.
    return;
  }

  if (contractor === null) notFound();
}

export async function renderContractorChildren<T>(
  slug: string,
  children: T,
  lookup: typeof getContractorBySlug = getContractorBySlug,
): Promise<T> {
  await assertContractorExistsBeforeStreaming(slug, lookup);
  return children;
}
