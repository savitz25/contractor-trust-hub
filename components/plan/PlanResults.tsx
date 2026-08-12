"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ResultCard } from "@/components/search/ResultCard";
import { formatUsd } from "@/lib/plan/cost-model";
import { encodePlanQuery } from "@/lib/plan/plan-url";
import type {
  CostRangeResult,
  PlanInput,
  PlanMatchResult,
  PlanMatchedContractor,
} from "@/lib/plan/types";
import { COST_DISCLAIMER } from "@/lib/plan/types";

const PLAN_STORAGE_KEY = "cth-plan-context";

type ApiResponse = {
  plan: PlanInput;
  summary: { projectLabel: string; scaleLabel: string; locationLabel: string };
  cost: CostRangeResult;
  match: PlanMatchResult;
  error?: string;
};

export function PlanResults({ plan }: { plan: PlanInput }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteDone, setQuoteDone] = useState(false);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });

  const editHref = useMemo(() => `/plan?${encodePlanQuery(plan)}`, [plan]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await fetch("/api/plan/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(plan),
        });
        const json = (await res.json()) as ApiResponse & { error?: string };
        if (!res.ok) throw new Error(json.error || "Matching failed");
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Something went wrong");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [plan]);

  // Auto-save context for return visits
  useEffect(() => {
    if (!data) return;
    try {
      localStorage.setItem(
        PLAN_STORAGE_KEY,
        JSON.stringify({
          savedAt: new Date().toISOString(),
          plan: data.plan,
          summary: data.summary,
          cost: {
            low: data.cost.low,
            mid: data.cost.mid,
            high: data.cost.high,
          },
          resultsPath:
            typeof window !== "undefined"
              ? `${window.location.pathname}${window.location.search}`
              : null,
        })
      );
    } catch {
      /* ignore */
    }
  }, [data]);

  const saveExplicit = useCallback(() => {
    if (!data) return;
    try {
      localStorage.setItem(
        PLAN_STORAGE_KEY,
        JSON.stringify({
          savedAt: new Date().toISOString(),
          plan: data.plan,
          summary: data.summary,
          cost: {
            low: data.cost.low,
            mid: data.cost.mid,
            high: data.cost.high,
          },
          resultsPath:
            typeof window !== "undefined"
              ? `${window.location.pathname}${window.location.search}`
              : null,
        })
      );
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 2800);
    } catch {
      setSavedFlash(false);
      window.alert("Could not save on this device (storage blocked).");
    }
  }, [data]);

  const submitQuote = useCallback(async () => {
    if (!data) return;
    setQuoteError(null);
    if (form.name.trim().length < 2) {
      setQuoteError("Please enter your name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setQuoteError("Please enter a valid email.");
      return;
    }
    if (form.phone.trim().length < 7) {
      setQuoteError("Please enter a phone number.");
      return;
    }
    setQuoteBusy(true);
    try {
      const res = await fetch("/api/plan/quote-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          notes: form.notes,
          projectType: data.plan.projectType,
          location: data.summary.locationLabel,
          state: data.plan.state,
          zip: data.plan.zip,
          city: data.plan.city,
          county: data.plan.county,
          scale: data.plan.scale,
          budgetBand: data.plan.budgetBand,
          details: data.plan.details,
          costLow: data.cost.low,
          costMid: data.cost.mid,
          costHigh: data.cost.high,
          contractorSlugs: data.match.contractors.map((c) => c.slug).slice(0, 12),
        }),
      });
      const json = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) throw new Error(json.error || "Could not submit request");
      setQuoteDone(true);
      setQuoteOpen(false);
      try {
        sessionStorage.setItem("cth-quote-submitted", new Date().toISOString());
      } catch {
        /* ignore */
      }
    } catch (e) {
      setQuoteError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setQuoteBusy(false);
    }
  }, [data, form]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-[var(--border)] bg-white p-8 text-center shadow-[var(--shadow-md)]">
        <p className="text-sm font-semibold text-[var(--navy)]">Building your project context…</p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Loading planning ranges and matching active Florida licenses.
        </p>
        <div className="mx-auto mt-5 h-1.5 w-48 overflow-hidden rounded-full bg-[var(--border)]">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-[var(--accent)]" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 sm:p-8">
        <p className="font-semibold text-amber-950">We couldn&apos;t load matches</p>
        <p className="mt-2 text-sm text-amber-900/90">{error || "Unknown error"}</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Link
            href={editHref}
            className="btn-primary inline-flex min-h-11 items-center justify-center px-4 py-2 text-sm no-underline"
          >
            Edit project
          </Link>
          <Link
            href="/verify"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium no-underline"
          >
            Verify a contractor
          </Link>
        </div>
      </div>
    );
  }

  const { cost, match, summary } = data;
  const contractors: PlanMatchedContractor[] = match.contractors;
  const localCount = match.localCount ?? 0;
  const thin = Boolean(match.thinResult);

  return (
    <div className="space-y-6 pb-24 sm:space-y-8 sm:pb-8">
      {/* Sticky project context */}
      <div className="sticky top-[7.5rem] z-30 -mx-1 rounded-2xl border border-[var(--border)] bg-white/95 px-4 py-3 shadow-[var(--shadow-md)] backdrop-blur-md sm:static sm:mx-0 sm:bg-white sm:backdrop-blur-none">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--navy)]">
              Your project
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-[var(--text)] sm:text-base">
              {summary.projectLabel}
              <span className="font-normal text-[var(--muted)]"> · {summary.scaleLabel}</span>
            </p>
            <p className="truncate text-xs text-[var(--muted)]">{summary.locationLabel}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={editHref}
              className="inline-flex min-h-10 items-center rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-medium text-[var(--navy)] no-underline hover:bg-[var(--bg)]"
            >
              Edit answers
            </Link>
            <button
              type="button"
              onClick={saveExplicit}
              className="inline-flex min-h-10 items-center rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-medium text-[var(--muted)] hover:text-[var(--navy)]"
            >
              {savedFlash ? "Saved on this device ✓" : "Save for later"}
            </button>
          </div>
        </div>
        {/* Progress chips */}
        <ol className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-semibold sm:mt-4">
          {[
            { n: "1", t: "Cost range", id: "plan-cost" },
            { n: "2", t: "Contractors", id: "plan-contractors" },
            { n: "3", t: "Next steps", id: "plan-next" },
          ].map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1 text-[var(--muted)] no-underline hover:border-[var(--navy)]/20 hover:text-[var(--navy)]"
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--navy)] text-[10px] text-white">
                  {s.n}
                </span>
                {s.t}
              </a>
            </li>
          ))}
        </ol>
      </div>

      {/* Confirmation after quote */}
      {quoteDone ? (
        <section
          id="quote-confirmation"
          className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-[var(--shadow-sm)] sm:p-7"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">
            Request received
          </p>
          <h2 className="mt-2 text-xl font-semibold text-emerald-950 sm:text-2xl">
            Thank you — we have your project context
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-emerald-900/90">
            A team member can review your project ({summary.projectLabel} · {summary.locationLabel})
            and, if appropriate, facilitate introductions to verified contractors you selected or
            that match this context.
          </p>
          <div className="mt-4 grid gap-2 text-sm text-emerald-950/90 sm:grid-cols-2">
            <div className="rounded-xl border border-emerald-200/80 bg-white/70 px-3 py-2.5">
              <p className="font-semibold">What happens next</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-relaxed text-emerald-900/85">
                <li>We review your details manually — not an auto-blast</li>
                <li>We may follow up by email or phone if needed</li>
                <li>Any introduction is limited and context-based</li>
              </ul>
            </div>
            <div className="rounded-xl border border-emerald-200/80 bg-white/70 px-3 py-2.5">
              <p className="font-semibold">What does not happen</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-relaxed text-emerald-900/85">
                <li>We do not sell your lead on a marketplace</li>
                <li>We do not mass-email every contractor on this page</li>
                <li>We do not rank or “feature” paid contractors</li>
              </ul>
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <a
              href="#plan-contractors"
              className="btn-primary inline-flex min-h-11 items-center justify-center px-4 text-sm no-underline"
            >
              Review contractors
            </a>
            <Link
              href={editHref}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-300 bg-white px-4 text-sm font-medium text-emerald-950 no-underline"
            >
              Adjust project
            </Link>
            <Link
              href="/verify"
              className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium text-emerald-900 no-underline hover:underline"
            >
              Verify a specific name
            </Link>
          </div>
        </section>
      ) : null}

      {/* 1. Cost — planning only */}
      <section
        id="plan-cost"
        className="scroll-mt-36 rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)] sm:scroll-mt-8 sm:p-8"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Step 1 · Planning range
            </p>
            <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
              Conceptual cost range
            </h2>
          </div>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
            Not a bid
          </span>
        </div>
        <p className="mt-2 text-sm text-[var(--muted)]">{cost.unitNote}</p>

        <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          {[
            { label: "Low", value: cost.low, hint: "Simpler scope" },
            { label: "Mid", value: cost.mid, hint: "Typical" },
            { label: "High", value: cost.high, hint: "Premium / complex" },
          ].map((b) => (
            <div
              key={b.label}
              className={`rounded-2xl border px-2.5 py-3 sm:px-4 sm:py-4 ${
                b.label === "Mid"
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-[var(--border)] bg-[var(--bg)]"
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)] sm:text-xs">
                {b.label}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--navy)] sm:text-2xl">
                {formatUsd(b.value)}
              </p>
              <p className="mt-0.5 hidden text-xs text-[var(--muted)] sm:block">{b.hint}</p>
            </div>
          ))}
        </div>

        <details className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 sm:mt-5">
          <summary className="cursor-pointer text-xs font-semibold text-[var(--navy)]">
            What drives this range
          </summary>
          <ul className="mt-2 space-y-1 pb-1 text-sm text-[var(--muted)]">
            {cost.drivers.map((d) => (
              <li key={d}>· {d}</li>
            ))}
          </ul>
        </details>

        <p className="mt-4 text-xs leading-relaxed text-[var(--muted)]">
          {cost.disclaimer || COST_DISCLAIMER}
        </p>
      </section>

      {/* 2. Contractors — primary evidence block */}
      <section
        id="plan-contractors"
        className="scroll-mt-36 rounded-3xl border-2 border-[var(--navy)]/10 bg-white p-5 shadow-[var(--shadow-md)] sm:scroll-mt-8 sm:p-8"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          Step 2 · Verified licenses
        </p>
        <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
          Matching contractors
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Active Florida DBPR licenses for this project type — evidence only, not a ranking.
        </p>

        {match.locationScope ? (
          <p className="mt-3 inline-flex rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 py-1 text-xs font-medium text-[var(--navy)]">
            {match.locationScope === "local"
              ? `Local focus · ${localCount} near your location`
              : match.locationScope === "regional"
                ? `Mixed local + statewide · ${localCount} local`
                : match.locationScope === "statewide"
                  ? "Statewide · same license classes only"
                  : "No matches"}
          </p>
        ) : null}

        {match.matchNotes.length > 0 ? (
          <details className="mt-3 text-xs text-[var(--muted)]">
            <summary className="cursor-pointer font-semibold text-[var(--navy)]">
              How we matched
            </summary>
            <ul className="mt-2 space-y-1 pl-0.5">
              {match.matchNotes.map((n) => (
                <li key={n}>· {n}</li>
              ))}
            </ul>
          </details>
        ) : null}

        {contractors.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--bg)] px-4 py-7 text-center">
            <p className="font-medium text-[var(--text)]">
              {match.emptyReason || "No strong matches for this location and trade yet."}
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              We do not invent matches to fill the page.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
              <Link
                href={editHref}
                className="btn-primary inline-flex min-h-11 items-center justify-center px-4 text-sm no-underline"
              >
                Change project / location
              </Link>
              <Link
                href="/florida"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium no-underline"
              >
                Browse Florida
              </Link>
              <Link
                href="/verify"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium no-underline"
              >
                Verify a name / license
              </Link>
            </div>
          </div>
        ) : (
          <>
            {thin ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <strong className="font-semibold">Thin local coverage.</strong> Statewide listings
                (if any) are labeled — confirm address and class on each Trust Report.
              </div>
            ) : null}
            <div className="mt-5 space-y-4">
              {contractors.map((c) => (
                <div key={c.id} className="space-y-2">
                  <ResultCard result={c} />
                  {c.matchReasons?.length ? (
                    <details className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs text-[var(--muted)]">
                      <summary className="cursor-pointer font-semibold text-[var(--navy)]">
                        Why this matched
                        {c.locationTier === "state" ? " · statewide fallback" : ""}
                      </summary>
                      <ul className="mt-1.5 space-y-0.5">
                        {c.matchReasons.map((r) => (
                          <li key={r}>· {r}</li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* 3. Next actions */}
      <section
        id="plan-next"
        className="scroll-mt-36 rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)] sm:scroll-mt-8 sm:p-8"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          Step 3 · Next actions
        </p>
        <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
          Decide with evidence
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Open Trust Reports, optionally request a controlled introduction, or save this context on
          this device to return later.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Link
            href={
              contractors[0]
                ? `/contractors/${encodeURIComponent(contractors[0].slug)}`
                : "/florida"
            }
            className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] px-4 py-4 no-underline transition hover:border-[var(--navy)]/25"
          >
            <p className="text-sm font-semibold text-[var(--text)]">Open a Trust Report</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              License, Sunbiz, discipline, workers&apos; comp guidance
            </p>
          </Link>
          <button
            type="button"
            onClick={() => {
              setQuoteError(null);
              setQuoteOpen(true);
            }}
            disabled={quoteDone}
            className="rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-4 text-left transition hover:brightness-105 disabled:opacity-60"
          >
            <p className="text-sm font-semibold text-[var(--text)]">
              {quoteDone ? "Request already sent" : "Request an introduction"}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Manual review — not an automated lead blast
            </p>
          </button>
          <button
            type="button"
            onClick={saveExplicit}
            className="rounded-2xl border border-[var(--border)] px-4 py-4 text-left transition hover:border-[var(--navy)]/25"
          >
            <p className="text-sm font-semibold text-[var(--text)]">
              {savedFlash ? "Saved on this device" : "Save & return later"}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">Browser only · reopen from Plan</p>
          </button>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-[var(--muted)]">
          Introductions are optional. You can always contact contractors yourself after verifying
          licenses on official DBPR records.
        </p>
      </section>

      {/* Mobile sticky CTA */}
      {!quoteDone && contractors.length > 0 ? (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-[var(--border)] bg-white/95 p-3 shadow-[0_-8px_24px_rgba(10,37,64,0.08)] backdrop-blur sm:hidden">
          <button
            type="button"
            onClick={() => {
              setQuoteError(null);
              setQuoteOpen(true);
            }}
            className="btn-primary flex min-h-12 w-full items-center justify-center text-sm"
          >
            Request an introduction
          </button>
          <p className="mt-1 text-center text-[10px] text-[var(--muted)]">
            Not a lead marketplace · manual review only
          </p>
        </div>
      ) : null}

      {/* Quote modal */}
      {quoteOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--navy)]/40 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quote-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setQuoteOpen(false);
          }}
        >
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-lg)] sm:rounded-3xl sm:p-6">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--border)] sm:hidden" />
            <h3 id="quote-title" className="text-lg font-semibold text-[var(--text)]">
              Request a controlled introduction
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
              We attach your project context (
              <strong className="font-medium text-[var(--text)]">{summary.projectLabel}</strong>
              {" · "}
              {summary.locationLabel}). This is <strong className="text-[var(--text)]">not</strong>{" "}
              an automated blast to every contractor on this page.
            </p>

            <ul className="mt-3 space-y-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-xs text-[var(--muted)]">
              <li>· You stay in control — we review requests manually</li>
              <li>· We do not sell your contact info as a marketplace lead</li>
              <li>· You can still open Trust Reports and contact firms yourself</li>
            </ul>

            <div className="mt-4 space-y-3">
              <label className="block text-xs font-semibold text-[var(--muted)]">
                Name
                <input
                  required
                  autoComplete="name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-base text-[var(--text)] sm:text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-[var(--muted)]">
                Email
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-base text-[var(--text)] sm:text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-[var(--muted)]">
                Phone
                <input
                  type="tel"
                  required
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-base text-[var(--text)] sm:text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-[var(--muted)]">
                Notes for us (optional)
                <textarea
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value.slice(0, 1000) }))
                  }
                  rows={3}
                  placeholder="Timing, access, preferred trade specialty…"
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-base text-[var(--text)] sm:text-sm"
                />
              </label>
            </div>
            {quoteError ? (
              <p className="mt-3 text-sm text-rose-700" role="alert">
                {quoteError}
              </p>
            ) : null}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => setQuoteOpen(false)}
                className="min-h-12 rounded-xl border border-[var(--border)] px-4 text-sm font-medium sm:min-h-11"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={quoteBusy}
                onClick={() => void submitQuote()}
                className="btn-primary min-h-12 flex-1 px-4 text-sm disabled:opacity-50 sm:min-h-11"
              >
                {quoteBusy ? "Sending…" : "Submit request"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
