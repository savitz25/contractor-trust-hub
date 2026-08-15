"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  type EvidenceState,
  type StateProductDepth,
  verifyPathFor,
} from "@/lib/states/config";

function depthLabel(depth: StateProductDepth): string {
  switch (depth) {
    case "full_journey":
      return "Full planning + Verify";
    case "specialty_verify":
      return "Specialty Verify";
    case "pilot":
      return "Verify pilot";
    case "verify":
    default:
      return "Verify available";
  }
}

function isFloridaFullPlan(s: EvidenceState): boolean {
  return s.slug === "fl" && s.depth === "full_journey";
}

/**
 * State-first plan entry. Florida continues into /plan.
 * Other live states stay on Verify - no invented cost models.
 */
export function PlanStartClient({ states }: { states: EvidenceState[] }) {
  const [slug, setSlug] = useState<string>("");
  const selected = useMemo(
    () => states.find((s) => s.slug === slug) || null,
    [states, slug]
  );

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
          Plan entry
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
          Where is the work?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Choose the state first. Full project planning tools (cost ranges, studios, Florida
          contractor match) are Florida-first today. Other live states support Verify - not
          nationwide cost models.
        </p>

        <p className="mt-6 text-sm font-medium text-[var(--text)]">State</p>
        <div
          className="mt-2 flex flex-wrap gap-2"
          role="group"
          aria-label="Where is the work"
        >
          {states.map((s) => {
            const on = slug === s.slug;
            return (
              <button
                key={s.slug}
                type="button"
                onClick={() => setSlug(s.slug)}
                aria-pressed={on}
                className={`inline-flex min-h-11 flex-col justify-center rounded-2xl border px-3.5 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] sm:min-h-10 sm:rounded-full sm:py-1.5 ${
                  on ? "control-selected" : "control-off"
                }`}
              >
                <span className="text-sm font-semibold leading-none">{s.name}</span>
                <span
                  className={`mt-1 text-[10px] font-medium leading-none ${
                    on ? "text-white/75" : "text-[var(--muted)]"
                  }`}
                >
                  {isFloridaFullPlan(s) ? "Full planning" : depthLabel(s.depth)}
                </span>
              </button>
            );
          })}
        </div>

        {!selected ? (
          <p className="mt-4 text-xs text-[var(--muted)]">
            Independent research - not a marketplace. We do not invent multi-state cost ranges.
          </p>
        ) : null}

        {selected && isFloridaFullPlan(selected) ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-4">
            <p className="text-sm font-semibold text-emerald-950">
              Florida - full planning tools
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-emerald-950/90">
              {selected.coverageNote} Continue to plan intake, cost context, and verified
              contractor match from official records.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Link
                href="/plan"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--navy)] px-5 text-sm font-semibold text-white no-underline hover:brightness-110"
              >
                Continue Florida planning
              </Link>
              <Link
                href="/studios"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium text-[var(--text)] no-underline"
              >
                Project Studios
              </Link>
              <Link
                href={verifyPathFor(selected)}
                className="inline-flex min-h-11 items-center justify-center px-3 text-sm font-medium text-[var(--navy)] no-underline hover:underline"
              >
                Or Verify in Florida
              </Link>
            </div>
          </div>
        ) : null}

        {selected && !isFloridaFullPlan(selected) ? (
          <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--bg)]/80 px-4 py-4">
            <p className="text-sm font-semibold text-[var(--text)]">
              {selected.name} - Verify available
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">
              {selected.coverageNote}
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-[var(--muted)]">
              <li>
                <strong className="font-medium text-[var(--text)]">Verify</strong> is live for{" "}
                {selected.name} ({selected.boardShortLabel}).
              </li>
              <li>
                <strong className="font-medium text-[var(--text)]">
                  Full planning tools are Florida-first
                </strong>{" "}
                today. Kitchen, bath, and roof cost studios and Florida plan match are not
                invented for {selected.name}.
              </li>
              <li>Independent research only - not a marketplace or ranking.</li>
            </ul>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Link
                href={verifyPathFor(selected)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--navy)] no-underline hover:brightness-105"
              >
                Verify contractors in {selected.name}
              </Link>
              <Link
                href="/tools/coverage"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium text-[var(--text)] no-underline"
              >
                Where we cover
              </Link>
            </div>
            <p className="mt-4 border-t border-[var(--border)] pt-3 text-xs leading-relaxed text-[var(--muted)]">
              Only open Florida planning if the work is actually in Florida (or you want to explore
              Florida tools on purpose):{" "}
              <Link href="/plan" className="font-semibold text-[var(--navy)] hover:underline">
                Continue with Florida planning tools
              </Link>
              .
            </p>
          </div>
        ) : null}
      </div>

      <p className="mt-4 text-center text-xs text-[var(--muted)]">
        Already know you need Florida calculators?{" "}
        <Link href="/studio/cost" className="font-medium text-[var(--navy)] hover:underline">
          Cost Studio
        </Link>
        {" - "}
        <Link href="/plan" className="font-medium text-[var(--navy)] hover:underline">
          Florida plan intake
        </Link>
      </p>
    </div>
  );
}
