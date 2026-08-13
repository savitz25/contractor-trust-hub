"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PROJECT_TYPES, isProjectTypeId } from "@/lib/plan/project-types";
import { formatUsd } from "@/lib/plan/cost-model";
import type { ProjectTypeId, ScaleBand } from "@/lib/plan/types";
import { analyzeQuote } from "@/lib/decision/quote-analyze";
import { readFileAsText } from "@/lib/decision/quote-parse";
import {
  DECISION_ENGINE_DISCLAIMER,
  QUOTE_PARSE_LIMITS,
} from "@/lib/decision/disclaimers";
import { DECISION_KEYS, saveJson } from "@/lib/decision/session";
import { generateQuestionGroups } from "@/lib/decision/questions";
import type { QuoteAnalysis } from "@/lib/decision/types";
import { trackFunnel } from "@/lib/funnel/analytics";
import { quoteAnalyzerActions } from "@/lib/funnel/cta-matrix";
import { saveJourneyContext } from "@/lib/funnel/journey-context";
import { NextBestAction } from "@/components/funnel/NextBestAction";
import { DecisionJourney } from "./DecisionJourney";
import { QuestionsList } from "./QuestionsList";
import { StatusChip } from "./StatusChip";

export function QuoteAnalyzerClient() {
  const sp = useSearchParams();
  const typeParam = sp.get("type") || "";
  const initialType: ProjectTypeId = isProjectTypeId(typeParam)
    ? typeParam
    : "kitchen_remodel";

  const [projectType, setProjectType] = useState<ProjectTypeId>(initialType);
  const [scale, setScale] = useState<ScaleBand>(
    (["small", "medium", "large"].includes(sp.get("scale") || "")
      ? sp.get("scale")
      : "medium") as ScaleBand
  );
  const [zip, setZip] = useState(sp.get("zip") || "");
  const [city, setCity] = useState(sp.get("city") || "");
  const [contractorName, setContractorName] = useState(sp.get("name") || "");
  const [contractorSlug] = useState(sp.get("contractor") || "");
  const [rawText, setRawText] = useState("");
  const [totalPrice, setTotalPrice] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<QuoteAnalysis | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const onFile = async (file: File | null) => {
    if (!file) return;
    setUploadNote(null);
    const text = await readFileAsText(file);
    if (!text) {
      setUploadNote(
        file.type.startsWith("image/")
          ? "Images need OCR we do not run yet — paste text or fill manual fields."
          : "Could not extract text from this file — paste text or use manual fields."
      );
      return;
    }
    setRawText((t) => (t ? `${t}\n\n${text}` : text));
    setUploadNote(`Loaded text from ${file.name} (heuristic extract — review carefully).`);
  };

  const run = () => {
    const a = analyzeQuote({
      rawText,
      projectType,
      scale,
      zip: zip || undefined,
      city: city || undefined,
      state: "FL",
      contractorName: contractorName || undefined,
      contractorSlug: contractorSlug || undefined,
      totalPrice: totalPrice ? Number(totalPrice.replace(/[,$]/g, "")) : undefined,
      depositAmount: depositAmount
        ? Number(depositAmount.replace(/[,$]/g, ""))
        : undefined,
    });
    setAnalysis(a);
    saveJson(DECISION_KEYS.quoteAnalysis, a);
    // Also stash for compare
    const existing = (() => {
      try {
        return JSON.parse(localStorage.getItem(DECISION_KEYS.compareBids) || "null");
      } catch {
        return null;
      }
    })() as { analyses?: QuoteAnalysis[] } | null;
    const list = existing?.analyses || [];
    const next = [...list.filter((x) => x.id !== a.id), a].slice(-4);
    saveJson(DECISION_KEYS.compareBids, { analyses: next });
    trackFunnel("quote_analyzed", {
      projectType,
      hasContractor: Boolean(contractorSlug || contractorName),
    });
    saveJourneyContext({
      projectType,
      scale,
      zip: zip || undefined,
      city: city || undefined,
      contractorSlug: contractorSlug || undefined,
      contractorName: contractorName || undefined,
      hasQuoteAnalysis: true,
      entryPath: "tools",
    });
    setFlash("Analysis saved — next: compare another bid");
    setTimeout(() => setFlash(null), 2500);
  };

  const questionGroups = useMemo(
    () =>
      analysis
        ? generateQuestionGroups({
            projectType: analysis.projectType,
            scale: analysis.scale,
            analysis,
          })
        : [],
    [analysis]
  );

  return (
    <div className="space-y-6">
      <DecisionJourney current="/tools/quote-analyzer" />

      <div className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          Quote Analyzer
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--text)] sm:text-3xl">
          Review one estimate for gaps and flags
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
          Structured findings and questions — never a “good” or “bad” verdict.{" "}
          {QUOTE_PARSE_LIMITS}
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
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
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Contractor name (optional)
            </span>
            <input
              value={contractorName}
              onChange={(e) => setContractorName(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                ZIP
              </span>
              <input
                value={zip}
                onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                City
              </span>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm"
              />
            </label>
          </div>

          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Paste quote text
            </span>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={8}
              placeholder="Paste the estimate text here…"
              className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 font-mono text-xs sm:text-sm"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Or upload text / PDF (best-effort extract)
            </span>
            <input
              type="file"
              accept=".txt,.pdf,text/plain,application/pdf,image/*"
              className="mt-1.5 block w-full text-sm"
              onChange={(e) => void onFile(e.target.files?.[0] || null)}
            />
            {uploadNote ? (
              <p className="mt-1 text-xs text-amber-900">{uploadNote}</p>
            ) : null}
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Total price (manual override)
            </span>
            <input
              value={totalPrice}
              onChange={(e) => setTotalPrice(e.target.value)}
              inputMode="decimal"
              placeholder="48500"
              className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Deposit amount (optional)
            </span>
            <input
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              inputMode="decimal"
              placeholder="10000"
              className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={run}
            className="rounded-xl bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Analyze quote
          </button>
          <Link
            href="/tools/scope-builder"
            className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--navy)] no-underline"
          >
            Build scope first
          </Link>
        </div>
        {flash ? <p className="mt-2 text-xs font-medium text-emerald-800">{flash}</p> : null}
      </div>

      {analysis ? (
        <>
          {/* A. Price context */}
          <section className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              A · Price context
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">
              Conceptual planning range only
            </h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-[var(--border)] px-3 py-3">
                <p className="text-[10px] font-semibold uppercase text-[var(--muted)]">Quoted</p>
                <p className="text-xl font-semibold text-[var(--navy)]">
                  {analysis.totalPrice != null ? formatUsd(analysis.totalPrice) : "—"}
                </p>
              </div>
              {(["planningLow", "planningMid", "planningHigh"] as const).map((k, i) => (
                <div key={k} className="rounded-xl border border-[var(--border)] px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase text-[var(--muted)]">
                    {["Plan low", "Plan mid", "Plan high"][i]}
                  </p>
                  <p className="text-lg font-semibold text-[var(--text)]">
                    {analysis.priceContext[k] != null
                      ? formatUsd(analysis.priceContext[k]!)
                      : "—"}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
              {analysis.priceContext.note}
            </p>
            <p className="mt-2 text-xs text-[var(--muted)]">
              Parse confidence: <strong>{analysis.parseConfidence}</strong>
              {analysis.parseNotes[0] ? ` — ${analysis.parseNotes[0]}` : ""}
            </p>
          </section>

          {/* B. Scope completeness */}
          <section className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              B · Scope completeness
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">
              What looks stated vs not clearly stated
            </h2>
            <ul className="mt-4 space-y-2">
              {analysis.scopeItems.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-1 rounded-xl border border-[var(--border)]/80 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--text)]">{item.label}</p>
                    {item.evidence ? (
                      <p className="text-xs text-[var(--muted)]">{item.evidence}</p>
                    ) : null}
                  </div>
                  <StatusChip status={item.status} />
                </li>
              ))}
            </ul>
          </section>

          {/* C. Red flags */}
          <section className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              C · Caution patterns
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">
              Worth confirming — not a verdict
            </h2>
            {analysis.redFlags.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--muted)]">
                No strong automated caution patterns from this text. Still complete the pre-hire
                checklist.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {analysis.redFlags.map((f) => (
                  <li
                    key={f.id}
                    className={`rounded-2xl border px-4 py-3 ${
                      f.severity === "high"
                        ? "border-rose-200 bg-rose-50/80"
                        : f.severity === "caution"
                          ? "border-amber-200 bg-amber-50/80"
                          : "border-[var(--border)] bg-[var(--bg)]/50"
                    }`}
                  >
                    <p className="text-sm font-semibold text-[var(--text)]">{f.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{f.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <QuestionsList groups={questionGroups} title="D · Questions to ask" />

          {/* E. Next actions — conversion hierarchy */}
          <NextBestAction
            spec={quoteAnalyzerActions({
              projectType: analysis.projectType,
              scale: analysis.scale,
              contractorSlug: analysis.contractorSlug,
              contractorName: analysis.contractorName,
            })}
          />
          <p className="text-[11px] leading-relaxed text-[var(--muted)]">
            {DECISION_ENGINE_DISCLAIMER}
          </p>
        </>
      ) : null}
    </div>
  );
}
