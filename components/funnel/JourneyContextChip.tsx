"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  clearJourneyContext,
  loadJourneyContext,
  type JourneyContext,
} from "@/lib/funnel/journey-context";
import {
  floridaBrowseHrefFromContext,
  hasProjectContext,
  loadProjectContext,
  projectContextSummary,
} from "@/lib/project-context/store";

/**
 * Persistent chip: project context (type / location) across FL plan → browse → verify.
 * Hidden when empty. Not a marketplace signal.
 */
export function JourneyContextChip() {
  const [ctx, setCtx] = useState<JourneyContext | null>(null);

  useEffect(() => {
    const read = () => setCtx(loadJourneyContext());
    read();
    window.addEventListener("cth-journey-change", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("cth-journey-change", read);
      window.removeEventListener("storage", read);
    };
  }, []);

  if (!ctx) return null;

  const project = loadProjectContext();
  const projectBits = hasProjectContext(project) ? projectContextSummary(project) : [];

  const bits: string[] = [];
  if (ctx.contractorName || ctx.contractorSlug) {
    bits.push(ctx.contractorName || ctx.contractorSlug || "Contractor");
  }
  for (const b of projectBits) {
    if (!bits.includes(b)) bits.push(b);
  }
  if (ctx.hasScope) bits.push("scope saved");
  if (ctx.hasQuoteAnalysis) bits.push("quote analyzed");

  if (!bits.length && !ctx.projectId) return null;

  const browseHref = floridaBrowseHrefFromContext(project);

  return (
    <div className="border-b border-[var(--border)] bg-[var(--bg)]/80 print:hidden">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-1.5 sm:px-6">
        <p className="text-[11px] text-[var(--muted)]">
          <span className="font-semibold text-[var(--navy)]">Project context</span>
          <span className="text-[var(--muted)]"> · saved on this device</span>
          {bits.length ? ` · ${bits.slice(0, 5).join(" · ")}` : ""}
        </p>
        <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
          {hasProjectContext(project) ? (
            <Link
              href={browseHref}
              className="text-[var(--navy)] no-underline hover:underline"
            >
              Browse Florida
            </Link>
          ) : null}
          {ctx.projectId ? (
            <Link
              href={`/projects/${encodeURIComponent(ctx.projectId)}`}
              className="text-[var(--navy)] no-underline hover:underline"
            >
              Continue project
            </Link>
          ) : null}
          {ctx.contractorSlug ? (
            <Link
              href={`/contractors/${encodeURIComponent(ctx.contractorSlug)}`}
              className="text-[var(--navy)] no-underline hover:underline"
            >
              Trust Report
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => clearJourneyContext()}
            className="text-[var(--muted)] hover:text-[var(--text)] hover:underline"
          >
            Clear context
          </button>
        </div>
      </div>
    </div>
  );
}
