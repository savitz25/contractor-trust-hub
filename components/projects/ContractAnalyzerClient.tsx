"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PROJECT_TYPES } from "@/lib/plan/project-types";
import { readFileAsText } from "@/lib/decision/quote-parse";
import { analyzeContract } from "@/lib/projects/contract-analyze";
import {
  CONTRACT_ANALYZER_DISCLAIMER,
  PROTECTION_DISCLAIMER,
} from "@/lib/projects/disclaimers";
import {
  createProject,
  listProjects,
  saveAnalysis,
  updateProject,
} from "@/lib/projects/store";
import type { ContractAnalysis, FindingStatus } from "@/lib/projects/types";
import { trackFunnel } from "@/lib/funnel/analytics";
import { saveJourneyContext } from "@/lib/funnel/journey-context";

const STATUS_STYLE: Record<FindingStatus, string> = {
  present: "border-emerald-200 bg-emerald-50 text-emerald-900",
  missing: "border-rose-200 bg-rose-50 text-rose-900",
  unclear: "border-amber-200 bg-amber-50 text-amber-950",
};

export function ContractAnalyzerClient() {
  const sp = useSearchParams();
  const [rawText, setRawText] = useState("");
  const [contractorName, setContractorName] = useState(sp.get("name") || "");
  const [contractorSlug] = useState(sp.get("contractor") || "");
  const [projectType, setProjectType] = useState(sp.get("type") || "general_contracting");
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ContractAnalysis | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const onFile = async (file: File | null) => {
    if (!file) return;
    const text = await readFileAsText(file);
    if (!text) {
      setUploadNote(
        "Could not extract text — paste contract text or review the PDF manually against findings."
      );
      return;
    }
    setRawText((t) => (t ? `${t}\n\n${text}` : text));
    setUploadNote(`Loaded text from ${file.name} (heuristic extract — review carefully).`);
  };

  const run = () => {
    const a = analyzeContract({
      rawText,
      contractorName: contractorName || undefined,
      contractorSlug: contractorSlug || undefined,
      projectType,
    });
    setAnalysis(a);
    saveAnalysis(a);
    trackFunnel("contract_analyzed", {
      hasContractor: Boolean(contractorSlug || contractorName),
    });
    saveJourneyContext({
      contractorSlug: contractorSlug || undefined,
      contractorName: contractorName || undefined,
      projectType,
      entryPath: "tools",
    });
    setFlash("Analysis saved — next: create protected project");
    setTimeout(() => setFlash(null), 2500);
  };

  const saveToProject = () => {
    if (!analysis) return;
    const existing = listProjects()[0];
    if (existing) {
      updateProject(existing.id, {
        contractAnalysisId: analysis.id,
        contractorName: analysis.contractorName || existing.contractorName,
        contractorSlug: analysis.contractorSlug || existing.contractorSlug,
        status:
          existing.status === "planning" ? "under_contract" : existing.status,
      });
      trackFunnel("project_created", { mode: "update", projectId: existing.id });
      saveJourneyContext({ projectId: existing.id });
      setFlash(`Saved to project “${existing.title}”`);
    } else {
      const p = createProject({
        title: `${contractorName || "Contract"} review`,
        projectType,
        contractorName: contractorName || undefined,
        contractorSlug: contractorSlug || undefined,
        status: "under_contract",
      });
      updateProject(p.id, { contractAnalysisId: analysis.id });
      trackFunnel("project_created", { mode: "create", projectId: p.id });
      saveJourneyContext({ projectId: p.id });
      setFlash("Created project and saved analysis");
    }
    setTimeout(() => setFlash(null), 2500);
  };

  const byCat = useMemo(() => {
    if (!analysis) return null;
    return {
      core: analysis.findings.filter((f) => f.category === "core"),
      protection: analysis.findings.filter((f) => f.category === "protection"),
      florida: analysis.findings.filter((f) => f.category === "florida"),
    };
  }, [analysis]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          Contract Analyzer
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--text)] sm:text-3xl">
          Review a proposed contract before signing
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
          Structured findings for present / missing / unclear items — never “safe to sign.”{" "}
          {CONTRACT_ANALYZER_DISCLAIMER}
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
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
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Project type
            </span>
            <select
              value={projectType}
              onChange={(e) => setProjectType(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm"
            >
              {PROJECT_TYPES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Paste contract text
            </span>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={10}
              placeholder="Paste contract language here…"
              className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 font-mono text-xs sm:text-sm"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Or upload text / PDF (best-effort extract)
            </span>
            <input
              type="file"
              accept=".txt,.pdf,text/plain,application/pdf"
              className="mt-1.5 block w-full text-sm"
              onChange={(e) => void onFile(e.target.files?.[0] || null)}
            />
            {uploadNote ? (
              <p className="mt-1 text-xs text-amber-900">{uploadNote}</p>
            ) : null}
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={run}
            className="rounded-xl bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Analyze contract
          </button>
          <Link
            href="/tools/scope-builder"
            className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--navy)] no-underline"
          >
            Compare to Scope Builder
          </Link>
        </div>
        {flash ? <p className="mt-2 text-xs font-medium text-emerald-800">{flash}</p> : null}
      </div>

      {analysis && byCat ? (
        <>
          <section className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-[var(--text)]">Summary</h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(
                [
                  ["Present", analysis.counts.present, "present"],
                  ["Missing", analysis.counts.missing, "missing"],
                  ["Unclear", analysis.counts.unclear, "unclear"],
                ] as const
              ).map(([label, n, st]) => (
                <div
                  key={label}
                  className={`rounded-xl border px-3 py-3 text-center ${STATUS_STYLE[st]}`}
                >
                  <p className="text-[10px] font-semibold uppercase">{label}</p>
                  <p className="text-2xl font-semibold">{n}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-[var(--muted)]">
              Parse confidence: <strong>{analysis.parseConfidence}</strong>
              {analysis.parseNotes[0] ? ` — ${analysis.parseNotes[0]}` : ""}
            </p>
          </section>

          {(
            [
              ["Core terms", byCat.core],
              ["Protection items", byCat.protection],
              ["Florida attention points", byCat.florida],
            ] as const
          ).map(([title, items]) => (
            <section
              key={title}
              className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6"
            >
              <h2 className="text-lg font-semibold text-[var(--text)]">{title}</h2>
              <ul className="mt-3 space-y-2">
                {items.map((f) => (
                  <li
                    key={f.id}
                    className="flex flex-col gap-1 rounded-xl border border-[var(--border)]/80 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-[var(--text)]">{f.label}</p>
                      <p className="text-xs text-[var(--muted)]">{f.detail}</p>
                      {f.evidence ? (
                        <p className="mt-1 font-mono text-[11px] text-[var(--muted)]">
                          “…{f.evidence}…”
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_STYLE[f.status]}`}
                    >
                      {f.status === "present"
                        ? "Present"
                        : f.status === "missing"
                          ? "Not clearly stated"
                          : "Unclear"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-[var(--text)]">
              Questions to clarify before signing
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-[var(--text)]">
              {analysis.questions.map((q) => (
                <li key={q}>· {q}</li>
              ))}
            </ul>
          </section>

          <section className="rounded-3xl border border-[var(--accent)]/40 bg-[var(--accent-soft)] p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
              Next best action
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">
              Next: protect payments and documents
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Create or update a project workspace after you understand what the contract leaves
              unclear.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={saveToProject}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--navy)] px-5 py-2.5 text-sm font-semibold text-white"
              >
                Create / save protected project
              </button>
              <Link
                href="/tools/pre-hire-checklist"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--navy)] no-underline"
              >
                Checklist
              </Link>
              {analysis.contractorSlug ? (
                <Link
                  href={`/contractors/${encodeURIComponent(analysis.contractorSlug)}`}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--navy)] no-underline"
                >
                  Trust Report
                </Link>
              ) : analysis.contractorName ? (
                <Link
                  href={`/verify?q=${encodeURIComponent(analysis.contractorName)}`}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--navy)] no-underline"
                >
                  Verify contractor
                </Link>
              ) : null}
            </div>
            <p className="mt-3 text-xs">
              <Link href="/account" className="font-semibold text-[var(--navy)]">
                Save / continue later →
              </Link>
            </p>
            <p className="mt-3 text-[11px] leading-relaxed text-[var(--muted)]">
              {PROTECTION_DISCLAIMER}
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}
