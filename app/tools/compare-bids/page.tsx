import type { Metadata } from "next";
import { Suspense } from "react";
import { CompareBidsClient } from "@/components/decision/CompareBidsClient";

export const metadata: Metadata = {
  title: "Compare My Bids — side-by-side estimate comparison",
  description:
    "Compare 2–4 contractor quotes on the same scope. Highlights differences and missing information — no winner ranking.",
  alternates: { canonical: "/tools/compare-bids" },
};

export default function CompareBidsPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading compare bids…</p>}>
        <CompareBidsClient />
      </Suspense>
    </main>
  );
}
