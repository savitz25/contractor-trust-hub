"use client";

import Link from "next/link";
import { CompareToggle } from "@/components/compare/CompareToggle";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { statusLabel } from "@/lib/contractors/format";
import { occupationLabel } from "@/lib/states/config";
import type { PlanMatchedContractor } from "@/lib/plan/types";
import { buildFitSignals } from "@/lib/studios/fit-notes";
import {
  contractorProfileHref,
  saveHandoffClient,
  type StudioHandoff,
} from "@/lib/studios/handoff";

const toneBar: Record<string, string> = {
  good: "bg-emerald-600",
  warn: "bg-amber-500",
  neutral: "bg-slate-400",
};

type Props = {
  contractor: PlanMatchedContractor;
  primaryCodes: string[];
  handoff: StudioHandoff;
  onRequestIntro?: (slug: string, displayName: string) => void;
};

export function StudioMatchCard({
  contractor: c,
  primaryCodes,
  handoff,
  onRequestIntro,
}: Props) {
  const fit = buildFitSignals(c, primaryCodes);
  const location = [c.city, c.county, c.state].filter(Boolean).join(" · ");
  const profileHref = contractorProfileHref(c.slug, handoff);

  const openProfile = () => {
    saveHandoffClient(handoff);
  };

  return (
    <article className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-sm)] transition hover:border-[var(--navy)]/20 hover:shadow-[var(--shadow-md)]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-[var(--border)]/80 px-3.5 py-2.5 sm:px-5">
        {fit.signals.map((s) => (
          <span
            key={s.label}
            className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)]"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${toneBar[s.tone]}`} aria-hidden />
            {s.label}
          </span>
        ))}
        {c.hasDiscipline ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800">
            <span className={`h-1.5 w-1.5 rounded-full ${toneBar.warn}`} aria-hidden />
            Discipline on file
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)]">
            <span className={`h-1.5 w-1.5 rounded-full ${toneBar.good}`} aria-hidden />
            No discipline in extract
          </span>
        )}
      </div>

      <div className="p-3.5 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold leading-snug text-[var(--text)] sm:text-lg">
              <Link
                href={profileHref}
                onClick={openProfile}
                className="text-[var(--text)] no-underline hover:text-[var(--navy)]"
              >
                {c.displayName}
              </Link>
            </h3>
            {c.primaryLicenseKey ? (
              <p className="mt-1 font-mono text-sm tracking-wide text-[var(--accent)]">
                {c.primaryLicenseKey}
              </p>
            ) : null}
            {location ? (
              <p className="mt-1 text-xs text-[var(--muted)]">{location}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1.5 sm:max-w-[40%] sm:justify-end">
            <StatusBadge
              status={c.licenseStatus}
              label={`License: ${statusLabel(c.licenseStatus)}`}
            />
            {c.entityStatus ? (
              <StatusBadge
                status={c.entityStatus}
                label={`Entity: ${statusLabel(c.entityStatus)}`}
              />
            ) : (
              <StatusBadge status="unknown" label="No Sunbiz link" />
            )}
          </div>
        </div>

        <p className="mt-2.5 text-sm text-[var(--muted)]">
          {occupationLabel(c.occupationCode)}
          {c.entityName ? (
            <>
              {" · "}
              <span className="text-[var(--text)]/80">Sunbiz: {c.entityName}</span>
            </>
          ) : null}
        </p>

        <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
            Why this matched
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--text)]">{fit.fitNote}</p>
          <p className="mt-1.5 text-[11px] text-[var(--muted)]">
            Evidence only — not a ranking, endorsement, or performance score.
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <Link
            href={profileHref}
            onClick={openProfile}
            className="text-xs font-semibold text-[var(--navy)] no-underline hover:underline"
          >
            Review Trust Report →
          </Link>
          {onRequestIntro ? (
            <button
              type="button"
              onClick={() => onRequestIntro(c.slug, c.displayName)}
              className="text-xs font-semibold text-[var(--accent)] hover:underline"
            >
              Request introduction for this contractor
            </button>
          ) : null}
          <CompareToggle slug={c.slug} compact />
        </div>
      </div>
    </article>
  );
}
