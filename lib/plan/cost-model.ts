import costData from "@/data/plan/fl-cost-ranges.json";
import { getProjectType } from "./project-types";
import {
  COST_DISCLAIMER,
  type CostRangeResult,
  type ProjectTypeId,
  type ScaleBand,
} from "./types";

type CostFile = {
  state: string;
  ranges: Array<{
    projectType: string;
    scale: string;
    low: number;
    mid: number;
    high: number;
    drivers: string[];
    unitNote?: string;
  }>;
  disclaimer?: string;
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

/**
 * Lookup conceptual cost range for project type + scale.
 * Florida-first; state parameter reserved for multi-state expansion.
 */
export function getCostRange(
  projectType: ProjectTypeId,
  scale: ScaleBand,
  state = "FL"
): CostRangeResult {
  const def = getProjectType(projectType);
  const row =
    data.ranges.find(
      (r) => r.projectType === projectType && r.scale === scale
    ) ??
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
      unitNote: "General planning band",
      disclaimer: data.disclaimer || COST_DISCLAIMER,
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
    unitNote: row.unitNote || def.scaleHints[scale],
    disclaimer: data.disclaimer || COST_DISCLAIMER,
  };
}
