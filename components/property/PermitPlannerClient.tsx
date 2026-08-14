"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PROJECT_TYPES } from "@/lib/plan/project-types";
import { buildPermitPlan, PLANNER_FACTORS } from "@/lib/property/planner";
import { loadPropertyContext } from "@/lib/property/session";
import { useEffect } from "react";

const LIKELIHOOD: Record<string, string> = {
  commonly_required: "Commonly required — confirm locally",
  often_required: "Often required — confirm locally",
  sometimes: "Sometimes required",
  confirm_locally: "Confirm with AHJ",
};

export function PermitPlannerClient() {
  const sp = useSearchParams();
  const [projectType, setProjectType] = useState(
    sp.get("type") || "kitchen_remodel"
  );
  const [zip, setZip] = useState(sp.get("zip") || "");
  const [city, setCity] = useState(sp.get("city") || "");
  const [county, setCounty] = useState(sp.get("county") || "");
  const [factors, setFactors] = useState<string[]>([]);
  useEffect(() => {
    const ctx = loadPropertyContext();
    if (ctx) {
      if (!zip && ctx.zip) setZip(ctx.zip);
      if (!city && ctx.city) setCity(ctx.city);
      if (!county && ctx.county) setCounty(ctx.county);
    }
  }, [zip, city, county]);

  const result = useMemo(
    () =>
      buildPermitPlan({
        projectType,
        zip: zip || undefined,
        city: city || undefined,
        county: county || undefined,
        factors,
      }),
    [projectType, zip, city, county, factors]
  );

  const toggle = (id: string) => {
    setFactors((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          Permit &amp; Inspection Planner
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--text)] sm:text-3xl">
          What approvals to investigate before work starts
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
          Educational briefing by project type and location — not an official determination. Local
          AHJ rules control.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
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
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              ZIP
            </span>
            <input
              value={zip}
              onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
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
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              County (optional)
            </span>
            <input
              value={county}
              onChange={(e) => setCounty(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm"
              placeholder="Miami-Dade"
            />
          </label>
        </div>

        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
          Scope factors
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {PLANNER_FACTORS.map((f) => {
            const on = factors.includes(f.id);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => toggle(f.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  on ? "control-selected" : "control-off"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <p className="mt-6 text-xs text-[var(--muted)]">
          Briefing updates as you change project type, location, and factors.
        </p>
      </div>

      <>
          <section className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-[var(--text)]">
              Likely permit categories to investigate
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {result.projectLabel} · {result.locationLabel}
            </p>
            <ul className="mt-4 space-y-3">
              {result.categories.map((c) => (
                <li
                  key={c.id}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--bg)]/40 px-4 py-3"
                >
                  <p className="text-sm font-semibold text-[var(--text)]">{c.label}</p>
                  <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--accent)]">
                    {LIKELIHOOD[c.likelihood]}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">{c.detail}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-[var(--text)]">
              Questions to ask the contractor
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-[var(--text)]">
              {result.contractorQuestions.map((q) => (
                <li key={q}>· {q}</li>
              ))}
            </ul>
          </section>

          <section className="rounded-3xl border border-amber-200/80 bg-amber-50/60 p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-amber-950">Homeowner cautions</h2>
            <ul className="mt-3 space-y-2 text-sm text-amber-950/90">
              {result.homeownerCautions.map((q) => (
                <li key={q}>· {q}</li>
              ))}
            </ul>
          </section>

          <section className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-[var(--text)]">Official next step</h2>
            <p className="mt-2 text-sm font-medium text-[var(--text)]">
              {result.officialNextStep.label}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">{result.officialNextStep.note}</p>
            {result.officialNextStep.href ? (
              <a
                href={result.officialNextStep.href}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex text-sm font-semibold text-[var(--navy)]"
              >
                Open jurisdiction resources →
              </a>
            ) : (
              <p className="mt-3 text-xs text-[var(--muted)]">
                No portal linked for this county yet — search your city/county building department.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/property"
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--navy)] no-underline"
              >
                Check my address
              </Link>
              <Link
                href={`/tools/scope-builder?type=${projectType}${zip ? `&zip=${zip}` : ""}`}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--navy)] no-underline"
              >
                Build project scope
              </Link>
              <Link
                href="/tools/pre-hire-checklist"
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--navy)] no-underline"
              >
                Pre-hire checklist
              </Link>
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-[var(--muted)]">
              {result.disclaimer}
            </p>
          </section>
      </>
    </div>
  );
}
