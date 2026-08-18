import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PlanFlow } from "@/components/plan/PlanFlow";
import { pageMetadata } from "@/lib/seo/page-meta";
import { JourneyNextStep } from "@/components/network/JourneyNextStep";
import {
  parseNetworkJourney,
  resolveContractorJourneyModule,
} from "@/lib/network/journey-handoff";

export const metadata: Metadata = pageMetadata({
  title: "Florida plan - cost ranges and verified contractors",
  description:
    "Describe a Florida home project, see conceptual planning cost ranges, and match verified licensed contractors. Planning only - not a bid. Full plan tools are Florida-first.",
  path: "/plan",
});

export default async function PlanPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : {};
  const journeyModule = resolveContractorJourneyModule(parseNetworkJourney(sp), "plan");
  return (
    <main>
      <section className="border-b border-[var(--border)] bg-white/60">
        <div className="mx-auto max-w-6xl px-4 pb-8 pt-8 sm:px-6 sm:pb-12 sm:pt-14">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy)]">
            Florida - Plan, verify, hire
          </p>
          <h1 className="mt-3 max-w-2xl text-2xl font-semibold leading-tight tracking-tight text-[var(--text)] sm:text-4xl">
            Plan your Florida project. See realistic ranges. Find verified contractors.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)] sm:mt-4 sm:text-base">
            A short intake - not a design studio. Conceptual cost context for{" "}
            <strong className="font-medium text-[var(--text)]">Florida</strong> project types, then
            match active licensed contractors from official public records. Not nationwide
            planning.
          </p>
          <p className="mt-4 max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
            This intake is Florida planning. Work outside Florida?{" "}
            <Link
              href="/plan/start"
              className="font-semibold text-[var(--navy)] underline-offset-2 hover:underline"
            >
              Choose your state first
            </Link>
            {" - "}
            Verify is live in other states; we do not invent their cost tools.
          </p>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Want a deeper cost walkthrough?{" "}
            <Link
              href="/studio/cost"
              className="font-medium text-[var(--navy)] underline-offset-2 hover:underline"
            >
              Cost Studio
            </Link>
            {" - "}
            <Link
              href="/studio/kitchen"
              className="font-medium text-[var(--navy)] underline-offset-2 hover:underline"
            >
              Kitchen calculator
            </Link>
            {" - "}
            <Link
              href="/studio/bathroom"
              className="font-medium text-[var(--navy)] underline-offset-2 hover:underline"
            >
              Bathroom calculator
            </Link>
            {" - "}
            <Link
              href="/studio/roofing"
              className="font-medium text-[var(--navy)] underline-offset-2 hover:underline"
            >
              Roofing calculator
            </Link>
            . Already have a name?{" "}
            <Link
              href="/verify"
              className="font-medium text-[var(--navy)] underline-offset-2 hover:underline"
            >
              Verify a contractor
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <Suspense
          fallback={
            <div className="mx-auto max-w-2xl rounded-3xl border border-[var(--border)] bg-white p-8 text-center text-sm text-[var(--muted)] shadow-[var(--shadow-md)]">
              Loading plan...
            </div>
          }
        >
          <PlanFlow />
        </Suspense>
      </section>
      <JourneyNextStep module={journeyModule} />
    </main>
  );
}
