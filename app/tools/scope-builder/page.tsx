import type { Metadata } from "next";
import { Suspense } from "react";
import { ScopeBuilderClient } from "@/components/decision/ScopeBuilderClient";

export const metadata: Metadata = {
  title: "Scope Builder — contractor-ready project scope",
  description:
    "Build a clear project scope so Florida contractor bids can be compared fairly. Educational worksheet — not a contract.",
  alternates: { canonical: "/tools/scope-builder" },
};

export default function ScopeBuilderPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading scope builder…</p>}>
        <ScopeBuilderClient />
      </Suspense>
    </main>
  );
}
