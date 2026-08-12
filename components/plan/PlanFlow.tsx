"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BUDGET_BANDS, PROJECT_TYPES } from "@/lib/plan/project-types";
import { encodePlanQuery } from "@/lib/plan/plan-url";
import type {
  BudgetBand,
  ProjectTypeId,
  ScaleBand,
} from "@/lib/plan/types";

const STEPS = ["Project", "Location", "Scale", "Results"] as const;

export function PlanFlow() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [projectType, setProjectType] = useState<ProjectTypeId | null>(null);
  const [details, setDetails] = useState("");
  const [zip, setZip] = useState("");
  const [city, setCity] = useState("");
  const [scale, setScale] = useState<ScaleBand>("medium");
  const [budgetBand, setBudgetBand] = useState<BudgetBand | null>("not_sure");
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => PROJECT_TYPES.find((p) => p.id === projectType) ?? null,
    [projectType]
  );

  const canNext = () => {
    if (step === 0) return Boolean(projectType);
    if (step === 1) return zip.replace(/\D/g, "").length === 5 || city.trim().length >= 2;
    if (step === 2) return Boolean(scale);
    return true;
  };

  const goNext = () => {
    setError(null);
    if (!canNext()) {
      if (step === 0) setError("Select a project type to continue.");
      if (step === 1) setError("Enter a Florida ZIP code or city.");
      return;
    }
    if (step < 2) {
      setStep(step + 1);
      return;
    }
    // Step 2 → results
    if (!projectType) return;
    const qs = encodePlanQuery({
      projectType,
      details: details.trim() || undefined,
      state: "FL",
      zip: zip.replace(/\D/g, "").slice(0, 5) || undefined,
      city: city.trim() || undefined,
      scale,
      budgetBand,
    });
    router.push(`/plan/results?${qs}`);
  };

  const goBack = () => {
    setError(null);
    if (step > 0) setStep(step - 1);
  };

  return (
    <div className="mx-auto max-w-2xl">
      {/* Progress */}
      <nav aria-label="Plan steps" className="mb-8">
        <ol className="flex flex-wrap items-center gap-2">
          {STEPS.map((label, i) => {
            const active = i === step;
            const done = i < step;
            return (
              <li key={label} className="flex items-center gap-2">
                {i > 0 ? (
                  <span className="hidden text-[var(--border-strong)] sm:inline" aria-hidden>
                    /
                  </span>
                ) : null}
                <button
                  type="button"
                  disabled={i > step}
                  onClick={() => i < step && setStep(i)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "bg-[var(--navy)] text-white"
                      : done
                        ? "bg-[var(--accent-soft)] text-[var(--navy)] hover:brightness-95"
                        : "bg-[var(--panel)] text-[var(--muted)] opacity-60"
                  } disabled:cursor-default`}
                >
                  <span className="mr-1 opacity-70">{i + 1}.</span>
                  {label}
                </button>
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-xs text-[var(--muted)]">
          About 60–90 seconds · conceptual costs + verified license matches
        </p>
      </nav>

      <div className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)] sm:p-8">
        {step === 0 ? (
          <section>
            <h2 className="text-xl font-semibold text-[var(--text)] sm:text-2xl">
              What kind of project are you considering?
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Pick the closest match. You can refine details below.
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {PROJECT_TYPES.map((p) => {
                const on = projectType === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProjectType(p.id)}
                    className={`rounded-2xl border px-4 py-3.5 text-left transition ${
                      on
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[var(--shadow-sm)]"
                        : "border-[var(--border)] bg-[var(--panel)] hover:border-[var(--navy)]/25"
                    }`}
                  >
                    <p className="text-sm font-semibold text-[var(--text)]">{p.label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                      {p.description}
                    </p>
                  </button>
                );
              })}
            </div>
            <label className="mt-5 block">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                Tell us more (optional)
              </span>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value.slice(0, 500))}
                rows={3}
                placeholder="e.g. 1990s kitchen, keep layout, want quartz and new cabinets…"
                className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--navy)]/40"
              />
            </label>
          </section>
        ) : null}

        {step === 1 ? (
          <section>
            <h2 className="text-xl font-semibold text-[var(--text)] sm:text-2xl">
              Where is the project?
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Florida first. Enter a ZIP (preferred) or city so we can match licensed contractors
              nearby.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                  ZIP code
                </span>
                <input
                  inputMode="numeric"
                  autoComplete="postal-code"
                  value={zip}
                  onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                  placeholder="33139"
                  className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--navy)]/40"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                  City (optional if ZIP)
                </span>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value.slice(0, 80))}
                  placeholder="Miami"
                  className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--navy)]/40"
                />
              </label>
            </div>
            <p className="mt-3 text-xs text-[var(--muted)]">
              State: <strong className="text-[var(--text)]">Florida</strong> · more states later
            </p>
          </section>
        ) : null}

        {step === 2 && selected ? (
          <section>
            <h2 className="text-xl font-semibold text-[var(--text)] sm:text-2xl">
              Rough scale of the work
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Keep it simple — this only shapes planning ranges, not a formal bid.
            </p>
            <div className="mt-5 grid gap-2">
              {(["small", "medium", "large"] as ScaleBand[]).map((s) => {
                const on = scale === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setScale(s)}
                    className={`rounded-2xl border px-4 py-3.5 text-left transition ${
                      on
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                        : "border-[var(--border)] hover:border-[var(--navy)]/25"
                    }`}
                  >
                    <p className="text-sm font-semibold text-[var(--text)]">
                      {selected.scaleLabels[s]}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {selected.scaleHints[s]}
                    </p>
                  </button>
                );
              })}
            </div>
            <fieldset className="mt-6">
              <legend className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                Budget comfort (optional)
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {BUDGET_BANDS.map((b) => {
                  const on = budgetBand === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setBudgetBand(b.id)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        on
                          ? "border-[var(--navy)] bg-[var(--navy)] text-white"
                          : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--navy)]/30"
                      }`}
                    >
                      {b.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </section>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {error}
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-5">
          <div>
            {step > 0 ? (
              <button
                type="button"
                onClick={goBack}
                className="rounded-xl px-3 py-2 text-sm font-medium text-[var(--muted)] hover:text-[var(--navy)]"
              >
                ← Back
              </button>
            ) : (
              <Link
                href="/verify"
                className="text-sm font-medium text-[var(--muted)] no-underline hover:text-[var(--navy)]"
              >
                Or verify a contractor you already know
              </Link>
            )}
          </div>
          <button
            type="button"
            onClick={goNext}
            className="btn-primary inline-flex min-h-11 items-center px-5 py-2.5 text-sm no-underline"
          >
            {step < 2 ? "Continue →" : "See cost ranges & contractors →"}
          </button>
        </div>
      </div>
    </div>
  );
}
