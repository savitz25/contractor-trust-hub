"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadJourneyContext, type JourneyContext } from "@/lib/funnel/journey-context";

/**
 * Persistent chip showing FL journey context (contractor / project / location).
 * Hidden when empty — does not compete with primary CTAs.
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
  const bits: string[] = [];
  if (ctx.contractorName || ctx.contractorSlug) {
    bits.push(ctx.contractorName || ctx.contractorSlug || "Contractor");
  }
  if (ctx.projectType) bits.push(ctx.projectType.replace(/_/g, " "));
  if (ctx.zip) bits.push(ctx.zip);
  if (ctx.hasScope) bits.push("scope saved");
  if (ctx.hasQuoteAnalysis) bits.push("quote analyzed");
  if (!bits.length && !ctx.projectId) return null;

  return (
    <div className="border-b border-[var(--border)] bg-[var(--bg)]/80">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-1.5 sm:px-6">
        <p className="text-[11px] text-[var(--muted)]">
          <span className="font-semibold text-[var(--navy)]">Journey context</span>
          {bits.length ? ` · ${bits.join(" · ")}` : ""}
        </p>
        <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
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
          <Link href="/tools" className="text-[var(--muted)] no-underline hover:underline">
            Tools
          </Link>
        </div>
      </div>
    </div>
  );
}
