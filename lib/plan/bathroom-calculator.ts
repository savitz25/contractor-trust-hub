/**
 * Bathroom Cost Calculator — config-driven planning bands for Florida baths.
 * Base dollars: fl-cost-ranges.json (bathroom_remodel × scale). Factors: bathroom-calculator.json.
 */

import calcJson from "@/data/plan/bathroom-calculator.json";
import { getCostRange, formatUsd, formatUsdRange } from "./cost-model";
import type { ScaleBand } from "./types";

export type BathroomOption = {
  id: string;
  label: string;
  description?: string;
  proxyHint?: string;
  scale?: ScaleBand;
  lowMul: number;
  midMul: number;
  highMul: number;
  push?: "up" | "down" | "neutral" | "mixed";
  explain?: string;
};

type CalcFile = {
  _meta: { description: string; updated: string; state: string };
  disclaimer: string;
  methodologyNote: string;
  floridaNotes: string[];
  sizeOptions: BathroomOption[];
  depthOptions: BathroomOption[];
  layoutOptions: BathroomOption[];
  finishOptions: BathroomOption[];
  defaults: { size: string; depth: string; layout: string; finish: string };
  education: string[];
};

const data = calcJson as CalcFile;

export type BathroomCalcInput = {
  sizeId: string;
  depthId: string;
  layoutId: string;
  finishId: string;
};

export type BathroomDriverLine = {
  factor: string;
  choice: string;
  direction: "up" | "down" | "neutral" | "mixed";
  text: string;
};

export type BathroomCalcResult = {
  low: number;
  mid: number;
  high: number;
  spanLabel: string;
  baseLow: number;
  baseMid: number;
  baseHigh: number;
  midShiftPct: number;
  scale: ScaleBand;
  scaleLabel: string;
  unitNote: string;
  size: BathroomOption;
  depth: BathroomOption;
  layout: BathroomOption;
  finish: BathroomOption;
  drivers: BathroomDriverLine[];
  bandHints: { low: string; mid: string; high: string };
  floridaNotes: string[];
  education: string[];
  disclaimer: string;
  methodologyNote: string;
  planScale: ScaleBand;
};

function roundMoney(n: number): number {
  if (n >= 100_000) return Math.round(n / 1000) * 1000;
  if (n >= 10_000) return Math.round(n / 500) * 500;
  return Math.round(n / 100) * 100;
}

function pick(options: BathroomOption[], id: string, fallbackId: string): BathroomOption {
  return (
    options.find((o) => o.id === id) ||
    options.find((o) => o.id === fallbackId) ||
    options[0]
  );
}

/** Bath type plus depth/layout can bump the Plan matching scale. */
function resolvePlanScale(size: ScaleBand, depthId: string, layoutId: string, sizeId: string): ScaleBand {
  if (sizeId === "powder" && depthId !== "full_gut" && layoutId !== "major") {
    return "small";
  }
  if (depthId === "full_gut" && (size === "medium" || size === "large" || layoutId === "major")) {
    return "large";
  }
  if (depthId === "refresh" && size === "small") return "small";
  if (depthId === "refresh" && layoutId !== "major") {
    return size === "large" ? "medium" : "small";
  }
  if (layoutId === "major" && size !== "small") return "large";
  return size;
}

export function getBathroomCalculatorConfig() {
  return {
    sizeOptions: data.sizeOptions,
    depthOptions: data.depthOptions,
    layoutOptions: data.layoutOptions,
    finishOptions: data.finishOptions,
    defaults: data.defaults,
    floridaNotes: data.floridaNotes,
    education: data.education,
    disclaimer: data.disclaimer,
    methodologyNote: data.methodologyNote,
  };
}

export function defaultBathroomCalcInput(): BathroomCalcInput {
  return {
    sizeId: data.defaults.size,
    depthId: data.defaults.depth,
    layoutId: data.defaults.layout,
    finishId: data.defaults.finish,
  };
}

export function computeBathroomEstimate(input: BathroomCalcInput): BathroomCalcResult {
  const size = pick(data.sizeOptions, input.sizeId, data.defaults.size);
  const depth = pick(data.depthOptions, input.depthId, data.defaults.depth);
  const layout = pick(data.layoutOptions, input.layoutId, data.defaults.layout);
  const finish = pick(data.finishOptions, input.finishId, data.defaults.finish);

  const scale = (size.scale || "medium") as ScaleBand;
  const base = getCostRange("bathroom_remodel", scale, "FL");

  const factors = [size, depth, layout, finish];
  let lowMul = 1;
  let midMul = 1;
  let highMul = 1;
  for (const f of factors) {
    lowMul *= f.lowMul;
    midMul *= f.midMul;
    highMul *= f.highMul;
  }

  let low = roundMoney(base.low * lowMul);
  let mid = roundMoney(base.mid * midMul);
  let high = roundMoney(base.high * highMul);
  if (mid < low) mid = low;
  if (high < mid) high = mid;

  const midShiftPct = base.mid > 0 ? Math.round(((mid - base.mid) / base.mid) * 100) : 0;

  const drivers: BathroomDriverLine[] = [
    {
      factor: "Bath type",
      choice: size.label,
      direction: "neutral",
      text: size.proxyHint || size.description || size.label,
    },
    {
      factor: "Remodel depth",
      choice: depth.label,
      direction: depth.push || "neutral",
      text: depth.explain || depth.description || depth.label,
    },
    {
      factor: "Layout",
      choice: layout.label,
      direction: layout.push || "neutral",
      text: layout.explain || layout.description || layout.label,
    },
    {
      factor: "Finish level",
      choice: finish.label,
      direction: finish.push || "neutral",
      text: finish.explain || finish.description || finish.label,
    },
  ];

  const pushingUp = drivers.filter((d) => d.direction === "up").map((d) => d.factor);
  const pushingDown = drivers.filter((d) => d.direction === "down").map((d) => d.factor);

  const bandHints = {
    low:
      pushingDown.length > 0
        ? `Toward low when ${pushingDown.join(" + ").toLowerCase()} stay simple`
        : base.bandHints.low,
    mid:
      midShiftPct === 0
        ? base.bandHints.mid
        : midShiftPct > 0
          ? `Mid planning point sits ~${midShiftPct}% above the base size band after depth, layout, and finish`
          : `Mid planning point sits ~${Math.abs(midShiftPct)}% below the base size band after simpler choices`,
    high:
      pushingUp.length > 0
        ? `Toward high when ${pushingUp.join(" + ").toLowerCase()} stack — plus moisture repairs or accessibility work`
        : base.bandHints.high,
  };

  return {
    low,
    mid,
    high,
    spanLabel: formatUsdRange(low, high),
    baseLow: base.low,
    baseMid: base.mid,
    baseHigh: base.high,
    midShiftPct,
    scale,
    scaleLabel: size.label,
    unitNote: base.unitNote,
    size,
    depth,
    layout,
    finish,
    drivers,
    bandHints,
    floridaNotes: data.floridaNotes,
    education: data.education,
    disclaimer: data.disclaimer,
    methodologyNote: data.methodologyNote,
    planScale: resolvePlanScale(scale, depth.id, layout.id, size.id),
  };
}

export { formatUsd, formatUsdRange };
