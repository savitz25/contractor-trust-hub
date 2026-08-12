import type { Metadata } from "next";
import { PreHireChecklistClient } from "@/components/decision/PreHireChecklistClient";

export const metadata: Metadata = {
  title: "Pre-Hire Checklist — before you sign",
  description:
    "Practical pre-hire checklist and red-flag guide for Florida homeowners: license, insurance, scope, payments, permits.",
  alternates: { canonical: "/tools/pre-hire-checklist" },
};

export default function PreHireChecklistPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <PreHireChecklistClient />
    </main>
  );
}
