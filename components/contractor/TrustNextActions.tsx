"use client";

import Link from "next/link";
import { CompareToggle } from "@/components/compare/CompareToggle";
import { WatchButton } from "@/components/projects/WatchButton";
import type { StudioHandoff } from "@/lib/studios/handoff";

export function TrustNextActions({
  slug,
  name,
  handoff,
  projectType,
  licenseKey,
  licenseStatus,
  entityStatus,
  disciplineCount,
}: {
  slug: string;
  name: string;
  handoff?: StudioHandoff | null;
  projectType?: string | null;
  licenseKey?: string | null;
  licenseStatus?: string | null;
  entityStatus?: string | null;
  disciplineCount?: number;
}) {
  const q = new URLSearchParams();
  q.set("name", name);
  q.set("contractor", slug);
  if (projectType) q.set("type", projectType);
  if (handoff?.scaleLabel) {
    // map free scale label loosely
    const s = handoff.scaleLabel.toLowerCase();
    if (s.includes("small") || s.includes("light") || s.includes("cosmetic"))
      q.set("scale", "small");
    else if (s.includes("large") || s.includes("full") || s.includes("complex"))
      q.set("scale", "large");
    else q.set("scale", "medium");
  }
  if (handoff?.locationLabel) {
    const zip = handoff.locationLabel.match(/\b\d{5}\b/);
    if (zip) q.set("zip", zip[0]);
  }
  const toolsQs = q.toString();

  const introHref = handoff?.resultsPath
    ? `${handoff.resultsPath}${handoff.resultsPath.includes("?") ? "&" : "?"}intro=1&focus=${encodeURIComponent(slug)}&focusName=${encodeURIComponent(name)}`
    : `/plan?focus=${encodeURIComponent(slug)}`;

  return (
    <>
      <section
        id="next-actions"
        className="scroll-mt-28 rounded-3xl border border-[var(--accent)]/40 bg-[var(--accent-soft)] p-5 sm:p-6"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
          Next actions
        </p>
        <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">
          Before you hire — evidence, then tools
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          No ranking or endorsement. Use these steps to prepare questions and written scope.
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Link
            href={`/tools/quote-analyzer?${toolsQs}`}
            className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--navy)] no-underline shadow-[var(--shadow-sm)]"
          >
            Analyze a quote from this contractor
          </Link>
          <Link
            href={`/tools/contract-analyzer?${toolsQs}`}
            className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--navy)] no-underline shadow-[var(--shadow-sm)]"
          >
            Analyze a contract
          </Link>
          <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 shadow-[var(--shadow-sm)]">
            <CompareToggle slug={slug} />
            <span className="text-xs text-[var(--muted)]">Add to side-by-side compare</span>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 shadow-[var(--shadow-sm)]">
            <WatchButton
              slug={slug}
              name={name}
              licenseKey={licenseKey}
              licenseStatus={licenseStatus}
              entityStatus={entityStatus}
              disciplineCount={disciplineCount}
            />
          </div>
          <Link
            href={`/projects?${toolsQs}&watch=1`}
            className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--navy)] no-underline shadow-[var(--shadow-sm)]"
          >
            Protect an active project
          </Link>
          <Link
            href={`/passport`}
            className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--navy)] no-underline shadow-[var(--shadow-sm)]"
          >
            Save contractor work to Home Passport
          </Link>
          <Link
            href="/account"
            className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--navy)] no-underline shadow-[var(--shadow-sm)]"
          >
            Watch / alert preferences
          </Link>
          <Link
            href={`/tools/pre-hire-checklist?${toolsQs}`}
            className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--navy)] no-underline shadow-[var(--shadow-sm)]"
          >
            Open Pre-Hire Checklist
          </Link>
          <Link
            href={`/tools/scope-builder?${toolsQs}`}
            className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--navy)] no-underline shadow-[var(--shadow-sm)]"
          >
            Build / adjust project scope
          </Link>
          <Link
            href={introHref}
            className="rounded-2xl border border-[var(--navy)]/20 bg-[var(--navy)] px-4 py-3 text-sm font-semibold text-white no-underline shadow-[var(--shadow-sm)]"
          >
            Request controlled introduction
          </Link>
        </div>

        {handoff ? (
          <p className="mt-3 text-xs text-[var(--muted)]">
            Project context from {handoff.studioName} is preserved in tool links when possible.{" "}
            <Link href={handoff.resultsPath} className="font-semibold text-[var(--navy)]">
              Back to studio results →
            </Link>
          </p>
        ) : null}
      </section>

      {/* Mobile sticky actions */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-white/95 p-3 shadow-[0_-6px_24px_rgba(10,37,64,0.1)] backdrop-blur-md sm:hidden">
        <div className="flex gap-2">
          <Link
            href={`/tools/quote-analyzer?${toolsQs}`}
            className="flex-1 rounded-xl bg-[var(--navy)] py-2.5 text-center text-xs font-semibold text-white no-underline"
          >
            Analyze quote
          </Link>
          <Link
            href={`/tools/pre-hire-checklist?${toolsQs}`}
            className="flex-1 rounded-xl border border-[var(--border)] py-2.5 text-center text-xs font-semibold text-[var(--navy)] no-underline"
          >
            Checklist
          </Link>
          <CompareToggle slug={slug} compact />
        </div>
      </div>
    </>
  );
}
