import type { Metadata } from "next";
import { Suspense } from "react";
import { QuoteAnalyzerClient } from "@/components/decision/QuoteAnalyzerClient";

export const metadata: Metadata = {
  title: "Quote Analyzer — review one contractor estimate",
  description:
    "Analyze a single contractor quote for scope gaps, caution patterns, and questions to ask. Conceptual price context only — not bid validation.",
  alternates: { canonical: "/tools/quote-analyzer" },
};

export default function QuoteAnalyzerPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading quote analyzer...</p>}>
        <QuoteAnalyzerClient />
      </Suspense>
    </main>
  );
}
