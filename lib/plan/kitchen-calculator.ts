/**
 * Kitchen Cost Calculator — config-driven planning bands for Florida kitchens.
 * Base dollars: fl-cost-ranges.json (kitchen_remodel × scale). Factors: kitchen-calculator.json.
 */

import calcJson from "@/data/plan/kitchen-calculator.json";
import { getCostRange, formatUsd, formatUsdRange } from "./cost-model";
import type { ScaleBand } from "./types";

export type KitchenOption = {
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
  sizeOptions: KitchenOption[];
  depthOptions: KitchenOption[];
  layoutOptions: KitchenOption[];
  finishOptions: KitchenOption[];
  defaults: { size: string; depth: string; layout: string; finish: string };
  education: string[];
};

const data = calcJson as CalcFile;

export type KitchenCalcInput = {
  sizeId: string;
  depthId: string;
  layoutId: string;
  finishId: string;
};

export type KitchenDriverLine = {
  factor: string;
  choice: string;
  direction: "up" | "down" | "neutral" | "mixed";
  text: string;
};

export type KitchenCalcResult = {
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
  size: KitchenOption;
  depth: KitchenOption;
  layout: KitchenOption;
  finish: KitchenOption;
  drivers: KitchenDriverLine[];
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

function pick(options: KitchenOption[], id: string, fallbackId: string): KitchenOption {
  return (
    options.find((o) => o.id === id) ||
    options.find((o) => o.id === fallbackId) ||
    options[0]
  );
}

/** Size band plus depth/layout can bump the Plan matching scale. */
function resolvePlanScale(size: ScaleBand, depthId: string, layoutId: string): ScaleBand {
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

export function getKitchenCalculatorConfig() {
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

export function defaultKitchenCalcInput(): KitchenCalcInput {
  return {
    sizeId: data.defaults.size,
    depthId: data.defaults.depth,
    layoutId: data.defaults.layout,
    finishId: data.defaults.finish,
  };
}

export function computeKitchenEstimate(input: KitchenCalcInput): KitchenCalcResult {
  const size = pick(data.sizeOptions, input.sizeId, data.defaults.size);
  const depth = pick(data.depthOptions, input.depthId, data.defaults.depth);
  const layout = pick(data.layoutOptions, input.layoutId, data.defaults.layout);
  const finish = pick(data.finishOptions, input.finishId, data.defaults.finish);

  const scale = (size.scale || "medium") as ScaleBand;
  const base = getCostRange("kitchen_remodel", scale, "FL");

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

  const drivers: KitchenDriverLine[] = [
    {
      factor: "Kitchen size",
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
        ? `Toward high when ${pushingUp.join(" + ").toLowerCase()} stack — plus occupied-home phasing or electrical upgrades`
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
    planScale: resolvePlanScale(scale, depth.id, layout.id),
  };
}

export { formatUsd, formatUsdRange };
