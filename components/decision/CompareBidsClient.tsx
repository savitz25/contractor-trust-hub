"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PROJECT_TYPES, isProjectTypeId } from "@/lib/plan/project-types";
import { formatUsd } from "@/lib/plan/cost-model";
import type { ProjectTypeId, ScaleBand } from "@/lib/plan/types";
import {
  analysisToBidSlot,
  buildBidComparison,
} from "@/lib/decision/compare-bids";
import { analyzeQuote } from "@/lib/decision/quote-analyze";
import { COMPARE_BIDS_NOTE, DECISION_ENGINE_DISCLAIMER } from "@/lib/decision/disclaimers";
import { DECISION_KEYS, loadJson, saveJson } from "@/lib/decision/session";
import { generateQuestionGroups } from "@/lib/decision/questions";
import type { BidSlot, QuoteAnalysis } from "@/lib/decision/types";
import { copyText, escapeHtml, printHtmlDocument } from "@/lib/decision/print";
import { trackFunnel } from "@/lib/funnel/analytics";
import { saveJourneyContext } from "@/lib/funnel/journey-context";
import { DecisionJourney } from "./DecisionJourney";
import { QuestionsList } from "./QuestionsList";
import { StatusChip } from "./StatusChip";

type DraftBid = {
  id: string;
  name: string;
  total: string;
  text: string;
};

function emptyDraft(n: number): DraftBid {
  return {
    id: `draft_${n}_${Math.random().toString(36).slice(2, 6)}`,
    name: "",
    total: "",
    text: "",
  };
}

export function CompareBidsClient() {
  const sp = useSearchParams();
  const typeParam = sp.get("type") || "";
  const [projectType, setProjectType] = useState<ProjectTypeId>(
    isProjectTypeId(typeParam) ? typeParam : "kitchen_remodel"
  );
  const [scale, setScale] = useState<ScaleBand>(
    (["small", "medium", "large"].includes(sp.get("scale") || "")
      ? sp.get("scale")
      : "medium") as ScaleBand
  );
  const [drafts, setDrafts] = useState<DraftBid[]>([emptyDraft(1), emptyDraft(2)]);
  const [comparison, setComparison] = useState<ReturnType<typeof buildBidComparison> | null>(
    null
  );
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    const saved = loadJson<{ analyses?: QuoteAnalysis[] }>(DECISION_KEYS.compareBids);
    if (saved?.analyses?.length) {
      const fromSaved = saved.analyses.slice(0, 4).map((a, i) => ({
        id: a.id || `saved_${i}`,
        name: a.contractorName || `Bid ${i + 1}`,
        total: a.totalPrice != null ? String(a.totalPrice) : "",
        text: a.rawText || "",
      }));
      if (fromSaved.length >= 2) setDrafts(fromSaved);
      else if (fromSaved.length === 1) setDrafts([fromSaved[0], emptyDraft(2)]);
      if (saved.analyses[0]?.projectType) setProjectType(saved.analyses[0].projectType);
    }
  }, []);

  const addBid = () => {
    if (drafts.length >= 4) return;
    setDrafts((d) => [...d, emptyDraft(d.length + 1)]);
  };

  const removeBid = (id: string) => {
    setDrafts((d) => (d.length <= 2 ? d : d.filter((x) => x.id !== id)));
  };

  const run = () => {
    const analyses: QuoteAnalysis[] = drafts.map((d, i) =>
      analyzeQuote({
        rawText: d.text,
        projectType,
        scale,
        state: "FL",
        contractorName: d.name || `Bid ${i + 1}`,
        totalPrice: d.total ? Number(d.total.replace(/[,$]/g, "")) : undefined,
      })
    );
    const bids: BidSlot[] = analyses.map((a, i) => analysisToBidSlot(a, i));
    const cmp = buildBidComparison({
      projectType,
      scale,
      locationLabel: "Florida",
      bids,
    });
    setComparison(cmp);
    saveJson(DECISION_KEYS.compareBids, { analyses, comparison: cmp });
    trackFunnel("bids_compared", { bidCount: bids.length, projectType });
    saveJourneyContext({
      projectType,
      scale,
      hasCompare: true,
      hasQuoteAnalysis: true,
      entryPath: "tools",
    });
    setFlash("Comparison saved — next: verify shortlist contractors");
    setTimeout(() => setFlash(null), 2500);
  };

  const questionGroups = useMemo(
    () =>
      comparison
        ? generateQuestionGroups({
            projectType: comparison.projectType,
            scale: comparison.scale,
            comparison,
          })
        : [],
    [comparison]
  );

  const printCmp = () => {
    if (!comparison) return;
    const head = comparison.bids
      .map((b) => `<th>${escapeHtml(b.label)}</th>`)
      .join("");
    const rows = comparison.matrixRows
      .map((r) => {
        const cells = r.cells
          .map(
            (c) =>
              `<td><strong>${escapeHtml(c.status)}</strong>${c.note ? `<br/><span style="color:#64748b">${escapeHtml(c.note)}</span>` : ""}</td>`
          )
          .join("");
        return `<tr><th>${escapeHtml(r.label)}</th>${cells}</tr>`;
      })
      .join("");
    printHtmlDocument(
      "Bid comparison — Contractor Trust Hub",
      `<h1>Bid comparison</h1>
       <p class="meta">${escapeHtml(comparison.locationLabel)} · ${escapeHtml(comparison.projectType)}</p>
       <table><thead><tr><th>Item</th>${head}</tr></thead><tbody>${rows}</tbody></table>
       <h2>Biggest differences</h2>
       <ul>${comparison.differences.map((d) => `<li><strong>${escapeHtml(d.title)}</strong> — ${escapeHtml(d.detail)}</li>`).join("") || "<li>None flagged</li>"}</ul>`
    );
  };

  return (
    <div className="space-y-6">
      <DecisionJourney current="/tools/compare-bids" />

      <div className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          Compare My Bids
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--text)] sm:text-3xl">
          Side-by-side estimate comparison
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
          {COMPARE_BIDS_NOTE}
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Project type
            </span>
            <select
              value={projectType}
              onChange={(e) => setProjectType(e.target.value as ProjectTypeId)}
              className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm"
            >
              {PROJECT_TYPES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Scale
            </span>
            <select
              value={scale}
              onChange={(e) => setScale(e.target.value as ScaleBand)}
              className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm"
            >
              <option value="small">Smaller</option>
              <option value="medium">Standard / mid</option>
              <option value="large">Large / complex</option>
            </select>
          </label>
        </div>

        <div className="mt-6 space-y-4">
          {drafts.map((d, i) => (
            <div
              key={d.id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--bg)]/40 p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--text)]">Bid {i + 1}</p>
                {drafts.length > 2 ? (
                  <button
                    type="button"
                    className="text-xs font-medium text-[var(--muted)]"
                    onClick={() => removeBid(d.id)}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs text-[var(--muted)]">Contractor / label</span>
                  <input
                    value={d.name}
                    onChange={(e) =>
                      setDrafts((all) =>
                        all.map((x) => (x.id === d.id ? { ...x, name: e.target.value } : x))
                      )
                    }
                    className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                    placeholder={`Contractor ${i + 1}`}
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-[var(--muted)]">Total price</span>
                  <input
                    value={d.total}
                    onChange={(e) =>
                      setDrafts((all) =>
                        all.map((x) => (x.id === d.id ? { ...x, total: e.target.value } : x))
                      )
                    }
                    className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                    placeholder="52000"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-xs text-[var(--muted)]">Estimate text (paste)</span>
                  <textarea
                    value={d.text}
                    onChange={(e) =>
                      setDrafts((all) =>
                        all.map((x) => (x.id === d.id ? { ...x, text: e.target.value } : x))
                      )
                    }
                    rows={4}
                    className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 font-mono text-xs"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={addBid}
            disabled={drafts.length >= 4}
            className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--navy)] disabled:opacity-40"
          >
            Add bid (max 4)
          </button>
          <button
            type="button"
            onClick={run}
            className="rounded-xl bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Compare bids
          </button>
        </div>
        {flash ? <p className="mt-2 text-xs font-medium text-emerald-800">{flash}</p> : null}
      </div>

      {comparison ? (
        <>
          {/* Desktop table + mobile stacked */}
          <section className="rounded-3xl border border-[var(--border)] bg-white p-4 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-[var(--text)]">Comparison matrix</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={printCmp}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold"
                >
                  Print / PDF
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void copyText(
                      comparison.differences.map((d) => `${d.title}: ${d.detail}`).join("\n")
                    )
                  }
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold"
                >
                  Copy differences
                </button>
              </div>
            </div>

            {/* Mobile: cards per bid */}
            <div className="mt-4 space-y-4 lg:hidden">
              {comparison.bids.map((b, bi) => (
                <div key={b.id} className="rounded-2xl border border-[var(--border)] p-4">
                  <p className="font-semibold text-[var(--navy)]">{b.label}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Total:{" "}
                    {b.totalPrice != null ? formatUsd(b.totalPrice) : "Not stated"}
                  </p>
                  <p className="text-xs text-[var(--muted)]">Deposit: {b.depositTerms}</p>
                  <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                    {comparison.matrixRows.slice(2, 10).map((row) => (
                      <li
                        key={row.id}
                        className="flex items-start justify-between gap-2 text-xs"
                      >
                        <span className="text-[var(--text)]">{row.label}</span>
                        <StatusChip status={row.cells[bi].status} />
                      </li>
                    ))}
                  </ul>
                  {b.contractorSlug ? (
                    <Link
                      href={`/contractors/${b.contractorSlug}`}
                      className="mt-3 inline-block text-xs font-semibold text-[var(--navy)]"
                    >
                      Trust Report
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="mt-4 hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="px-2 py-2 text-xs font-semibold text-[var(--muted)]">Item</th>
                    {comparison.bids.map((b) => (
                      <th key={b.id} className="px-2 py-2 text-xs font-semibold text-[var(--navy)]">
                        {b.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparison.matrixRows.map((row) => (
                    <tr key={row.id} className="border-b border-[var(--border)]/70">
                      <td className="px-2 py-2.5 text-xs font-medium text-[var(--text)]">
                        {row.label}
                      </td>
                      {row.cells.map((cell, i) => (
                        <td key={i} className="px-2 py-2.5 align-top">
                          <StatusChip status={cell.status} />
                          {cell.note ? (
                            <p className="mt-1 text-[11px] leading-snug text-[var(--muted)]">
                              {cell.note}
                            </p>
                          ) : null}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-[var(--text)]">Biggest differences</h2>
            {comparison.differences.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--muted)]">
                No major automated mismatches — still verify each line item yourself.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {comparison.differences.map((d) => (
                  <li
                    key={d.id}
                    className="rounded-2xl border border-amber-200/80 bg-amber-50/70 px-4 py-3"
                  >
                    <p className="text-sm font-semibold text-amber-950">{d.title}</p>
                    <p className="mt-1 text-sm text-amber-950/85">{d.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <QuestionsList groups={questionGroups} title="Shared questions for all bidders" />

          <section className="rounded-3xl border border-[var(--accent)]/40 bg-[var(--accent-soft)] p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
              Next best action
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">
              Next: verify license evidence before you shortlist
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Open Trust Reports for your leading bids, then finish the pre-hire checklist.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Link
                href={
                  comparison.bids.find((b) => b.contractorSlug)?.contractorSlug
                    ? `/contractors/${comparison.bids.find((b) => b.contractorSlug)!.contractorSlug}`
                    : `/verify?q=${encodeURIComponent(comparison.bids[0]?.label || "")}`
                }
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--navy)] px-5 py-2.5 text-sm font-semibold text-white no-underline"
              >
                Verify shortlist contractor(s)
              </Link>
              <Link
                href="/tools/pre-hire-checklist"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--navy)] no-underline"
              >
                Pre-hire checklist
              </Link>
              <Link
                href="/tools/contract-analyzer"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--navy)] no-underline"
              >
                Review a contract
              </Link>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {comparison.bids.map((b) =>
                b.contractorSlug ? (
                  <Link
                    key={b.id}
                    href={`/contractors/${b.contractorSlug}`}
                    className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold no-underline"
                  >
                    {b.label} Trust Report
                  </Link>
                ) : (
                  <Link
                    key={b.id}
                    href={`/verify?q=${encodeURIComponent(b.label)}`}
                    className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold no-underline"
                  >
                    Verify {b.label}
                  </Link>
                )
              )}
            </div>
            <p className="mt-4 text-[11px] text-[var(--muted)]">{DECISION_ENGINE_DISCLAIMER}</p>
          </section>
        </>
      ) : null}
    </div>
  );
}
