"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  loadHandoffClient,
  type StudioHandoff,
} from "@/lib/studios/handoff";

type Props = {
  /** From URL parse on server, preferred. */
  initial?: StudioHandoff | null;
  contractorSlug: string;
  contractorName: string;
};

/**
 * Banner when user arrives at Trust Report from a Project Studio.
 */
export function StudioHandoffBanner({
  initial,
  contractorSlug,
  contractorName,
}: Props) {
  const [handoff, setHandoff] = useState<StudioHandoff | null>(initial ?? null);

  useEffect(() => {
    if (initial) {
      setHandoff(initial);
      return;
    }
    setHandoff(loadHandoffClient());
  }, [initial]);

  if (!handoff) return null;

  const introHref = `/studios/${handoff.studioSlug}/results?intro=1&focus=${encodeURIComponent(contractorSlug)}&focusName=${encodeURIComponent(contractorName)}&${handoff.resultsPath.includes("?") ? handoff.resultsPath.split("?")[1] || "" : ""}`;

  // Prefer full results path from handoff
  const backHref = handoff.resultsPath.startsWith("/")
    ? handoff.resultsPath
    : `/studios/${handoff.studioSlug}`;

  return (
    <div className="mt-4 rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent-soft)] px-4 py-3.5 sm:px-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--navy)]">
        Project context
      </p>
      <p className="mt-1 text-sm font-semibold text-[var(--text)]">
        You arrived from the {handoff.studioName}
      </p>
      {handoff.answerSummary.length > 0 ? (
        <ul className="mt-1.5 space-y-0.5 text-xs text-[var(--muted)]">
          {handoff.answerSummary.slice(0, 4).map((line) => (
            <li key={line}>· {line}</li>
          ))}
        </ul>
      ) : null}
      {(handoff.scaleLabel || handoff.locationLabel) && (
        <p className="mt-1 text-xs text-[var(--muted)]">
          {[handoff.scaleLabel, handoff.locationLabel].filter(Boolean).join(" · ")}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={backHref}
          className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--navy)] no-underline"
        >
          ← Back to studio results
        </Link>
        <Link
          href={introHref}
          className="btn-primary rounded-lg px-3 py-1.5 text-xs font-semibold no-underline"
        >
          Request a controlled introduction for this project
        </Link>
      </div>
      <p className="mt-2 text-[11px] text-[var(--muted)]">
        Review license status, discipline history, and entity linkage below before you decide.
      </p>
    </div>
  );
}
