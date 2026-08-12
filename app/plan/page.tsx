import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PlanFlow } from "@/components/plan/PlanFlow";

export const metadata: Metadata = {
  title: "Plan your project — cost ranges & verified contractors",
  description:
    "Describe a home project, see conceptual Florida cost ranges, and discover verified licensed contractors. Plan clearly. Verify thoroughly. Hire with confidence.",
  alternates: { canonical: "/plan" },
  openGraph: {
    title: "Plan your project | Contractor Trust Hub",
    description:
      "Project context, realistic planning cost ranges, and verified Florida contractors — before you hire.",
    url: "/plan",
    type: "website",
  },
};

export default function PlanPage() {
  return (
    <main>
      <section className="border-b border-[var(--border)] bg-white/60">
        <div className="mx-auto max-w-6xl px-4 pb-8 pt-8 sm:px-6 sm:pb-12 sm:pt-14">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy)]">
            Plan → verify → hire
          </p>
          <h1 className="mt-3 max-w-2xl text-2xl font-semibold leading-tight tracking-tight text-[var(--text)] sm:text-4xl">
            Plan your project. See realistic ranges. Find verified contractors.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)] sm:mt-4 sm:text-base">
            A short intake — not a design studio. Get conceptual cost context for Florida project
            types, then match active licensed contractors from official public records.
          </p>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Already have a name?{" "}
            <Link
              href="/verify"
              className="font-medium text-[var(--navy)] underline-offset-2 hover:underline"
            >
              Verify a contractor
            </Link>{" "}
            instead.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <Suspense
          fallback={
            <div className="mx-auto max-w-2xl rounded-3xl border border-[var(--border)] bg-white p-8 text-center text-sm text-[var(--muted)] shadow-[var(--shadow-md)]">
              Loading plan…
            </div>
          }
        >
          <PlanFlow />
        </Suspense>
      </section>
    </main>
  );
}
