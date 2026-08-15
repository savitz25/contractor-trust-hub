"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PROJECT_TYPES, getProjectType, isProjectTypeId } from "@/lib/plan/project-types";
import type { ProjectTypeId, ScaleBand } from "@/lib/plan/types";
import {
  buildProjectScope,
  parseCsvLines,
  scopeToPlainText,
} from "@/lib/decision/scope-builder";
import { SCOPE_BUILDER_NOTE, DECISION_ENGINE_DISCLAIMER } from "@/lib/decision/disclaimers";
import { DECISION_KEYS, saveJson } from "@/lib/decision/session";
import { copyText, escapeHtml, printHtmlDocument } from "@/lib/decision/print";
import { trackFunnel } from "@/lib/funnel/analytics";
import { scopeBuilderActions } from "@/lib/funnel/cta-matrix";
import { saveJourneyContext } from "@/lib/funnel/journey-context";
import { NextBestAction } from "@/components/funnel/NextBestAction";
import { DecisionJourney } from "./DecisionJourney";
import { QuestionsList } from "./QuestionsList";
import { generateQuestionGroups } from "@/lib/decision/questions";

const SCALES: { id: ScaleBand; label: string }[] = [
  { id: "small", label: "Smaller / lighter" },
  { id: "medium", label: "Standard / mid" },
  { id: "large", label: "Large / complex" },
];

export function ScopeBuilderClient() {
  const sp = useSearchParams();
  const typeParam = sp.get("type") || "";
  const initialType: ProjectTypeId = isProjectTypeId(typeParam)
    ? typeParam
    : "kitchen_remodel";
  const initialScale = (["small", "medium", "large"].includes(sp.get("scale") || "")
    ? sp.get("scale")
    : "medium") as ScaleBand;

  const [projectType, setProjectType] = useState<ProjectTypeId>(initialType);
  const [scale, setScale] = useState<ScaleBand>(initialScale);
  const [zip, setZip] = useState(sp.get("zip") || "");
  const [city, setCity] = useState(sp.get("city") || "");
  const [includedText, setIncludedText] = useState("");
  const [excludedText, setExcludedText] = useState("");
  const [unknownText, setUnknownText] = useState("");
  const [details, setDetails] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [built, setBuilt] = useState(false);

  const studioSlug = sp.get("studio") || undefined;

  const scope = useMemo(
    () =>
      buildProjectScope({
        projectType,
        scale,
        zip: zip.replace(/\D/g, "").slice(0, 5) || undefined,
        city: city.trim() || undefined,
        state: "FL",
        details: details.trim() || undefined,
        studioSlug,
        includedLabels: parseCsvLines(includedText),
        excludedLabels: parseCsvLines(excludedText),
        unknownLabels: parseCsvLines(unknownText),
        sourceNotes: studioSlug
          ? [`Started from ${studioSlug} studio context`]
          : sp.get("type")
            ? ["Started from plan / deep-link context"]
            : [],
      }),
    [
      projectType,
      scale,
      zip,
      city,
      details,
      includedText,
      excludedText,
      unknownText,
      studioSlug,
      sp,
    ]
  );

  const questions = useMemo(
    () =>
      generateQuestionGroups({
        projectType,
        scale,
        studioSlug,
        scope,
      }),
    [projectType, scale, studioSlug, scope]
  );

  const save = () => {
    saveJson(DECISION_KEYS.scope, scope);
    setBuilt(true);
    setFlash("Scope saved on this device — next: analyze a quote");
    trackFunnel("scope_created", { projectType, scale });
    saveJourneyContext({
      projectType,
      scale,
      zip: zip.replace(/\D/g, "").slice(0, 5) || undefined,
      city: city.trim() || undefined,
      hasScope: true,
      entryPath: studioSlug ? "studio" : "plan",
    });
    setTimeout(() => setFlash(null), 2500);
  };

  const copy = async () => {
    await copyText(scopeToPlainText(scope));
    setFlash("Copied summary");
    setTimeout(() => setFlash(null), 2000);
  };

  const printPdf = () => {
    const body = `
      <h1>${escapeHtml(scope.title)}</h1>
      <p class="meta">Generated ${escapeHtml(new Date(scope.generatedAt).toLocaleString())}<br/>
      ${escapeHtml(scope.projectLabel)} · ${escapeHtml(scope.scaleLabel)} · ${escapeHtml(scope.locationLabel)}</p>
      <h2>Included</h2>
      <ul>${scope.included.map((i) => `<li>${escapeHtml(i.label)}</li>`).join("") || "<li>(none listed yet)</li>"}</ul>
      <h2>Excluded / not in scope</h2>
      <ul>${scope.excluded.map((i) => `<li>${escapeHtml(i.label)}</li>`).join("") || "<li>(none listed)</li>"}</ul>
      <h2>Unknown / not decided</h2>
      <ul>${scope.unknowns.map((i) => `<li>${escapeHtml(i.label)}${i.note ? ` — ${escapeHtml(i.note)}` : ""}</li>`).join("")}</ul>
      <h2>Assumptions</h2>
      <ul>${scope.assumptions.map((a) => `<li>${escapeHtml(a)}</li>`).join("")}</ul>
      <h2>Notes for bidders</h2>
      <p>${escapeHtml(scope.bidderNotes)}</p>
    `;
    printHtmlDocument(scope.title, body);
  };

  const def = getProjectType(projectType);

  return (
    <div className="space-y-6">
      <DecisionJourney current="/tools/scope-builder" />

      <div className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          Scope Builder
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--text)] sm:text-3xl">
          Contractor-ready project scope
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
          {SCOPE_BUILDER_NOTE}
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
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

          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Scale
            </span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {SCALES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setScale(s.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                    scale === s.id ? "control-selected" : "control-off"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">{def.scaleLabels[scale]}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                ZIP
              </span>
              <input
                value={zip}
                onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                inputMode="numeric"
                className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm"
                placeholder="33139"
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
                placeholder="Miami"
              />
            </label>
          </div>

          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Work included (comma or line separated)
            </span>
            <textarea
              value={includedText}
              onChange={(e) => setIncludedText(e.target.value)}
              rows={3}
              placeholder="e.g. Full cabinet replacement, quartz counters, same layout"
              className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Exclusions
            </span>
            <textarea
              value={excludedText}
              onChange={(e) => setExcludedText(e.target.value)}
              rows={3}
              placeholder="e.g. Appliances owner-furnished"
              className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Unknowns / not decided
            </span>
            <textarea
              value={unknownText}
              onChange={(e) => setUnknownText(e.target.value)}
              rows={3}
              placeholder="e.g. Island size, tile selection"
              className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Notes for context (optional)
            </span>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value.slice(0, 500))}
              rows={2}
              className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={save}
            className="min-h-11 rounded-xl bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Generate & save scope
          </button>
          <Link
            href={`/tools/quote-analyzer?type=${projectType}&scale=${scale}${zip ? `&zip=${zip}` : ""}${city ? `&city=${encodeURIComponent(city)}` : ""}&from=scope`}
            onClick={save}
            className="inline-flex min-h-11 items-center rounded-xl border border-[var(--accent)]/50 bg-[var(--accent-soft)] px-4 py-2.5 text-sm font-semibold text-[var(--navy)] no-underline"
          >
            Use this scope in Quote Analyzer
          </Link>
          <button
            type="button"
            onClick={copy}
            className="min-h-11 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--navy)]"
          >
            Copy summary
          </button>
          <button
            type="button"
            onClick={printPdf}
            className="min-h-11 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--navy)]"
          >
            Print / PDF
          </button>
        </div>
        {flash ? <p className="mt-2 text-xs font-medium text-emerald-800">{flash}</p> : null}
      </div>

      {built ? (
        <NextBestAction
          spec={scopeBuilderActions({
            projectType,
            scale,
            zip: zip.replace(/\D/g, "").slice(0, 5),
            city: city.trim(),
          })}
        />
      ) : null}

      {/* Live summary */}
      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          Scope summary
        </p>
        <h2 className="mt-1 text-xl font-semibold text-[var(--text)]">{scope.title}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {scope.scaleLabel} · {scope.locationLabel}
          {built ? " · Saved on this device" : ""}
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800">
              Included
            </h3>
            <ul className="mt-2 space-y-1 text-sm text-[var(--text)]">
              {scope.included.length ? (
                scope.included.map((i) => <li key={i.id}>· {i.label}</li>)
              ) : (
                <li className="text-[var(--muted)]">Add included work above</li>
              )}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
              Excluded
            </h3>
            <ul className="mt-2 space-y-1 text-sm text-[var(--text)]">
              {scope.excluded.length ? (
                scope.excluded.map((i) => <li key={i.id}>· {i.label}</li>)
              ) : (
                <li className="text-[var(--muted)]">None listed</li>
              )}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-800">
              Unknown / confirm
            </h3>
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm text-[var(--text)]">
              {scope.unknowns.slice(0, 10).map((i) => (
                <li key={i.id}>· {i.label}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--bg)]/60 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
            Notes for bidders
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--text)]">{scope.bidderNotes}</p>
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-[var(--muted)]">
          {DECISION_ENGINE_DISCLAIMER}
        </p>
      </section>

      <QuestionsList groups={questions} title="Questions this scope suggests" />
    </div>
  );
}
