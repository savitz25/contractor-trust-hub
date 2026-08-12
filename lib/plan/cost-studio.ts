/**
 * Cost Studio: interactive planning estimates on top of fl-cost-ranges.json.
 * Multipliers from cost-studio-factors.json — never contractor-specific pricing.
 */

import factorsJson from "@/data/plan/cost-studio-factors.json";
import { getCostRange, formatUsd, formatUsdRange } from "./cost-model";
import type { CostBandHints, CostRangeResult, ProjectTypeId, ScaleBand } from "./types";

export type FactorOption = {
  id: string;
  label: string;
  description?: string;
  lowMul: number;
  midMul: number;
  highMul: number;
};

export type StudioFactor = {
  id: string;
  label: string;
  help?: string;
  options: FactorOption[];
};

type FactorsFile = {
  _meta: { description: string; updated: string };
  floridaNotes: string[];
  globalFactors: StudioFactor[];
  byProjectType: Record<
    string,
    {
      extraFactors?: StudioFactor[];
      education?: string[];
    }
  >;
};

const factorsData = factorsJson as FactorsFile;

export type StudioSelections = Record<string, string>; // factorId → optionId

export type StudioEstimate = CostRangeResult & {
  /** Base mid before factor multipliers (for transparency) */
  baseLow: number;
  baseMid: number;
  baseHigh: number;
  /** Product of multipliers applied */
  lowMul: number;
  midMul: number;
  highMul: number;
  /** Active factor choices with labels */
  appliedFactors: Array<{ factorLabel: string; optionLabel: string }>;
  education: string[];
  floridaNotes: string[];
  spanLabel: string;
};

function roundMoney(n: number): number {
  if (n >= 100_000) return Math.round(n / 1000) * 1000;
  if (n >= 10_000) return Math.round(n / 500) * 500;
  return Math.round(n / 100) * 100;
}

export function getStudioFactors(projectType: ProjectTypeId): StudioFactor[] {
  const extra = factorsData.byProjectType[projectType]?.extraFactors ?? [];
  return [...factorsData.globalFactors, ...extra];
}

export function getStudioEducation(projectType: ProjectTypeId): string[] {
  return factorsData.byProjectType[projectType]?.education ?? [];
}

export function getFloridaCostNotes(): string[] {
  return factorsData.floridaNotes ?? [];
}

/** Default each factor to the option with midMul closest to 1 (usually "standard"). */
export function defaultStudioSelections(projectType: ProjectTypeId): StudioSelections {
  const out: StudioSelections = {};
  for (const f of getStudioFactors(projectType)) {
    const standard =
      f.options.find((o) => o.id === "standard" || o.id === "typical" || o.id === "moderate") ||
      f.options.find((o) => o.midMul === 1) ||
      f.options[1] ||
      f.options[0];
    if (standard) out[f.id] = standard.id;
  }
  return out;
}

function resolveOption(factor: StudioFactor, optionId: string | undefined): FactorOption {
  return (
    factor.options.find((o) => o.id === optionId) ||
    factor.options.find((o) => o.midMul === 1) ||
    factor.options[0]
  );
}

/**
 * Build interactive studio estimate from base FL ranges + factor multipliers.
 */
export function computeStudioEstimate(opts: {
  projectType: ProjectTypeId;
  scale: ScaleBand;
  selections: StudioSelections;
  state?: string;
}): StudioEstimate {
  const base = getCostRange(opts.projectType, opts.scale, opts.state || "FL");
  const factors = getStudioFactors(opts.projectType);

  let lowMul = 1;
  let midMul = 1;
  let highMul = 1;
  const appliedFactors: StudioEstimate["appliedFactors"] = [];

  for (const f of factors) {
    const opt = resolveOption(f, opts.selections[f.id]);
    lowMul *= opt.lowMul;
    midMul *= opt.midMul;
    highMul *= opt.highMul;
    appliedFactors.push({ factorLabel: f.label, optionLabel: opt.label });
  }

  // Keep ordering low ≤ mid ≤ high after rounding
  let low = roundMoney(base.low * lowMul);
  let mid = roundMoney(base.mid * midMul);
  let high = roundMoney(base.high * highMul);
  if (mid < low) mid = low;
  if (high < mid) high = mid;

  // Soften band hints when factors push premium/complex
  const bandHints: CostBandHints = {
    low: blendHint(base.bandHints.low, appliedFactors, "low"),
    mid: blendHint(base.bandHints.mid, appliedFactors, "mid"),
    high: blendHint(base.bandHints.high, appliedFactors, "high"),
  };

  return {
    ...base,
    low,
    mid,
    high,
    bandHints,
    baseLow: base.low,
    baseMid: base.mid,
    baseHigh: base.high,
    lowMul,
    midMul,
    highMul,
    appliedFactors,
    education: getStudioEducation(opts.projectType),
    floridaNotes: getFloridaCostNotes(),
    spanLabel: formatUsdRange(low, high),
  };
}

function blendHint(
  base: string,
  applied: StudioEstimate["appliedFactors"],
  _band: "low" | "mid" | "high"
): string {
  if (applied.length === 0) return base;
  // Keep base text; UI shows applied factors separately
  return base;
}

export { formatUsd, formatUsdRange };
