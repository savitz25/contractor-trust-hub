"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatUsd } from "@/lib/plan/cost-model";
import {
  COST_DISCLAIMER,
  type CostRangeResult,
  type PlanMatchedContractor,
  type PlanMatchResult,
} from "@/lib/plan/types";
import { storageKey } from "@/lib/studios/context";
import { matchCoverageSummary } from "@/lib/studios/fit-notes";
import type { StudioHandoff } from "@/lib/studios/handoff";
import type { StudioAnswers, StudioContext } from "@/lib/studios/types";
import { StudioMatchCard } from "./StudioMatchCard";
import { StudioThinState } from "./StudioThinState";

type ApiResponse = {
  studio: {
    slug: string;
    name: string;
    resultFraming: string;
    primaryOccupationCodes?: string[];
  };
  context: StudioContext;
  cost: CostRangeResult;
  match: PlanMatchResult;
};

export function StudioResults({
  studioSlug,
  answers,
}: {
  studioSlug: string;
  answers: StudioAnswers;
}) {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteDone, setQuoteDone] = useState(false);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [focusContractor, setFocusContractor] = useState<{
    slug: string;
    name: string;
  } | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });

  // Open intro modal from Trust Report handoff (?intro=1&focus=)
  useEffect(() => {
    if (searchParams.get("intro") === "1") {
      const slug = searchParams.get("focus");
      const name = searchParams.get("focusName");
      if (slug) setFocusContractor({ slug, name: name || slug });
      setQuoteOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch("/api/studios/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers }),
        });
        const json = (await res.json()) as ApiResponse & { error?: string };
        if (!res.ok) throw new Error(json.error || "Failed to load studio results");
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [answers]);

  const resultsPath = useMemo(() => {
    if (typeof window === "undefined") return `/studios/${studioSlug}/results`;
    return window.location.pathname + window.location.search;
  }, [studioSlug]);

  const handoff: StudioHandoff | null = data
    ? {
        studioSlug: data.studio.slug,
        studioName: data.studio.name,
        answerSummary: data.context.answerSummary,
        resultsPath,
        projectType: data.context.projectType,
        scaleLabel: data.context.scaleLabel,
        locationLabel: [
          data.context.location.city,
          data.context.location.zip,
          data.context.location.state,
        ]
          .filter(Boolean)
          .join(" "),
      }
    : null;

  const primaryCodes =
    data?.studio.primaryOccupationCodes ||
    // fallback: extract from match notes / first contractor — API should send codes
    [];

  useEffect(() => {
    if (!data) return;
    try {
      localStorage.setItem(
        storageKey(studioSlug) + "-last-result",
        JSON.stringify({
          savedAt: new Date().toISOString(),
          context: data.context,
          cost: { low: data.cost.low, mid: data.cost.mid, high: data.cost.high },
          resultsPath,
        })
      );
    } catch {
      /* ignore */
    }
  }, [data, studioSlug, resultsPath]);

  const submitQuote = useCallback(async () => {
    if (!data) return;
    setQuoteBusy(true);
    setQuoteError(null);
    try {
      const focused = focusContractor?.slug;
      const res = await fetch("/api/plan/quote-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          notes: form.notes,
          projectType: data.context.projectType,
          location: [
            data.context.location.city,
            data.context.location.county,
            data.context.location.zip,
            data.context.location.state,
          ]
            .filter(Boolean)
            .join(", "),
          state: data.context.location.state,
          zip: data.context.location.zip,
          city: data.context.location.city,
          county: data.context.location.county,
          scale: data.context.scale,
          budgetBand: data.context.budgetBand,
          details: answers.details,
          costLow: data.cost.low,
          costMid: data.cost.mid,
          costHigh: data.cost.high,
          contractorSlugs: focused
            ? [focused]
            : data.match.contractors.map((c) => c.slug).slice(0, 12),
          studioSlug: data.studio.slug,
          studioName: data.studio.name,
          answerSummary: data.context.answerSummary,
          studioAnswers: answers.values,
          sourcePath: focusContractor
            ? "trust_report"
            : "studio_results",
          focusedContractorSlug: focused || null,
          focusedContractorName: focusContractor?.name || null,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Submit failed");
      setQuoteDone(true);
      setQuoteOpen(false);
    } catch (e) {
      setQuoteError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setQuoteBusy(false);
    }
  }, [data, form, answers, focusContractor]);

  const saveLocal = () => {
    try {
      localStorage.setItem(
        storageKey(studioSlug),
        JSON.stringify({
          values: answers.values,
          zip: answers.zip,
          city: answers.city,
          budgetBand: answers.budgetBand,
          savedAt: new Date().toISOString(),
        })
      );
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    } catch {
      alert("Could not save on this device.");
    }
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-[var(--border)] bg-white p-8 text-center">
        <p className="font-semibold text-[var(--navy)]">Building your decision view…</p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Scope-aware planning range and license matches for this studio.
        </p>
      </div>
    );
  }

  if (error || !data || !handoff) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <p className="font-semibold text-amber-950">{error || "Could not load results"}</p>
        <Link href={`/studios/${studioSlug}`} className="mt-3 inline-block text-sm font-medium">
          ← Adjust scope
        </Link>
      </div>
    );
  }

  const contractors = data.match.contractors as PlanMatchedContractor[];
  const { cost, context, studio, match } = data;
  const coverage = matchCoverageSummary(match);
  const codes =
    primaryCodes.length > 0
      ? primaryCodes
      : Array.from(
          new Set(
            contractors
              .map((c) => c.occupationCode)
              .filter(Boolean) as string[]
          )
        );

  return (
    <div className="space-y-6 pb-24 sm:pb-8">
      {/* Sticky context */}
      <div className="sticky top-[4.5rem] z-30 rounded-2xl border border-[var(--border)] bg-white/95 px-4 py-3 shadow-[var(--shadow-sm)] backdrop-blur-md sm:px-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
              {studio.name}
            </p>
            <p className="mt-0.5 text-sm font-medium text-[var(--text)]">
              {context.scaleLabel}
              {handoff.locationLabel ? ` · ${handoff.locationLabel}` : ""}
            </p>
            <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--muted)]">
              {context.answerSummary.slice(0, 3).map((line) => (
                <li key={line}>· {line}</li>
              ))}
            </ul>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              href={`/studios/${studioSlug}`}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--navy)] no-underline"
            >
              Edit scope
            </Link>
            <button
              type="button"
              onClick={saveLocal}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--navy)]"
            >
              {savedFlash ? "Saved" : "Save"}
            </button>
          </div>
        </div>
        <nav className="mt-2 flex flex-wrap gap-3 border-t border-[var(--border)]/70 pt-2 text-xs font-medium">
          <a href="#studio-cost" className="text-[var(--muted)] no-underline hover:text-[var(--navy)]">
            Cost
          </a>
          <a
            href="#studio-contractors"
            className="text-[var(--muted)] no-underline hover:text-[var(--navy)]"
          >
            Contractors
          </a>
          <a
            href="#studio-next"
            className="text-[var(--muted)] no-underline hover:text-[var(--navy)]"
          >
            Next steps
          </a>
        </nav>
      </div>

      {quoteDone ? (
        <div
          id="intro-confirm"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-950"
        >
          <p className="font-semibold">Controlled introduction request received</p>
          <p className="mt-2 leading-relaxed">
            <strong>What happens next:</strong> a person reviews your project context
            {focusContractor ? (
              <>
                {" "}
                and your interest in <strong>{focusContractor.name}</strong>
              </>
            ) : null}
            . If appropriate, we facilitate a single introduction.
          </p>
          <p className="mt-2 leading-relaxed">
            <strong>What does not happen:</strong> no mass email to contractors, no lead
            marketplace resale, no automated blast of your contact info.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
            <a href="#studio-contractors" className="text-emerald-900 underline">
              Revisit matches
            </a>
            <Link href="/verify" className="text-emerald-900 underline">
              Verify another name
            </Link>
            <Link href={`/studios/${studioSlug}`} className="text-emerald-900 underline">
              Adjust scope
            </Link>
          </div>
        </div>
      ) : null}

      {/* Cost — visually secondary */}
      <section
        id="studio-cost"
        className="scroll-mt-36 rounded-3xl border border-[var(--border)] bg-[var(--bg)]/80 p-5 sm:p-6"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          1 · Planning range
        </p>
        <h2 className="mt-1.5 text-lg font-semibold text-[var(--text)]">
          Conceptual cost range only
        </h2>
        <p className="mt-1 text-xs text-[var(--muted)]">{cost.unitNote}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">{studio.resultFraming}</p>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            { label: "Low", value: cost.low },
            { label: "Mid", value: cost.mid },
            { label: "High", value: cost.high },
          ].map((b) => (
            <div
              key={b.label}
              className={`rounded-xl border px-3 py-3 ${
                b.label === "Mid"
                  ? "border-[var(--border-strong)] bg-white"
                  : "border-[var(--border)] bg-white/60"
              }`}
            >
              <p className="text-[10px] font-semibold uppercase text-[var(--muted)]">{b.label}</p>
              <p className="mt-0.5 text-xl font-semibold text-[var(--navy)]">
                {formatUsd(b.value)}
              </p>
            </div>
          ))}
        </div>
        <ul className="mt-3 space-y-1 text-xs text-[var(--muted)]">
          {cost.drivers.slice(0, 4).map((d) => (
            <li key={d}>· {d}</li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] leading-relaxed text-[var(--muted)]">
          {cost.disclaimer || COST_DISCLAIMER}
        </p>
      </section>

      {/* Contractors — primary decision surface */}
      <section
        id="studio-contractors"
        className="scroll-mt-36 rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)] sm:p-8"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          2 · Verified contractors
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-[var(--text)]">
          Matched on license and location evidence
        </h2>
        <p className="mt-1 text-sm font-medium text-[var(--text)]">{coverage.headline}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">{coverage.scopeLine}</p>
        {match.matchNotes.length > 0 ? (
          <ul className="mt-2 space-y-1 text-xs text-[var(--muted)]">
            {match.matchNotes.slice(0, 4).map((n) => (
              <li key={n}>· {n}</li>
            ))}
          </ul>
        ) : null}

        <StudioThinState match={match} studioSlug={studioSlug} />

        {contractors.length === 0 ? null : (
          <div className="mt-6 grid gap-4">
            {contractors.map((c) => (
              <StudioMatchCard
                key={c.id}
                contractor={c}
                primaryCodes={codes}
                handoff={handoff}
                onRequestIntro={(slug, name) => {
                  setFocusContractor({ slug, name });
                  setQuoteOpen(true);
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Next actions */}
      <section
        id="studio-next"
        className="scroll-mt-36 rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)] sm:p-8"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          3 · Next steps
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-[var(--text)]">
          Review evidence before you decide
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Open a Trust Report for license status, discipline history, and business entity linkage.
          Request a controlled introduction only when you are ready — we do not mass-email
          contractors.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => {
              setFocusContractor(null);
              setQuoteOpen(true);
            }}
            className="rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-4 text-left"
          >
            <p className="text-sm font-semibold text-[var(--text)]">
              Request a controlled introduction
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Manual review · full studio scope attached
            </p>
          </button>
          <Link
            href={`/studios/${studioSlug}`}
            className="rounded-2xl border border-[var(--border)] px-4 py-4 no-underline"
          >
            <p className="text-sm font-semibold text-[var(--text)]">Adjust scope</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Edit studio answers and rematch</p>
          </Link>
          <button
            type="button"
            onClick={saveLocal}
            className="rounded-2xl border border-[var(--border)] px-4 py-4 text-left"
          >
            <p className="text-sm font-semibold text-[var(--text)]">Save for later</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Stored on this device only</p>
          </button>
        </div>
      </section>

      {/* Mobile sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-white/95 p-3 shadow-[0_-4px_20px_rgba(10,37,64,0.08)] backdrop-blur-md sm:hidden">
        <button
          type="button"
          onClick={() => {
            setFocusContractor(null);
            setQuoteOpen(true);
          }}
          className="btn-primary w-full min-h-11 px-4 py-2.5 text-sm"
        >
          Request a controlled introduction
        </button>
      </div>

      {/* Intro modal */}
      {quoteOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="intro-title"
        >
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-lg sm:rounded-2xl sm:p-6">
            <h3 id="intro-title" className="text-lg font-semibold text-[var(--text)]">
              Request a controlled introduction
            </h3>
            {focusContractor ? (
              <p className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]">
                Focused on: <strong>{focusContractor.name}</strong>
              </p>
            ) : (
              <p className="mt-1 text-sm text-[var(--muted)]">
                Your full {studio.name} scope will be attached for manual review.
              </p>
            )}
            <ul className="mt-3 space-y-1 text-xs text-[var(--muted)]">
              <li>· Manual review before any outreach</li>
              <li>· No mass email to contractors</li>
              <li>· Not a lead marketplace — we do not resell your request</li>
            </ul>
            <ul className="mt-3 max-h-20 overflow-y-auto text-xs text-[var(--muted)]">
              {context.answerSummary.map((l) => (
                <li key={l}>· {l}</li>
              ))}
            </ul>
            <div className="mt-4 space-y-3">
              {(["name", "email", "phone"] as const).map((k) => (
                <label key={k} className="block text-xs font-semibold text-[var(--muted)]">
                  {k[0].toUpperCase() + k.slice(1)}
                  <input
                    type={k === "email" ? "email" : k === "phone" ? "tel" : "text"}
                    value={form[k]}
                    onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-base font-normal text-[var(--text)] sm:text-sm"
                  />
                </label>
              ))}
              <label className="block text-xs font-semibold text-[var(--muted)]">
                Notes (optional)
                <textarea
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value.slice(0, 1000) }))
                  }
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-normal"
                />
              </label>
            </div>
            {quoteError ? <p className="mt-2 text-sm text-rose-700">{quoteError}</p> : null}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={quoteBusy}
                onClick={() => void submitQuote()}
                className="btn-primary min-h-11 flex-1 py-2 text-sm disabled:opacity-50"
              >
                {quoteBusy ? "Sending…" : "Submit request"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setQuoteOpen(false);
                  setFocusContractor(null);
                }}
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
