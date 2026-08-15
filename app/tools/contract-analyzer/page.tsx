import type { Metadata } from "next";
import { Suspense } from "react";
import { ContractAnalyzerClient } from "@/components/projects/ContractAnalyzerClient";
import { pageMetadata } from "@/lib/seo/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "Contract Analyzer — review before signing",
  description:
    "Educational contract review for Florida homeowners: present, missing, and unclear consumer-protection items. Not legal advice.",
  path: "/tools/contract-analyzer",
});

export default function ContractAnalyzerPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading analyzer...</p>}>
        <ContractAnalyzerClient />
      </Suspense>
    </main>
  );
}
