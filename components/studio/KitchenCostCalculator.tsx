"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  computeKitchenEstimate,
  defaultKitchenCalcInput,
  formatUsd,
  getKitchenCalculatorConfig,
  type KitchenCalcInput,
  type KitchenOption,
} from "@/lib/plan/kitchen-calculator";
import { encodePlanQuery } from "@/lib/plan/plan-url";

function OptionGroup({
  legend,
  help,
  options,
  value,
  onChange,
}: {
  legend: string;
  help?: string;
  options: KitchenOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-[var(--text)]">{legend}</legend>
      {help ? <p className="mt-0.5 text-xs text-[var(--muted)]">{help}</p> : null}
      <div className="mt-2 grid gap-2">
        {options.map((o) => {
          const on = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
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
              {o.proxyHint ? (
                <p className="mt-0.5 text-[11px] text-[var(--muted)]">{o.proxyHint}</p>
              ) : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function pushTone(direction: string): string {
  if (direction === "up") return "text-amber-900";
  if (direction === "down") return "text-emerald-800";
  return "text-[var(--muted)]";
}

function pushLabel(direction: string): string {
  if (direction === "up") return "Pushes up";
  if (direction === "down") return "Pulls down";
  if (direction === "mixed") return "Mixed";
  return "Baseline";
}

export function KitchenCostCalculator() {
  const config = useMemo(() => getKitchenCalculatorConfig(), []);
  const [input, setInput] = useState<KitchenCalcInput>(() => defaultKitchenCalcInput());
  const [zip, setZip] = useState("");
  const [city, setCity] = useState("");

  const estimate = useMemo(() => computeKitchenEstimate(input), [input]);

  const set = <K extends keyof KitchenCalcInput>(key: K, id: string) => {
    setInput((s) => ({ ...s, [key]: id }));
  };

  const planResultsHref = useMemo(() => {
    const qs = encodePlanQuery({
      projectType: "kitchen_remodel",
      scale: estimate.planScale,
      state: "FL",
      zip: zip.replace(/\D/g, "").slice(0, 5) || undefined,
      city: city.trim() || undefined,
    });
    return `/plan/results?${qs}`;
  }, [estimate.planScale, zip, city]);

  const persistProjectContext = () => {
    void import("@/lib/project-context/store").then(({ saveProjectContext }) => {
      saveProjectContext({
        state: "fl",
        entryPath: "studio",
        projectType: "kitchen_remodel",
        scale: estimate.planScale,
        zip: zip.replace(/\D/g, "").slice(0, 5) || undefined,
        city: city.trim() || undefined,
      });
    });
  };

  const studioHref = `/studios/kitchen`;

  const midMarkerPct = Math.min(
    95,
    Math.max(
      5,
      ((estimate.mid - estimate.low) / Math.max(estimate.high - estimate.low, 1)) * 100
    )
  );

  return (
    <div className="grid gap-6 pb-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-8 lg:items-start lg:pb-0">
      <div className="space-y-5">
        <section className="rounded-3xl border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-md)] sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            1 · Kitchen profile
          </p>
          <h2 className="mt-1.5 text-lg font-semibold text-[var(--text)] sm:text-xl">
            Size, depth, layout, and finish
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Adjust the main Florida kitchen cost drivers. The planning band updates live — still not
            a bid.
          </p>

          <div className="mt-5 space-y-5">
            <OptionGroup
              legend="Kitchen size"
              help="Use footprint as a rough proxy if you do not have a drawing."
              options={config.sizeOptions}
              value={input.sizeId}
              onChange={(id) => set("sizeId", id)}
            />
            <OptionGroup
              legend="Remodel depth"
              options={config.depthOptions}
              value={input.depthId}
              onChange={(id) => set("depthId", id)}
            />
            <OptionGroup
              legend="Layout"
              options={config.layoutOptions}
              value={input.layoutId}
              onChange={(id) => set("layoutId", id)}
            />
            <OptionGroup
              legend="Finish & material level"
              options={config.finishOptions}
              value={input.finishId}
              onChange={(id) => set("finishId", id)}
            />
          </div>
        </section>

        <section className="rounded-3xl border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-md)] sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            2 · Location (optional)
          </p>
          <h2 className="mt-1.5 text-lg font-semibold text-[var(--text)]">
            For contractor matching only
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            ZIP or city does not invent local prices — it improves matching to verified Florida
            building / residential licenses (CGC, CBC, CRC).
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                ZIP
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
                City
              </span>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value.slice(0, 80))}
                placeholder="Miami"
                className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-3 text-base sm:text-sm"
              />
            </label>
          </div>
        </section>
      </div>

      <div className="space-y-5 lg:sticky lg:top-28">
        <section className="overflow-hidden rounded-3xl border-2 border-[var(--navy)]/10 bg-white shadow-[var(--shadow-lg)]">
          <div className="border-b border-[var(--border)] bg-[var(--navy)] px-4 py-3 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                Kitchen calculator · live
              </p>
              <span className="rounded-full bg-[var(--accent)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--navy)]">
                Planning only — not a bid
              </span>
            </div>
            <h2 className="mt-2 text-lg font-semibold text-white sm:text-xl">
              Florida kitchen remodel planning range
            </h2>
            <p className="text-sm text-white/75">
              {estimate.scaleLabel} · {estimate.depth.label}
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
              {estimate.midShiftPct !== 0 ? (
                <span>
                  {" "}
                  ({estimate.midShiftPct > 0 ? "+" : ""}
                  {estimate.midShiftPct}% vs base size band)
                </span>
              ) : (
                <span> (aligned with base size band mid)</span>
              )}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">{estimate.unitNote}</p>

            <div className="mt-5">
              <div className="relative h-3 overflow-hidden rounded-full bg-gradient-to-r from-emerald-100 via-[var(--accent-soft)] to-amber-100 ring-1 ring-[var(--border)]">
                <div
                  className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-[var(--navy)] shadow"
                  style={{ left: `${midMarkerPct}%` }}
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
              <p className="text-xs font-semibold text-[var(--navy)]">
                What is pushing this estimate
              </p>
              <ul className="mt-2 space-y-2">
                {estimate.drivers.map((d) => (
                  <li key={d.factor} className="text-xs leading-relaxed">
                    <span className="font-semibold text-[var(--text)]">{d.factor}:</span>{" "}
                    <span className="text-[var(--text)]">{d.choice}</span>
                    <span className={`ml-1.5 font-medium ${pushTone(d.direction)}`}>
                      ({pushLabel(d.direction)})
                    </span>
                    <p className="mt-0.5 text-[var(--muted)]">{d.text}</p>
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-950">
              <strong className="font-semibold">Planning only — not a bid or contractor quote.</strong>{" "}
              {estimate.disclaimer}
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-md)] sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            Next · verification
          </p>
          <h2 className="mt-1.5 text-lg font-semibold text-[var(--text)]">
            Find verified kitchen contractors
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            Matching uses Florida DBPR{" "}
            <strong className="text-[var(--text)]">building and residential licenses</strong>{" "}
            (CGC, CBC, CRC) for remodel scope. Evidence only — no rankings or introductions sold
            here.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Link
              href={planResultsHref}
              onClick={persistProjectContext}
              className="btn-primary inline-flex min-h-12 items-center justify-center px-5 text-sm no-underline"
            >
              Find verified contractors
            </Link>
            <Link
              href={studioHref}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-5 text-sm font-medium text-[var(--navy)] no-underline hover:bg-[var(--bg)]"
            >
              Open Kitchen Studio Q&amp;A
            </Link>
            <Link
              href="/verify"
              className="inline-flex min-h-12 items-center justify-center rounded-xl px-4 text-sm font-medium text-[var(--muted)] no-underline hover:text-[var(--navy)]"
            >
              Verify a name you have
            </Link>
          </div>
        </section>

        <section className="rounded-3xl border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-sm)] sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            Learn · Florida kitchens
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
            Prefer another planning tool?{" "}
            <Link href="/studio/bathroom" className="font-medium text-[var(--navy)] hover:underline">
              Bathroom calculator
            </Link>
            {" · "}
            <Link href="/studio/roofing" className="font-medium text-[var(--navy)] hover:underline">
              Roofing calculator
            </Link>
            {" · "}
            <Link href="/studio/cost" className="font-medium text-[var(--navy)] hover:underline">
              Cost Studio
            </Link>
          </p>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(10,37,64,0.08)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-[var(--muted)]">
              Planning only · kitchen
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
            Find contractors
          </Link>
        </div>
      </div>
    </div>
  );
}
