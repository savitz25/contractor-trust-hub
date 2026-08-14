"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  hasProjectContext,
  loadProjectContext,
  projectContextSummary,
  saveProjectContext,
  type ProjectContext,
} from "@/lib/project-context/store";

/**
 * Optional lightweight prompt on Florida discovery when plan/studio context exists.
 * Does not invent multi-state plan depth.
 */
export function ProjectContextPrompt({
  countyName,
  countySlug,
}: {
  countyName?: string | null;
  countySlug?: string | null;
}) {
  const [ctx, setCtx] = useState<ProjectContext | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const read = () => setCtx(loadProjectContext());
    read();
    window.addEventListener("cth-journey-change", read);
    return () => window.removeEventListener("cth-journey-change", read);
  }, []);

  // If user is browsing a county, softly attach it to context
  useEffect(() => {
    if (!countyName) return;
    const current = loadProjectContext();
    if (current.county === countyName) return;
    if (!hasProjectContext(current) && !countySlug) return;
    // Only write county when we already have project context (don't invent a full plan)
    if (hasProjectContext(current)) {
      saveProjectContext({
        county: countyName,
        state: "fl",
        entryPath: current.entryPath || "discovery",
      });
    }
  }, [countyName, countySlug]);

  if (dismissed || !ctx || !hasProjectContext(ctx)) return null;

  const bits = projectContextSummary(ctx);

  return (
    <div className="mb-4 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent-soft)]/60 px-4 py-3 sm:px-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--navy)]">
            Your project context
          </p>
          <p className="mt-1 text-sm text-[var(--text)]">
            {bits.join(" · ")}
            <span className="text-[var(--muted)]"> · saved on this device</span>
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Evidence browse only — not ranked recommendations. Save up to 3 finalists, then Compare.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/plan"
            className="inline-flex min-h-9 items-center rounded-xl border border-[var(--navy)]/20 bg-white px-3 text-xs font-semibold text-[var(--navy)] no-underline"
          >
            Edit plan
          </Link>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="inline-flex min-h-9 items-center rounded-xl px-3 text-xs font-medium text-[var(--muted)] hover:text-[var(--text)]"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
