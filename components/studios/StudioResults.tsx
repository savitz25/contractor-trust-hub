"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ResultCard } from "@/components/search/ResultCard";
import { formatUsd } from "@/lib/plan/cost-model";
import { COST_DISCLAIMER, type CostRangeResult } from "@/lib/plan/types";
import type { PlanMatchResult } from "@/lib/plan/types";
import type { SearchResult } from "@/lib/contractors/types";
import type { StudioAnswers, StudioContext } from "@/lib/studios/types";
import { storageKey } from "@/lib/studios/context";

type ApiResponse = {
  studio: { slug: string; name: string; resultFraming: string };
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

  useEffect(() => {
    if (!data) return;
    try {
      localStorage.setItem(
        storageKey(studioSlug) + "-last-result",
        JSON.stringify({
          savedAt: new Date().toISOString(),
          context: data.context,
          cost: { low: data.cost.low, mid: data.cost.mid, high: data.cost.high },
        })
      );
    } catch {
      /* ignore */
    }
  }, [data, studioSlug]);

  const submitQuote = useCallback(async () => {
    if (!data) return;
    setQuoteBusy(true);
    setQuoteError(null);
    try {
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
          contractorSlugs: data.match.contractors.map((c) => c.slug).slice(0, 12),
          studioSlug: data.studio.slug,
          studioName: data.studio.name,
          answerSummary: data.context.answerSummary,
          studioAnswers: answers.values,
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
  }, [data, form, answers]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-[var(--border)] bg-white p-8 text-center">
        <p className="font-semibold text-[var(--navy)]">Building studio results…</p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Adjusting cost drivers from your scope and matching licensed contractors.
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <p className="font-semibold text-amber-950">{error || "Could not load results"}</p>
        <Link href={`/studios/${studioSlug}`} className="mt-3 inline-block text-sm font-medium">
          ← Edit studio answers
        </Link>
      </div>
    );
  }

  const contractors: SearchResult[] = data.match.contractors;
  const { cost, context, studio, match } = data;

  return (
    <div className="space-y-6">
      {/* Sticky summary */}
      <div className="sticky top-[4.5rem] z-30 rounded-2xl border border-[var(--border)] bg-white/95 px-4 py-3 shadow-[var(--shadow-sm)] backdrop-blur-md sm:px-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
              {studio.name}
            </p>
            <p className="mt-0.5 text-sm font-medium text-[var(--text)]">
              {context.scaleLabel}
              {context.location.zip || context.location.city
                ? ` · ${[context.location.city, context.location.zip, context.location.state]
                    .filter(Boolean)
                    .join(" ")}`
                : ""}
            </p>
            <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--muted)]">
              {context.answerSummary.slice(0, 4).map((line) => (
                <li key={line}>· {line}</li>
              ))}
            </ul>
          </div>
          <Link
            href={`/studios/${studioSlug}`}
            className="shrink-0 text-sm font-medium text-[var(--navy)] no-underline hover:underline"
          >
            Edit answers
          </Link>
        </div>
      </div>

      {quoteDone ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          <strong>Request received.</strong> Your studio scope is attached. We facilitate
          introductions — we do not auto-blast contractors.
        </div>
      ) : null}

      {/* Cost */}
      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          1 · Planning range
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-[var(--text)]">Conceptual cost range</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{cost.unitNote}</p>
        <p className="mt-2 text-sm text-[var(--muted)]">{studio.resultFraming}</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Low", value: cost.low },
            { label: "Mid", value: cost.mid },
            { label: "High", value: cost.high },
          ].map((b) => (
            <div
              key={b.label}
              className={`rounded-2xl border px-4 py-4 ${
                b.label === "Mid"
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-[var(--border)] bg-[var(--bg)]"
              }`}
            >
              <p className="text-xs font-semibold uppercase text-[var(--muted)]">{b.label}</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--navy)]">
                {formatUsd(b.value)}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
            Cost drivers for your scope
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-[var(--muted)]">
            {cost.drivers.map((d) => (
              <li key={d}>· {d}</li>
            ))}
          </ul>
        </div>
        <p className="mt-5 rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2.5 text-xs text-amber-950">
          {cost.disclaimer || COST_DISCLAIMER}
        </p>
      </section>

      {/* Contractors */}
      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          2 · Verified contractors
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-[var(--text)]">
          Licensed for this trade
        </h2>
        <ul className="mt-2 space-y-1 text-xs text-[var(--muted)]">
          {match.matchNotes.map((n) => (
            <li key={n}>· {n}</li>
          ))}
        </ul>

        {contractors.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--bg)] p-6 text-center text-sm">
            <p className="font-medium text-[var(--text)]">
              {match.emptyReason || "No strong matches yet."}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Link href="/florida" className="btn-primary px-4 py-2 text-sm no-underline">
                Browse Florida
              </Link>
              <Link
                href="/verify"
                className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm no-underline"
              >
                Verify a name
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

      {/* Actions */}
      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          3 · Next actions
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-[var(--text)]">Hire with confidence</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Link
            href={
              contractors[0]
                ? `/contractors/${encodeURIComponent(contractors[0].slug)}`
                : "/verify"
            }
            className="rounded-2xl border border-[var(--border)] px-4 py-4 no-underline"
          >
            <p className="text-sm font-semibold">View Trust Report</p>
            <p className="mt-1 text-xs text-[var(--muted)]">License, entity, discipline evidence</p>
          </Link>
          <button
            type="button"
            onClick={() => setQuoteOpen(true)}
            className="rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-4 text-left"
          >
            <p className="text-sm font-semibold">Request introduction</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Includes full studio scope</p>
          </button>
          <button
            type="button"
            className="rounded-2xl border border-[var(--border)] px-4 py-4 text-left"
            onClick={() => {
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
                alert("Studio context saved on this device.");
              } catch {
                alert("Could not save.");
              }
            }}
          >
            <p className="text-sm font-semibold">Save studio context</p>
            <p className="mt-1 text-xs text-[var(--muted)]">This browser only</p>
          </button>
        </div>
      </section>

      {quoteOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-lg sm:p-6">
            <h3 className="text-lg font-semibold">Request introduction</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              We attach your {studio.name} answers — controlled intros only.
            </p>
            <ul className="mt-2 max-h-24 overflow-y-auto text-xs text-[var(--muted)]">
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
                    className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-normal"
                  />
                </label>
              ))}
              <label className="block text-xs font-semibold text-[var(--muted)]">
                Notes
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value.slice(0, 1000) }))}
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
                className="btn-primary flex-1 py-2 text-sm disabled:opacity-50"
              >
                {quoteBusy ? "Sending…" : "Submit"}
              </button>
              <button
                type="button"
                onClick={() => setQuoteOpen(false)}
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm"
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
