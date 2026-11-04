import type { ReactNode } from "react";
import { renderContractorChildren } from "@/lib/contractors/profile-stream-guard";

type Props = {
  children: ReactNode;
  params: Promise<{ slug: string }>;
};

/**
 * Check existence before the page renders. This segment has no loading.tsx,
 * so a data timeout rejects the response instead of streaming a 200 shell.
 */
export default async function ContractorLayout({ children, params }: Props) {
  const { slug: raw } = await params;
  return renderContractorChildren(decodeURIComponent(raw), children);
}
