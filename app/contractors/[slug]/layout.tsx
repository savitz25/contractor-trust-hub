import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getContractorBySlug } from "@/lib/contractors/queries";
import {
  isSoftProfileLookupError,
  isTransientProfileDbError,
} from "@/lib/seo/profile-lookup";

type Props = {
  children: ReactNode;
  params: Promise<{ slug: string }>;
};

/**
 * Check existence outside this segment's loading.tsx boundary. Once its
 * fallback streams, Next.js can no longer change the response status to 404.
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

export default async function ContractorLayout({ children, params }: Props) {
  const { slug: raw } = await params;
  return renderContractorChildren(decodeURIComponent(raw), children);
}
