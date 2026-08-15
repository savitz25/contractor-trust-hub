import type { Metadata } from "next";
import Link from "next/link";
import { PlanStartClient } from "@/components/plan/PlanStartClient";
import { pageMetadata } from "@/lib/seo/page-meta";
import { getLiveStates } from "@/lib/states/config";

export const metadata: Metadata = pageMetadata({
  title: "Plan a project - choose your state",
  description:
    "Start project planning by choosing where the work is. Florida has full plan and studio tools; other live states support Verify. Independent research - not a marketplace.",
  path: "/plan/start",
});

export default function PlanStartPage() {
  // Serialize plain fields only for the client picker (canonical live list).
  const states = getLiveStates().map((s) => ({
    code: s.code,
    slug: s.slug,
    name: s.name,
    shortName: s.shortName,
    boardLabel: s.boardLabel,
    boardShortLabel: s.boardShortLabel,
    boardUrl: s.boardUrl,
    entityRegistryLabel: s.entityRegistryLabel,
    entityRegistryUrl: s.entityRegistryUrl,
    licenseSource: s.licenseSource,
    licenseSources: s.licenseSources,
    entitySource: s.entitySource,
    live: s.live,
    depth: s.depth,
    coverageNote: s.coverageNote,
    badge: s.badge,
    scopeHint: s.scopeHint,
    browseEnabled: s.browseEnabled,
    pilot: s.pilot,
  }));

  return (
    <main>
      <section className="border-b border-[var(--border)] bg-white/60">
        <div className="mx-auto max-w-6xl px-4 pb-8 pt-8 sm:px-6 sm:pb-10 sm:pt-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy)]">
            Before you plan
          </p>
          <h1 className="mt-3 max-w-2xl text-2xl font-semibold leading-tight tracking-tight text-[var(--text)] sm:text-4xl">
            I&apos;m planning a project
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">
            Tell us where the work is. We route you to the tools that actually exist for that state
            - we do not invent multi-state cost models or nationwide planning.
          </p>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Prefer search by name or license?{" "}
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
        <PlanStartClient states={states} />
      </section>
    </main>
  );
}
