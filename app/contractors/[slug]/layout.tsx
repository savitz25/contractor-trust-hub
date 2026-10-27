import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getContractorBySlug } from "@/lib/contractors/queries";
import { isTransientProfileDbError } from "@/lib/seo/profile-lookup";

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
): Promise<Awaited<ReturnType<typeof getContractorBySlug>> | null> {
  let contractor;
  try {
    contractor = await lookup(slug);
  } catch (error) {
    if (isTransientProfileDbError(error)) throw error;
    // Keep the page's existing soft-failure renderer for other database errors.
    return null;
  }

  if (!contractor) notFound();
  return contractor;
}

export default async function ContractorLayout({ children, params }: Props) {
  const { slug: raw } = await params;
  await assertContractorExistsBeforeStreaming(decodeURIComponent(raw));
  return children;
}
