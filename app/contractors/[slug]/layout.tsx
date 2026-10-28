import type { ReactNode } from "react";
import { renderContractorChildren } from "@/lib/contractors/profile-stream-guard";

type Props = {
  children: ReactNode;
  params: Promise<{ slug: string }>;
};

/**
 * Check existence outside this segment's loading.tsx boundary. Once its
 * fallback streams, Next.js can no longer change the response status to 404.
 */
export default async function ContractorLayout({ children, params }: Props) {
  const { slug: raw } = await params;
  return renderContractorChildren(decodeURIComponent(raw), children);
}
