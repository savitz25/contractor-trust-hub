import costData from "@/data/plan/fl-cost-ranges.json";
import { getProjectType } from "./project-types";
import {
  COST_DISCLAIMER,
  type CostBandHints,
  type CostRangeResult,
  type ProjectTypeId,
  type ScaleBand,
} from "./types";

type CostFile = {
  state: string;
  currency?: string;
  version?: string;
  updatedAt?: string;
  methodologyNote?: string;
  disclaimer?: string;
  ranges: Array<{
    projectType: string;
    scale: string;
    low: number;
    mid: number;
    high: number;
    drivers: string[];
    bandHints?: CostBandHints;
    unitNote?: string;
  }>;
};

const data = costData as CostFile;

export function formatUsd(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (n >= 10_000) {
    return `$${Math.round(n / 1000)}k`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Span label e.g. "$48k–$125k" for scannable UI */
export function formatUsdRange(low: number, high: number): string {
  return `${formatUsd(low)}–${formatUsd(high)}`;
}

function defaultBandHints(scaleLabel: string): CostBandHints {
  return {
    low: `Simpler scope and finishes for a ${scaleLabel.toLowerCase()} project`,
    mid: `Typical materials, labor, and complexity for this scale`,
    high: `More complex work, higher finishes, or tougher site conditions`,
  };
}

/**
 * Lookup conceptual cost range for project type + scale.
 * Data-driven: edit data/plan/fl-cost-ranges.json only.
 */
export function getCostRange(
  projectType: ProjectTypeId,
  scale: ScaleBand,
  state = "FL"
): CostRangeResult {
  const def = getProjectType(projectType);
  const row =
    data.ranges.find((r) => r.projectType === projectType && r.scale === scale) ??
    data.ranges.find((r) => r.projectType === projectType && r.scale === "medium");

  if (!row) {
    return {
      projectType,
      projectLabel: def.label,
      scale,
      scaleLabel: def.scaleLabels[scale],
      state,
      low: 10000,
      mid: 35000,
      high: 75000,
      drivers: ["Scope varies widely for this project type"],
      bandHints: defaultBandHints(def.scaleLabels[scale]),
      unitNote: "General planning band",
      disclaimer: data.disclaimer || COST_DISCLAIMER,
      methodologyNote: data.methodologyNote,
    };
  }

  return {
    projectType,
    projectLabel: def.label,
    scale,
    scaleLabel: def.scaleLabels[scale],
    state,
    low: row.low,
    mid: row.mid,
    high: row.high,
    drivers: row.drivers,
    bandHints: row.bandHints || defaultBandHints(def.scaleLabels[scale]),
    unitNote: row.unitNote || def.scaleHints[scale],
    disclaimer: data.disclaimer || COST_DISCLAIMER,
    methodologyNote: data.methodologyNote,
  };
}

export function getCostDataMeta(): {
  version?: string;
  updatedAt?: string;
  methodologyNote?: string;
} {
  return {
    version: data.version,
    updatedAt: data.updatedAt,
    methodologyNote: data.methodologyNote,
  };
}
