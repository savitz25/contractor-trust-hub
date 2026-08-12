"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ResultCard } from "@/components/search/ResultCard";
import { formatUsd } from "@/lib/plan/cost-model";
import type { CostRangeResult, PlanInput, PlanMatchResult } from "@/lib/plan/types";
import { COST_DISCLAIMER } from "@/lib/plan/types";
import type { SearchResult } from "@/lib/contractors/types";

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
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });

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

  // Persist lightweight context for “save”
  useEffect(() => {
    if (!data) return;
    try {
      localStorage.setItem(
        "cth-plan-context",
        JSON.stringify({
          savedAt: new Date().toISOString(),
          plan: data.plan,
          summary: data.summary,
          cost: {
            low: data.cost.low,
            mid: data.cost.mid,
            high: data.cost.high,
          },
        })
      );
    } catch {
      /* ignore quota */
    }
  }, [data]);

  const submitQuote = useCallback(async () => {
    if (!data) return;
    setQuoteError(null);
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
          Loading conceptual cost ranges and matching licensed contractors.
        </p>
        <div className="mx-auto mt-5 h-1.5 w-48 overflow-hidden rounded-full bg-[var(--border)]">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-[var(--accent)]" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 sm:p-8">
        <p className="font-semibold text-amber-950">We couldn&apos;t load matches</p>
        <p className="mt-2 text-sm text-amber-900/90">{error || "Unknown error"}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/plan" className="btn-primary inline-flex px-4 py-2 text-sm no-underline">
            Edit project
          </Link>
          <Link
            href="/verify"
            className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium no-underline"
          >
            Verify a contractor
          </Link>
        </div>
      </div>
    );
  }

  const { cost, match, summary } = data;
  const contractors: SearchResult[] = match.contractors;

  return (
    <div className="space-y-8">
      {/* Context bar */}
      <div className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 shadow-[var(--shadow-sm)] sm:px-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
              Project context
            </p>
            <p className="mt-1 text-sm font-medium text-[var(--text)]">
              {summary.projectLabel} · {summary.scaleLabel}
            </p>
            <p className="text-xs text-[var(--muted)]">{summary.locationLabel}</p>
          </div>
          <Link
            href="/plan"
            className="text-sm font-medium text-[var(--navy)] no-underline hover:underline"
          >
            ← Edit answers
          </Link>
        </div>
      </div>

      {quoteDone ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          <strong>Request received.</strong> We&apos;ll review your project context and facilitate
          introductions to verified contractors — we do not auto-blast your contact info.
        </div>
      ) : null}

      {/* 1. Cost range */}
      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          1 · Typical cost range
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text)]">
          Conceptual planning range
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{cost.unitNote}</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Low", value: cost.low, hint: "Simpler scope / finishes" },
            { label: "Mid", value: cost.mid, hint: "Typical project" },
            { label: "High", value: cost.high, hint: "Complex or premium" },
          ].map((b) => (
            <div
              key={b.label}
              className={`rounded-2xl border px-4 py-4 ${
                b.label === "Mid"
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-[var(--border)] bg-[var(--bg)]"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                {b.label}
              </p>
              <p className="mt-1 text-2xl font-semibold text-[var(--navy)]">
                {formatUsd(b.value)}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">{b.hint}</p>
            </div>
          ))}
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
            What drives the range
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-[var(--muted)]">
            {cost.drivers.map((d) => (
              <li key={d}>· {d}</li>
            ))}
          </ul>
        </div>

        <p className="mt-5 rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2.5 text-xs leading-relaxed text-amber-950">
          {cost.disclaimer || COST_DISCLAIMER}
        </p>
      </section>

      {/* 2. Contractors */}
      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          2 · Verified contractors
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text)]">
          Licensed & relevant for this work
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          From official Florida DBPR records — not ratings or paid placement.
        </p>

        {match.matchNotes.length > 0 ? (
          <ul className="mt-3 space-y-1 text-xs text-[var(--muted)]">
            {match.matchNotes.map((n) => (
              <li key={n}>· {n}</li>
            ))}
          </ul>
        ) : null}

        {contractors.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--bg)] px-4 py-6 text-center">
            <p className="font-medium text-[var(--text)]">
              {match.emptyReason || "No strong matches for this location and trade yet."}
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Browse by county and trade, or verify a contractor you already have in mind.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link
                href="/florida"
                className="btn-primary inline-flex px-4 py-2 text-sm no-underline"
              >
                Browse Florida
              </Link>
              <Link
                href="/verify"
                className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium no-underline"
              >
                Verify a name / license
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            {contractors.map((c) => (
              <ResultCard key={c.id} result={c} />
            ))}
          </div>
        )}
      </section>

      {/* 3. Next actions */}
      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          3 · Next actions
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text)]">
          Hire with confidence
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Open full Trust Reports, request a controlled introduction, or save this context on this
          device.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Link
            href={
              contractors[0]
                ? `/contractors/${encodeURIComponent(contractors[0].slug)}`
                : "/florida"
            }
            className="rounded-2xl border border-[var(--border)] px-4 py-4 no-underline transition hover:border-[var(--navy)]/25"
          >
            <p className="text-sm font-semibold text-[var(--text)]">View contractor profile</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Full license, entity, and discipline signals
            </p>
          </Link>
          <button
            type="button"
            onClick={() => setQuoteOpen(true)}
            className="rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-4 text-left transition hover:brightness-105"
          >
            <p className="text-sm font-semibold text-[var(--text)]">Request quotes</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Controlled introductions — not auto-spam
            </p>
          </button>
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.setItem(
                  "cth-plan-context",
                  JSON.stringify({
                    savedAt: new Date().toISOString(),
                    plan: data.plan,
                    summary: data.summary,
                  })
                );
                alert("Project context saved on this device.");
              } catch {
                alert("Could not save locally (storage blocked).");
              }
            }}
            className="rounded-2xl border border-[var(--border)] px-4 py-4 text-left transition hover:border-[var(--navy)]/25"
          >
            <p className="text-sm font-semibold text-[var(--text)]">Save project context</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Stored in this browser only</p>
          </button>
        </div>
      </section>

      {/* Quote modal */}
      {quoteOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quote-title"
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-lg)] sm:p-6">
            <h3 id="quote-title" className="text-lg font-semibold text-[var(--text)]">
              Request verified introductions
            </h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              We attach your project context ({summary.projectLabel}, {summary.locationLabel}). We
              do not mass-email contractors automatically.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-semibold text-[var(--muted)]">
                Name
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-[var(--muted)]">
                Email
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-[var(--muted)]">
                Phone
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-[var(--muted)]">
                Notes (optional)
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value.slice(0, 1000) }))}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
                />
              </label>
            </div>
            {quoteError ? (
              <p className="mt-3 text-sm text-rose-700">{quoteError}</p>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={quoteBusy}
                onClick={() => void submitQuote()}
                className="btn-primary min-h-11 flex-1 px-4 py-2 text-sm disabled:opacity-50"
              >
                {quoteBusy ? "Sending…" : "Submit request"}
              </button>
              <button
                type="button"
                onClick={() => setQuoteOpen(false)}
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
