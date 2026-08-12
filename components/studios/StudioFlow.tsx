"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BUDGET_BANDS } from "@/lib/plan/project-types";
import { encodeStudioQuery, storageKey } from "@/lib/studios/context";
import { getStudioBySlug } from "@/lib/studios/registry";
import type { BudgetBand } from "@/lib/plan/types";

type Props = { slug: string };

/**
 * Loads studio config by slug on the client so functions (resolveScale, etc.)
 * never cross the Server→Client serialization boundary.
 */
export function StudioFlow({ slug }: Props) {
  const studio = getStudioBySlug(slug);
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<string, string | string[]>>({});
  const [zip, setZip] = useState("");
  const [city, setCity] = useState("");
  const [budgetBand, setBudgetBand] = useState<BudgetBand | null>("not_sure");
  const [error, setError] = useState<string | null>(null);

  // Restore local save
  useEffect(() => {
    if (!studio) return;
    try {
      const raw = localStorage.getItem(storageKey(studio.slug));
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        values?: Record<string, string | string[]>;
        zip?: string;
        city?: string;
        budgetBand?: BudgetBand;
      };
      if (saved.values) setValues(saved.values);
      if (saved.zip) setZip(saved.zip);
      if (saved.city) setCity(saved.city);
      if (saved.budgetBand) setBudgetBand(saved.budgetBand);
    } catch {
      /* ignore */
    }
  }, [studio]);

  const totalSteps = studio ? studio.steps.length + 1 : 1;

  const progressLabel = useMemo(() => {
    if (!studio) return "Studio";
    if (step < studio.steps.length) return studio.steps[step].title;
    return "Location & budget";
  }, [step, studio]);

  if (!studio) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Studio not found.{" "}
        <Link href="/studios" className="font-medium text-[var(--navy)]">
          Back to studios
        </Link>
      </p>
    );
  }

  const setSingle = (fieldId: string, optionId: string) => {
    setValues((v) => ({ ...v, [fieldId]: optionId }));
  };

  const toggleMulti = (fieldId: string, optionId: string) => {
    setValues((v) => {
      const cur = Array.isArray(v[fieldId]) ? [...(v[fieldId] as string[])] : [];
      const i = cur.indexOf(optionId);
      if (i >= 0) cur.splice(i, 1);
      else cur.push(optionId);
      return { ...v, [fieldId]: cur };
    });
  };

  const canNext = () => {
    if (step < studio.steps.length) {
      const s = studio.steps[step];
      for (const f of s.fields) {
        if (!f.required) continue;
        const val = values[f.id];
        if (f.type === "single" && !val) return false;
        if (f.type === "multi" && (!Array.isArray(val) || val.length === 0)) return false;
      }
      return true;
    }
    return zip.replace(/\D/g, "").length === 5 || city.trim().length >= 2;
  };

  const goNext = () => {
    setError(null);
    if (!canNext()) {
      setError(
        step < studio.steps.length
          ? "Please answer the required questions."
          : "Enter a Florida ZIP or city."
      );
      return;
    }
    if (step < totalSteps - 1) {
      setStep(step + 1);
      return;
    }
    const answers = {
      studioSlug: studio.slug,
      projectType: studio.projectType,
      values,
      budgetBand,
      zip: zip.replace(/\D/g, "").slice(0, 5) || undefined,
      city: city.trim() || undefined,
      state: "FL",
    };
    try {
      localStorage.setItem(
        storageKey(studio.slug),
        JSON.stringify({ values, zip, city, budgetBand, savedAt: new Date().toISOString() })
      );
    } catch {
      /* ignore */
    }
    router.push(`/studios/${studio.slug}/results?${encodeStudioQuery(studio.slug, answers)}`);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <nav aria-label="Studio progress" className="mb-6">
        <div className="flex items-center gap-2">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <button
              key={i}
              type="button"
              disabled={i > step}
              onClick={() => i < step && setStep(i)}
              className={`h-1.5 flex-1 rounded-full transition ${
                i <= step ? "bg-[var(--navy)]" : "bg-[var(--border)]"
              }`}
              aria-label={`Step ${i + 1}`}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Step {step + 1} of {totalSteps} · {progressLabel}
        </p>
      </nav>

      <div className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)] sm:p-8">
        {step < studio.steps.length ? (
          <section>
            <h2 className="text-xl font-semibold text-[var(--text)] sm:text-2xl">
              {studio.steps[step].title}
            </h2>
            {studio.steps[step].body ? (
              <p className="mt-2 text-sm text-[var(--muted)]">{studio.steps[step].body}</p>
            ) : null}
            <div className="mt-5 space-y-6">
              {studio.steps[step].fields.map((field) => (
                <div key={field.id}>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                    {field.label}
                    {field.required ? " *" : ""}
                  </p>
                  <div className="mt-2 grid gap-2">
                    {field.options.map((opt) => {
                      const selected =
                        field.type === "single"
                          ? values[field.id] === opt.id
                          : Array.isArray(values[field.id]) &&
                            (values[field.id] as string[]).includes(opt.id);
                      const featured = Boolean(opt.featured);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            field.type === "single"
                              ? setSingle(field.id, opt.id)
                              : toggleMulti(field.id, opt.id)
                          }
                          className={`rounded-2xl border px-4 py-3 text-left transition ${
                            selected
                              ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[var(--shadow-sm)]"
                              : featured
                                ? "border-[var(--navy)]/30 bg-[var(--navy-soft)] hover:border-[var(--navy)]/45"
                                : "border-[var(--border)] hover:border-[var(--navy)]/25"
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-[var(--text)]">{opt.label}</p>
                            {featured ? (
                              <span className="rounded-full border border-[var(--navy)]/20 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--navy)]">
                                Most common
                              </span>
                            ) : null}
                          </div>
                          {opt.hint ? (
                            <p className="mt-0.5 text-xs text-[var(--muted)]">{opt.hint}</p>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section>
            <h2 className="text-xl font-semibold text-[var(--text)] sm:text-2xl">
              Where is the project?
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Florida first — ZIP preferred so we can match licensed contractors nearby.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-[var(--muted)]">
                ZIP code
                <input
                  inputMode="numeric"
                  value={zip}
                  onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                  className="mt-1.5 w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm font-normal text-[var(--text)]"
                  placeholder="33139"
                />
              </label>
              <label className="block text-xs font-semibold text-[var(--muted)]">
                City (optional if ZIP)
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value.slice(0, 80))}
                  className="mt-1.5 w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm font-normal text-[var(--text)]"
                  placeholder="Miami"
                />
              </label>
            </div>
            <fieldset className="mt-6">
              <legend className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                Budget comfort (optional)
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {BUDGET_BANDS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBudgetBand(b.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                      budgetBand === b.id
                        ? "border-[var(--navy)] bg-[var(--navy)] text-white"
                        : "border-[var(--border)] text-[var(--muted)]"
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </fieldset>
          </section>
        )}

        {error ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {error}
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-5">
          <div className="flex flex-wrap gap-3">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep(step - 1);
                }}
                className="text-sm font-medium text-[var(--muted)]"
              >
                ← Back
              </button>
            ) : (
              <Link href="/studios" className="text-sm font-medium text-[var(--muted)] no-underline">
                ← All studios
              </Link>
            )}
          </div>
          <button
            type="button"
            onClick={goNext}
            className="btn-primary min-h-11 px-5 py-2.5 text-sm"
          >
            {step < totalSteps - 1 ? "Continue →" : "See range & contractors →"}
          </button>
        </div>
      </div>
    </div>
  );
}
