/**
 * Roofing Cost Calculator — config-driven planning bands for Florida reroofs.
 * Base dollars: fl-cost-ranges.json (roofing × scale). Factors: roofing-calculator.json.
 */

import calcJson from "@/data/plan/roofing-calculator.json";
import { getCostRange, formatUsd, formatUsdRange } from "./cost-model";
import type { ScaleBand } from "./types";

export type RoofingOption = {
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
  sizeOptions: RoofingOption[];
  materialOptions: RoofingOption[];
  storiesOptions: RoofingOption[];
  pitchOptions: RoofingOption[];
  defaults: {
    size: string;
    material: string;
    stories: string;
    pitch: string;
  };
  education: string[];
};

const data = calcJson as CalcFile;

export type RoofingCalcInput = {
  sizeId: string;
  materialId: string;
  storiesId: string;
  pitchId: string;
};

export type RoofingDriverLine = {
  factor: string;
  choice: string;
  direction: "up" | "down" | "neutral" | "mixed";
  text: string;
};

export type RoofingCalcResult = {
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
  size: RoofingOption;
  material: RoofingOption;
  stories: RoofingOption;
  pitch: RoofingOption;
  drivers: RoofingDriverLine[];
  bandHints: { low: string; mid: string; high: string };
  floridaNotes: string[];
  education: string[];
  disclaimer: string;
  methodologyNote: string;
  /** For Plan / match handoff */
  planScale: ScaleBand;
};

function roundMoney(n: number): number {
  if (n >= 100_000) return Math.round(n / 1000) * 1000;
  if (n >= 10_000) return Math.round(n / 500) * 500;
  return Math.round(n / 100) * 100;
}

function pick(options: RoofingOption[], id: string, fallbackId: string): RoofingOption {
  return (
    options.find((o) => o.id === id) ||
    options.find((o) => o.id === fallbackId) ||
    options[0]
  );
}

export function getRoofingCalculatorConfig() {
  return {
    sizeOptions: data.sizeOptions,
    materialOptions: data.materialOptions,
    storiesOptions: data.storiesOptions,
    pitchOptions: data.pitchOptions,
    defaults: data.defaults,
    floridaNotes: data.floridaNotes,
    education: data.education,
    disclaimer: data.disclaimer,
    methodologyNote: data.methodologyNote,
  };
}

export function defaultRoofingCalcInput(): RoofingCalcInput {
  return {
    sizeId: data.defaults.size,
    materialId: data.defaults.material,
    storiesId: data.defaults.stories,
    pitchId: data.defaults.pitch,
  };
}

/**
 * Live planning estimate from size band + roofing factors.
 * Location is intentionally not applied to dollars.
 */
export function computeRoofingEstimate(input: RoofingCalcInput): RoofingCalcResult {
  const size = pick(data.sizeOptions, input.sizeId, data.defaults.size);
  const material = pick(data.materialOptions, input.materialId, data.defaults.material);
  const stories = pick(data.storiesOptions, input.storiesId, data.defaults.stories);
  const pitch = pick(data.pitchOptions, input.pitchId, data.defaults.pitch);

  const scale = (size.scale || "medium") as ScaleBand;
  const base = getCostRange("roofing", scale, "FL");

  const factors = [size, material, stories, pitch];
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

  const midShiftPct =
    base.mid > 0 ? Math.round(((mid - base.mid) / base.mid) * 100) : 0;

  const drivers: RoofingDriverLine[] = [
    {
      factor: "Roof size",
      choice: size.label,
      direction: "neutral",
      text: size.proxyHint || size.description || size.label,
    },
    {
      factor: "Roof system",
      choice: material.label,
      direction: material.push || "neutral",
      text: material.explain || material.description || material.label,
    },
    {
      factor: "Stories / access",
      choice: stories.label,
      direction: stories.push || "neutral",
      text: stories.explain || stories.description || stories.label,
    },
    {
      factor: "Pitch / complexity",
      choice: pitch.label,
      direction: pitch.push || "neutral",
      text: pitch.explain || pitch.description || pitch.label,
    },
  ];

  const pushingUp = drivers.filter((d) => d.direction === "up").map((d) => d.factor);
  const pushingDown = drivers.filter((d) => d.direction === "down").map((d) => d.factor);

  const bandHints = {
    low:
      pushingDown.length > 0
        ? `Toward low when ${pushingDown.join(" + ").toLowerCase()} stay simple, with limited tear-off surprises`
        : base.bandHints.low,
    mid:
      midShiftPct === 0
        ? base.bandHints.mid
        : midShiftPct > 0
          ? `Mid planning point sits ~${midShiftPct}% above the base size band after your system and complexity choices`
          : `Mid planning point sits ~${Math.abs(midShiftPct)}% below the base size band after simpler choices`,
    high:
      pushingUp.length > 0
        ? `Toward high when ${pushingUp.join(" + ").toLowerCase()} stack — plus deck repairs or wind-mitigation package upgrades`
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
    material,
    stories,
    pitch,
    drivers,
    bandHints,
    floridaNotes: data.floridaNotes,
    education: data.education,
    disclaimer: data.disclaimer,
    methodologyNote: data.methodologyNote,
    planScale: scale,
  };
}

export { formatUsd, formatUsdRange };
