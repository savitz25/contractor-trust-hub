import { notFound } from "next/navigation";
import { getContractorBySlug } from "@/lib/contractors/queries";
import {
  isSoftProfileLookupError,
  isTransientProfileDbError,
} from "@/lib/seo/profile-lookup";

/**
 * Check existence outside the contractor segment's loading.tsx boundary.
 * Once that fallback streams, Next.js can no longer change the response to 404.
 * This module is not a route file, so the layout can keep a single default export.
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
