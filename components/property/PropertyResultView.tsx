"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { coverageLabel } from "@/lib/property/coverage";
import { localCostContextNote } from "@/lib/property/cost-notes";
import {
  permitPlannerHref,
  planWithPropertyHref,
  propertyContextFromResult,
  savePropertyContext,
} from "@/lib/property/session";
import type { PropertyResearchResult } from "@/lib/property/types";
import { formatUsd } from "@/lib/plan/cost-model";

const STATUS_STYLE: Record<string, string> = {
  open: "border-amber-200 bg-amber-50 text-amber-950",
  issued: "border-sky-200 bg-sky-50 text-sky-950",
  expired: "border-rose-200 bg-rose-50 text-rose-900",
  closed: "border-slate-200 bg-slate-50 text-slate-700",
  finaled: "border-emerald-200 bg-emerald-50 text-emerald-900",
  unknown: "border-[var(--border)] bg-white text-[var(--muted)]",
};

export function PropertyResultView({ result }: { result: PropertyResearchResult }) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const ctx = propertyContextFromResult(result);
    if (ctx) savePropertyContext(ctx);
  }, [result]);

  const save = () => {
    const ctx = propertyContextFromResult(result);
    if (ctx) {
      savePropertyContext(ctx);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const costNote = localCostContextNote({
    county: result.county,
    coverage: result.coverage,
  });

  return (
    <div className="space-y-6 pb-16">
      <nav className="flex flex-wrap gap-2 text-xs font-semibold">
        {[
          { href: "#snapshot", label: "Snapshot" },
          { href: "#permits", label: "Permits" },
          { href: "#flags", label: "Flags" },
          { href: "#next", label: "Next" },
        ].map((l) => (
          <a
            key={l.href}
            href={l.href}
            className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-[var(--muted)] no-underline hover:text-[var(--navy)]"
          >
            {l.label}
          </a>
        ))}
      </nav>

      {/* A. Snapshot */}
      <section
        id="snapshot"
        className="scroll-mt-24 rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)] sm:p-8"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          Property research
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--text)] sm:text-3xl">
          {result.normalizedAddress || "Address result"}
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">{result.resolveMessage}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 py-1 text-xs font-semibold text-[var(--text)]">
            {coverageLabel(result.coverage)}
          </span>
          {result.county ? (
            <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
              {result.county} County
            </span>
          ) : null}
          {result.dataFreshness ? (
            <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
              Extract freshness: {result.dataFreshness}
            </span>
          ) : null}
        </div>

        <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">{result.coverageNote}</p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-900">
              What we checked
            </p>
            <ul className="mt-2 space-y-1 text-xs text-emerald-950/90">
              {result.checked.map((c) => (
                <li key={c}>· {c}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-900">
              What we did not check
            </p>
            <ul className="mt-2 space-y-1 text-xs text-amber-950/90">
              {result.notChecked.map((c) => (
                <li key={c}>· {c}</li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-[var(--muted)]">{costNote}</p>

        {result.resolutionNotes?.length ? (
          <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg)]/50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              How this address was resolved
            </p>
            <ul className="mt-2 space-y-1 text-xs text-[var(--muted)]">
              {result.resolutionNotes.map((n) => (
                <li key={n}>· {n}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* C. Flags */}
      <section
        id="flags"
        className="scroll-mt-24 rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6"
      >
        <h2 className="text-lg font-semibold text-[var(--text)]">Attention flags</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Cautious signals from available extracts only — not legal determinations.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div
            className={`rounded-xl border px-4 py-3 ${
              (result.issuedOpenCount ?? result.openCount) > 0
                ? "border-amber-200 bg-amber-50"
                : "border-[var(--border)] bg-[var(--bg)]/40"
            }`}
          >
            <p className="text-sm font-semibold text-[var(--text)]">Open / issued</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--navy)]">
              {result.issuedOpenCount ?? result.openCount}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {(result.issuedOpenCount ?? result.openCount) > 0
                ? "Appears open or issued in available records. Confirm with the AHJ."
                : "None flagged in current extracts for this address."}
            </p>
          </div>
          <div
            className={`rounded-xl border px-4 py-3 ${
              (result.finalizationMissingCount ?? 0) > 0
                ? "border-sky-200 bg-sky-50"
                : "border-[var(--border)] bg-[var(--bg)]/40"
            }`}
          >
            <p className="text-sm font-semibold text-[var(--text)]">Finalization not shown</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--navy)]">
              {result.finalizationMissingCount ?? 0}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Issued/open rows without a final date in current extracts.
            </p>
          </div>
          <div
            className={`rounded-xl border px-4 py-3 ${
              result.expiredUnresolvedCount > 0
                ? "border-rose-200 bg-rose-50"
                : "border-[var(--border)] bg-[var(--bg)]/40"
            }`}
          >
            <p className="text-sm font-semibold text-[var(--text)]">Expired status rows</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--navy)]">
              {result.expiredUnresolvedCount}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Worth confirming — not a finding of liability.
            </p>
          </div>
        </div>
      </section>

      {/* B. Permit history */}
      <section
        id="permits"
        className="scroll-mt-24 rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6"
      >
        <h2 className="text-lg font-semibold text-[var(--text)]">Permit history</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Source-attributed rows only. Empty list ≠ clean history.
        </p>

        {result.permits.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg)]/50 px-4 py-6">
            <p className="text-sm font-medium text-[var(--text)]">
              {result.coverage === "jurisdiction_unsupported"
                ? "Jurisdiction not yet connected to permit extracts"
                : "No permit records matched this address in current datasets"}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
              You can still use the Permit &amp; Inspection Planner for project-type guidance, and
              verify contractors independently. Local building department records remain the
              authority.
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {result.permits.map((p) => (
              <li
                key={p.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--bg)]/30 px-4 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text)]">{p.description}</p>
                    <p className="mt-0.5 font-mono text-xs text-[var(--accent)]">
                      {p.permitNumber || "No number in extract"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLE[p.status] || STATUS_STYLE.unknown}`}
                  >
                    {p.status}
                  </span>
                </div>
                <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="text-[var(--muted)]">Category</dt>
                    <dd>{p.category}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted)]">Declared value</dt>
                    <dd>
                      {p.declaredValue != null ? formatUsd(p.declaredValue) : "Not shown"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted)]">Filed / issued / final</dt>
                    <dd>
                      {[p.filedDate, p.issuedDate, p.finalDate || "final not shown"]
                        .filter(Boolean)
                        .join(" · ")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted)]">Source</dt>
                    <dd>
                      {p.sourceJurisdiction} · {p.sourceLabel}
                    </dd>
                  </div>
                </dl>
                {p.contractorName || p.contractorLicenseKey ? (
                  <div className="mt-3 border-t border-[var(--border)] pt-3 text-sm">
                    <p className="text-xs text-[var(--muted)]">Contractor on permit (as filed)</p>
                    <p className="font-medium text-[var(--text)]">
                      {p.contractorName || "Name not shown"}
                      {p.contractorLicenseKey ? ` · ${p.contractorLicenseKey}` : ""}
                    </p>
                    {p.matchLabel ? (
                      <p className="mt-1 text-[11px] font-medium text-[var(--navy)]">
                        {p.matchLabel}
                        {p.matchMethod === "license" && p.contractorSlug
                          ? " · High-confidence match"
                          : ""}
                      </p>
                    ) : null}
                    {p.contractorSlug ? (
                      <Link
                        href={`/contractors/${encodeURIComponent(p.contractorSlug)}`}
                        className="mt-1 inline-block text-xs font-semibold text-[var(--navy)]"
                      >
                        Open Trust Report →
                      </Link>
                    ) : p.contractorLicenseKey || p.contractorName ? (
                      <Link
                        href={`/verify?q=${encodeURIComponent(p.contractorLicenseKey || p.contractorName || "")}`}
                        className="mt-1 inline-block text-xs font-semibold text-[var(--navy)]"
                      >
                        Verify this contractor →
                      </Link>
                    ) : null}
                    {p.matchConfidence === "none" ? (
                      <p className="mt-1 text-[11px] text-[var(--muted)]">
                        Name-only data is not auto-linked. License-number matches only.
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {p.retrievedAt ? (
                  <p className="mt-2 text-[11px] text-[var(--muted)]">
                    Source freshness: {p.retrievedAt} · {p.sourceLabel}
                  </p>
                ) : null}
                {p.notes ? (
                  <p className="mt-2 text-xs italic text-[var(--muted)]">{p.notes}</p>
                ) : null}
                {(p.status === "open" || p.status === "issued") && !p.finalDate ? (
                  <p className="mt-2 text-xs text-amber-900">
                    Appears open in available records. Finalization not shown in current extracts.
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* E. Next actions */}
      <section
        id="next"
        className="scroll-mt-24 rounded-3xl border border-[var(--accent)]/40 bg-[var(--accent-soft)] p-5 sm:p-6"
      >
        <h2 className="text-lg font-semibold text-[var(--text)]">Next actions</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Carry this property into planning and decision tools.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Link
            href={
              result.propertyId
                ? planWithPropertyHref({
                    propertyId: result.propertyId,
                    normalizedAddress: result.normalizedAddress,
                    zip: result.zip,
                    city: result.city,
                    county: result.county,
                    countySlug: result.countySlug,
                    coverage: result.coverage,
                    savedAt: new Date().toISOString(),
                  })
                : "/plan"
            }
            className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--navy)] no-underline"
          >
            Plan a project at this property
          </Link>
          <Link
            href={permitPlannerHref({
              zip: result.zip,
              city: result.city,
              county: result.county || undefined,
            })}
            className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--navy)] no-underline"
          >
            Open Permit &amp; Inspection Planner
          </Link>
          <Link
            href={`/tools/quote-analyzer?zip=${result.zip}${result.city ? `&city=${encodeURIComponent(result.city)}` : ""}`}
            className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--navy)] no-underline"
          >
            Analyze a quote
          </Link>
          <Link
            href="/tools/pre-hire-checklist"
            className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--navy)] no-underline"
          >
            Pre-hire checklist
          </Link>
          <Link
            href={`/studios?zip=${result.zip}`}
            className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--navy)] no-underline"
          >
            Open Project Studios
          </Link>
          <button
            type="button"
            onClick={save}
            className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-left text-sm font-semibold text-[var(--navy)]"
          >
            {saved ? "Saved to this device" : "Save property to session"}
          </button>
        </div>
      </section>

      <p className="text-[11px] leading-relaxed text-[var(--muted)]">
        Educational property research only — not a title search, not legal advice, and not a complete
        AHJ extract. Local building departments control permit requirements and status.
      </p>
    </div>
  );
}
