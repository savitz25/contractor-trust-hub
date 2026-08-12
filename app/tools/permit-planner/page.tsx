import type { Metadata } from "next";
import { Suspense } from "react";
import { PermitPlannerClient } from "@/components/property/PermitPlannerClient";
import { pageMetadata } from "@/lib/seo/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "Permit & Inspection Planner",
  description:
    "Educational Florida permit planning by project type and location. Not an official AHJ determination.",
  path: "/tools/permit-planner",
});

export default function PermitPlannerPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading planner…</p>}>
        <PermitPlannerClient />
      </Suspense>
    </main>
  );
}
