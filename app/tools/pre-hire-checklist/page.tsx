import type { Metadata } from "next";
import { Suspense } from "react";
import { PreHireChecklistClient } from "@/components/decision/PreHireChecklistClient";

export const metadata: Metadata = {
  title: "Pre-Hire Checklist — before you sign",
  description:
    "Practical pre-hire checklist and red-flag guide: license/registration, insurance, scope, payments, permits. Educational research only.",
  alternates: { canonical: "/tools/pre-hire-checklist" },
};

export default function PreHireChecklistPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading checklist...</p>}>
        <PreHireChecklistClient />
      </Suspense>
    </main>
  );
}
