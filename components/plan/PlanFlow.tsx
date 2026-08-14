"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BUDGET_BANDS, PROJECT_TYPES, isProjectTypeId } from "@/lib/plan/project-types";
import { encodePlanQuery, parsePlanQuery } from "@/lib/plan/plan-url";
import { getStudioByProjectType } from "@/lib/studios/registry";
import type { ProjectTypeId, ScaleBand } from "@/lib/plan/types";

const STEPS = ["Project", "Location", "Scale"] as const;
const PLAN_STORAGE_KEY = "cth-plan-context";

export function PlanFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const [projectType, setProjectType] = useState<ProjectTypeId | null>(null);
  const [details, setDetails] = useState("");
  const [zip, setZip] = useState("");
  const [city, setCity] = useState("");
  const [scale, setScale] = useState<ScaleBand>("medium");
  const [budgetBand, setBudgetBand] = useState<string | null>("not_sure");
  const [error, setError] = useState<string | null>(null);
  const [resumePath, setResumePath] = useState<string | null>(null);

  // Prefill from URL (edit answers) or saved context
  useEffect(() => {
    const fromUrl = parsePlanQuery(Object.fromEntries(searchParams.entries()));
    if (fromUrl) {
      setProjectType(fromUrl.projectType);
      setDetails(fromUrl.details || "");
      setZip(fromUrl.zip || "");
      setCity(fromUrl.city || "");
      setScale(fromUrl.scale);
      setBudgetBand(fromUrl.budgetBand ?? "not_sure");
      return;
    }
    try {
      const raw = localStorage.getItem(PLAN_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        plan?: {
          projectType?: string;
          details?: string;
          zip?: string;
          city?: string;
          scale?: ScaleBand;
          budgetBand?: string | null;
        };
        resultsPath?: string | null;
      };
      if (saved.resultsPath) setResumePath(saved.resultsPath);
      const p = saved.plan;
      if (p?.projectType && isProjectTypeId(p.projectType)) {
        setProjectType(p.projectType);
        setDetails(p.details || "");
        setZip(p.zip || "");
        setCity(p.city || "");
        if (p.scale) setScale(p.scale);
        if (p.budgetBand !== undefined) setBudgetBand(p.budgetBand);
      }
    } catch {
      /* ignore */
    }
  }, [searchParams]);

  const linkedStudio = projectType ? getStudioByProjectType(projectType) : null;

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
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
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
    if (step > 0) {
      setStep(step - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="mx-auto max-w-2xl pb-28 sm:pb-0">
      {resumePath ? (
        <div className="mb-5 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 shadow-[var(--shadow-sm)]">
          <p className="text-sm text-[var(--text)]">
            <strong className="font-semibold">Saved plan on this device.</strong> Continue where you
            left off or start fresh below.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href={resumePath}
              className="btn-primary inline-flex min-h-10 items-center px-3 text-sm no-underline"
            >
              Open last results
            </Link>
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.removeItem(PLAN_STORAGE_KEY);
                } catch {
                  /* ignore */
                }
                setResumePath(null);
              }}
              className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--muted)]"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {/* Progress ΓÇö horizontal scroll on tiny screens */}
      <nav aria-label="Plan steps" className="mb-6 sm:mb-8">
        <ol className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:gap-2">
          {STEPS.map((label, i) => {
            const active = i === step;
            const done = i < step;
            return (
              <li key={label} className="flex shrink-0 items-center gap-1.5">
                {i > 0 ? (
                  <span className="text-[var(--border-strong)]" aria-hidden>
                    /
                  </span>
                ) : null}
                <button
                  type="button"
                  disabled={i > step}
                  onClick={() => i < step && setStep(i)}
                  className={`rounded-full px-3 py-2 text-xs font-semibold transition sm:py-1.5 ${
                    active
                      ? "control-selected"
                      : done
                        ? "bg-[var(--accent-soft)] text-[var(--navy)] hover:brightness-95"
                        : "bg-white text-[var(--muted)] opacity-70 ring-1 ring-[var(--border)]"
                  } disabled:cursor-default`}
                >
                  <span className="mr-1 opacity-70">{i + 1}</span>
                  {label}
                </button>
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-xs text-[var(--muted)]">
          About 60ΓÇô90 seconds ┬╖ planning ranges + verified license matches
        </p>
      </nav>

      <div className="rounded-3xl border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-md)] sm:p-8">
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
                    className={`min-h-[4.5rem] rounded-2xl border px-4 py-3.5 text-left transition ${
                      on
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[var(--shadow-sm)]"
                        : "border-[var(--border)] bg-white hover:border-[var(--navy)]/25"
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
                className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-base text-[var(--text)] outline-none focus:border-[var(--navy)]/40 sm:text-sm"
              />
            </label>
            {linkedStudio ? (
              <div className="mt-5 rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent-soft)] px-4 py-3">
                <p className="text-sm font-semibold text-[var(--text)]">
                  Want a deeper scope for {linkedStudio.shortName}?
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {linkedStudio.slug === "roofing"
                    ? "Open the Roofing Studio for full replacement scope — material, tear-off, access, and licensed CCC/RR matches."
                    : linkedStudio.slug === "kitchen"
                      ? "Open the Kitchen Studio for remodel depth — cabinets, layout, plumbing/electrical, and licensed GC matches."
                      : linkedStudio.slug === "bathroom"
                        ? "Open the Bathroom Studio for remodel depth — wet-area work, waterproofing, plumbing, and licensed CFC/CRC/CBC matches."
                        : `The ${linkedStudio.name} asks a few more questions so cost drivers and matches fit your project better.`}
                </p>
                <Link
                  href={`/studios/${linkedStudio.slug}`}
                  className="mt-2 inline-block text-sm font-semibold text-[var(--navy)] no-underline hover:underline"
                >
                  {linkedStudio.slug === "roofing"
                    ? "Open Roofing Studio for replacement scope →"
                    : linkedStudio.slug === "kitchen"
                      ? "Open Kitchen Studio for remodel scope →"
                      : linkedStudio.slug === "bathroom"
                        ? "Open Bathroom Studio for remodel scope →"
                        : "Open detailed studio →"}
                </Link>
              </div>
            ) : null}
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
                  className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-3 text-base text-[var(--text)] outline-none focus:border-[var(--navy)]/40 sm:py-2.5 sm:text-sm"
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
                  className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-3 text-base text-[var(--text)] outline-none focus:border-[var(--navy)]/40 sm:py-2.5 sm:text-sm"
                />
              </label>
            </div>
            <p className="mt-3 text-xs text-[var(--muted)]">
              State: <strong className="text-[var(--text)]">Florida</strong> ┬╖ more states later
            </p>
          </section>
        ) : null}

        {step === 2 && selected ? (
          <section>
            <h2 className="text-xl font-semibold text-[var(--text)] sm:text-2xl">
              Rough scale of the work
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Keep it simple ΓÇö this only shapes planning ranges, not a formal bid.
            </p>
            <div className="mt-5 grid gap-2">
              {(["small", "medium", "large"] as ScaleBand[]).map((s) => {
                const on = scale === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setScale(s)}
                    className={`min-h-[3.5rem] rounded-2xl border px-4 py-3.5 text-left transition ${
                      on
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                        : "border-[var(--border)] hover:border-[var(--navy)]/25"
                    }`}
                  >
                    <p className="text-sm font-semibold text-[var(--text)]">
                      {selected.scaleLabels[s]}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">{selected.scaleHints[s]}</p>
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
                      className={`min-h-10 rounded-full border px-3 py-2 text-xs font-medium transition ${
                        on ? "control-selected" : "control-off"
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
          <p
            className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {/* Desktop footer actions */}
        <div className="mt-8 hidden items-center justify-between gap-3 border-t border-[var(--border)] pt-5 sm:flex">
          <div>
            {step > 0 ? (
              <button
                type="button"
                onClick={goBack}
                className="rounded-xl px-3 py-2 text-sm font-medium text-[var(--muted)] hover:text-[var(--navy)]"
              >
                ΓåÉ Back
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
            className="btn-primary inline-flex min-h-11 items-center px-5 py-2.5 text-sm"
          >
            {step < 2 ? "Continue ΓåÆ" : "See cost ranges & contractors ΓåÆ"}
          </button>
        </div>
      </div>

      {/* Mobile sticky actions */}
      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-[var(--border)] bg-white/95 p-3 shadow-[0_-8px_24px_rgba(10,37,64,0.08)] backdrop-blur sm:hidden">
        <div className="flex gap-2">
          {step > 0 ? (
            <button
              type="button"
              onClick={goBack}
              className="min-h-12 shrink-0 rounded-xl border border-[var(--border)] px-4 text-sm font-medium text-[var(--muted)]"
            >
              Back
            </button>
          ) : null}
          <button
            type="button"
            onClick={goNext}
            className="btn-primary min-h-12 flex-1 text-sm"
          >
            {step < 2 ? "Continue" : "See results"}
          </button>
        </div>
      </div>
    </div>
  );
}
