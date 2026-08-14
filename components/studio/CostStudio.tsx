"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  computeStudioEstimate,
  defaultStudioSelections,
  formatUsd,
  getStudioFactors,
  type StudioSelections,
} from "@/lib/plan/cost-studio";
import { encodePlanQuery } from "@/lib/plan/plan-url";
import { PROJECT_TYPES } from "@/lib/plan/project-types";
import type { ProjectTypeId, ScaleBand } from "@/lib/plan/types";

const SCALES: ScaleBand[] = ["small", "medium", "large"];

export function CostStudio() {
  const [projectType, setProjectType] = useState<ProjectTypeId>("kitchen_remodel");
  const [scale, setScale] = useState<ScaleBand>("medium");
  const [zip, setZip] = useState("");
  const [city, setCity] = useState("");
  const [selections, setSelections] = useState<StudioSelections>(() =>
    defaultStudioSelections("kitchen_remodel")
  );

  const project = PROJECT_TYPES.find((p) => p.id === projectType)!;
  const factors = useMemo(() => getStudioFactors(projectType), [projectType]);

  const estimate = useMemo(
    () =>
      computeStudioEstimate({
        projectType,
        scale,
        selections,
      }),
    [projectType, scale, selections]
  );

  const onProjectChange = (id: ProjectTypeId) => {
    setProjectType(id);
    setSelections(defaultStudioSelections(id));
  };

  const setFactor = (factorId: string, optionId: string) => {
    setSelections((s) => ({ ...s, [factorId]: optionId }));
  };

  const planResultsHref = useMemo(() => {
    const qs = encodePlanQuery({
      projectType,
      scale,
      state: "FL",
      zip: zip.replace(/\D/g, "").slice(0, 5) || undefined,
      city: city.trim() || undefined,
    });
    return `/plan/results?${qs}`;
  }, [projectType, scale, zip, city]);

  const persistProjectContext = () => {
    void import("@/lib/project-context/store").then(({ saveProjectContext }) => {
      saveProjectContext({
        state: "fl",
        entryPath: "studio",
        projectType,
        scale,
        zip: zip.replace(/\D/g, "").slice(0, 5) || undefined,
        city: city.trim() || undefined,
      });
    });
  };

  const midShift =
    estimate.baseMid > 0
      ? Math.round(((estimate.mid - estimate.baseMid) / estimate.baseMid) * 100)
      : 0;

  return (
    <div className="grid gap-6 pb-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-8 lg:items-start lg:pb-0">
      {/* Left: setup */}
      <div className="space-y-5">
        <section className="rounded-3xl border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-md)] sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            1 · Project setup
          </p>
          <h2 className="mt-1.5 text-lg font-semibold text-[var(--text)] sm:text-xl">
            What are you planning?
          </h2>

          <label className="mt-4 block">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Project type
            </span>
            <select
              value={projectType}
              onChange={(e) => onProjectChange(e.target.value as ProjectTypeId)}
              className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-3 text-base text-[var(--text)] sm:text-sm"
            >
              {PROJECT_TYPES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-[var(--muted)]">{project.description}</p>
            {projectType === "roofing" ? (
              <p className="mt-2 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent-soft)] px-3 py-2 text-xs leading-relaxed text-[var(--text)]">
                For a deeper roofing walkthrough (size, system, stories, pitch), use the{" "}
                <Link
                  href="/studio/roofing"
                  className="font-semibold text-[var(--navy)] underline-offset-2 hover:underline"
                >
                  Roofing Cost Calculator
                </Link>
                .
              </p>
            ) : null}
          </label>

          <fieldset className="mt-5">
            <legend className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Scale
            </legend>
            <div className="mt-2 grid gap-2">
              {SCALES.map((s) => {
                const on = scale === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setScale(s)}
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      on
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                        : "border-[var(--border)] hover:border-[var(--navy)]/25"
                    }`}
                  >
                    <p className="text-sm font-semibold text-[var(--text)]">
                      {project.scaleLabels[s]}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">{project.scaleHints[s]}</p>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                ZIP (optional)
              </span>
              <input
                inputMode="numeric"
                value={zip}
                onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                placeholder="33139"
                className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-3 text-base sm:text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                City (optional)
              </span>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value.slice(0, 80))}
                placeholder="Miami"
                className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-3 text-base sm:text-sm"
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]">
            Location does not change statewide planning bands yet — it improves contractor matching
            when you continue to verification.
          </p>
        </section>

        <section className="rounded-3xl border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-md)] sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            2 · Scope factors
          </p>
          <h2 className="mt-1.5 text-lg font-semibold text-[var(--text)] sm:text-xl">
            What usually moves the band?
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Answer a few high-impact questions. Adjustments stay approximate — planning only.
          </p>

          <div className="mt-5 space-y-5">
            {factors.map((f) => (
              <fieldset key={f.id}>
                <legend className="text-sm font-semibold text-[var(--text)]">{f.label}</legend>
                {f.help ? <p className="mt-0.5 text-xs text-[var(--muted)]">{f.help}</p> : null}
                <div className="mt-2 grid gap-2">
                  {f.options.map((o) => {
                    const on = selections[f.id] === o.id;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setFactor(f.id, o.id)}
                        className={`rounded-xl border px-3 py-2.5 text-left transition ${
                          on
                            ? "border-[var(--navy)] bg-[var(--navy-soft)]"
                            : "border-[var(--border)] hover:border-[var(--navy)]/25"
                        }`}
                      >
                        <p className="text-sm font-medium text-[var(--text)]">{o.label}</p>
                        {o.description ? (
                          <p className="mt-0.5 text-xs text-[var(--muted)]">{o.description}</p>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
        </section>
      </div>

      {/* Right: live studio output (sticky on desktop) */}
      <div className="space-y-5 lg:sticky lg:top-28">
        <section className="overflow-hidden rounded-3xl border-2 border-[var(--navy)]/10 bg-white shadow-[var(--shadow-lg)]">
          <div className="border-b border-[var(--border)] bg-[var(--navy)] px-4 py-3 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                Cost Studio · live output
              </p>
              <span className="rounded-full bg-[var(--accent)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--navy)]">
                Planning only — not a bid
              </span>
            </div>
            <h2 className="mt-2 text-lg font-semibold text-white sm:text-xl">
              {estimate.projectLabel}
            </h2>
            <p className="text-sm text-white/75">
              {estimate.scaleLabel} · {estimate.unitNote}
            </p>
          </div>

          <div className="p-4 sm:p-6">
            <p className="text-sm text-[var(--muted)]">Planning span</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-[var(--navy)] sm:text-4xl">
              {estimate.spanLabel}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Mid planning point{" "}
              <strong className="tabular-nums text-[var(--text)]">{formatUsd(estimate.mid)}</strong>
              {midShift !== 0 ? (
                <span className="text-[var(--muted)]">
                  {" "}
                  ({midShift > 0 ? "+" : ""}
                  {midShift}% vs base mid for this scale)
                </span>
              ) : (
                <span> (aligned with base mid for this scale)</span>
              )}
            </p>

            {/* Visual band bar */}
            <div className="mt-5">
              <div className="relative h-3 overflow-hidden rounded-full bg-gradient-to-r from-emerald-100 via-[var(--accent-soft)] to-amber-100 ring-1 ring-[var(--border)]">
                <div
                  className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-[var(--navy)] shadow"
                  style={{
                    left: `${Math.min(
                      95,
                      Math.max(
                        5,
                        ((estimate.mid - estimate.low) /
                          Math.max(estimate.high - estimate.low, 1)) *
                          100
                      )
                    )}%`,
                  }}
                  title="Mid planning point"
                />
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                <span>Low</span>
                <span>Mid</span>
                <span>High</span>
              </div>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {(
                [
                  { key: "low", label: "Toward low", value: estimate.low, hint: estimate.bandHints.low },
                  { key: "mid", label: "Mid", value: estimate.mid, hint: estimate.bandHints.mid },
                  {
                    key: "high",
                    label: "Toward high",
                    value: estimate.high,
                    hint: estimate.bandHints.high,
                  },
                ] as const
              ).map((b) => (
                <div
                  key={b.key}
                  className={`rounded-2xl border px-3 py-3 ${
                    b.key === "mid"
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                      : "border-[var(--border)] bg-[var(--bg)]"
                  }`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                    {b.label}
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--navy)]">
                    {formatUsd(b.value)}
                  </p>
                  <p className="mt-1 text-[11px] leading-snug text-[var(--muted)]">{b.hint}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-3">
              <p className="text-xs font-semibold text-[var(--navy)]">Your scope choices</p>
              <ul className="mt-2 space-y-1 text-xs text-[var(--muted)]">
                {estimate.appliedFactors.map((a) => (
                  <li key={a.factorLabel}>
                    <span className="text-[var(--text)]">{a.factorLabel}:</span> {a.optionLabel}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4 rounded-xl border border-[var(--border)] bg-white px-3 py-3">
              <p className="text-xs font-semibold text-[var(--navy)]">What usually moves cost</p>
              <ul className="mt-2 grid gap-1 text-sm text-[var(--muted)] sm:grid-cols-1">
                {estimate.drivers.map((d) => (
                  <li key={d}>· {d}</li>
                ))}
              </ul>
            </div>

            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-950">
              <strong className="font-semibold">Planning only — not a bid or quote.</strong>{" "}
              {estimate.disclaimer} These bands are not contractor-specific prices.
            </p>
          </div>
        </section>

        {/* Verification bridge */}
        <section className="rounded-3xl border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-md)] sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            Next · verification
          </p>
          <h2 className="mt-1.5 text-lg font-semibold text-[var(--text)]">
            Move from planning to licensed contractors
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            Cost Studio ends at planning. When you are ready, match <strong className="text-[var(--text)]">active Florida licenses</strong> for this project type
            {zip || city ? " near your location" : ""} — evidence only, no rankings.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Link
              href={planResultsHref}
              onClick={persistProjectContext}
              className="btn-primary inline-flex min-h-12 items-center justify-center px-5 text-sm no-underline"
            >
              Find verified contractors →
            </Link>
            <Link
              href={`/plan?type=${projectType}&scale=${scale}${zip ? `&zip=${zip}` : ""}${city ? `&city=${encodeURIComponent(city)}` : ""}`}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-5 text-sm font-medium text-[var(--navy)] no-underline hover:bg-[var(--bg)]"
            >
              Open full Plan flow
            </Link>
            <Link
              href="/verify"
              className="inline-flex min-h-12 items-center justify-center rounded-xl px-4 text-sm font-medium text-[var(--muted)] no-underline hover:text-[var(--navy)]"
            >
              Verify a name you already have
            </Link>
          </div>
        </section>

        {/* Education */}
        <section className="rounded-3xl border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-sm)] sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            Learn · {estimate.projectLabel}
          </p>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--muted)]">
            {estimate.education.map((e) => (
              <li key={e} className="flex gap-2">
                <span className="text-[var(--accent)]" aria-hidden>
                  ·
                </span>
                <span>{e}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
            Florida factors
          </p>
          <ul className="mt-2 space-y-2 text-sm leading-relaxed text-[var(--muted)]">
            {estimate.floridaNotes.map((n) => (
              <li key={n} className="flex gap-2">
                <span className="text-[var(--navy)]" aria-hidden>
                  ·
                </span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-[var(--muted)]">
            Base data:{" "}
            <code className="rounded bg-[var(--bg)] px-1 text-[11px]">fl-cost-ranges.json</code>
            {" · "}
            Factors:{" "}
            <code className="rounded bg-[var(--bg)] px-1 text-[11px]">cost-studio-factors.json</code>
          </p>
        </section>
      </div>

      {/* Mobile sticky: planning summary + verify path */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(10,37,64,0.08)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-[var(--muted)]">
              Planning only · {estimate.projectLabel}
            </p>
            <p className="truncate text-sm font-semibold tabular-nums text-[var(--navy)]">
              {estimate.spanLabel}
            </p>
          </div>
          <Link
            href={planResultsHref}
            onClick={persistProjectContext}
            className="btn-primary shrink-0 px-4 py-2.5 text-sm no-underline"
          >
            Verify path →
          </Link>
        </div>
      </div>
    </div>
  );
}
