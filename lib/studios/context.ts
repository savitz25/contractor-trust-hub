import { getProjectType } from "@/lib/plan/project-types";
import { countyFromFloridaZip, formatLocationLabel, normalizeZip } from "@/lib/plan/location";
import type {
  BudgetBand,
  CostRangeResult,
  ProjectTypeId,
  ScaleBand,
} from "@/lib/plan/types";
import { getCostRange } from "@/lib/plan/cost-model";
import { getStudioBySlug } from "./registry";
import type { StudioAnswers, StudioContext, StudioDefinition } from "./types";

/** Build human-readable summary lines from studio answers. */
export function buildAnswerSummary(
  studio: StudioDefinition,
  answers: StudioAnswers
): string[] {
  const lines: string[] = [];
  for (const step of studio.steps) {
    for (const field of step.fields) {
      const raw = answers.values[field.id];
      if (raw == null || (Array.isArray(raw) && raw.length === 0)) continue;
      if (field.type === "single" && typeof raw === "string") {
        const opt = field.options.find((o) => o.id === raw);
        lines.push(`${field.label}: ${opt?.label ?? raw}`);
      } else if (field.type === "multi" && Array.isArray(raw)) {
        const labels = raw
          .map((id) => field.options.find((o) => o.id === id)?.label ?? id)
          .join(", ");
        if (labels) lines.push(`${field.label}: ${labels}`);
      }
    }
  }
  if (answers.budgetBand && answers.budgetBand !== "not_sure") {
    lines.push(`Budget comfort: ${answers.budgetBand.replace(/_/g, " ")}`);
  }
  return lines;
}

/** Collect cost driver lines from base + selected answers. */
export function resolveDrivers(
  studio: StudioDefinition,
  answers: StudioAnswers
): string[] {
  const selected = new Set<string>();
  for (const v of Object.values(answers.values)) {
    if (typeof v === "string") selected.add(v);
    else if (Array.isArray(v)) v.forEach((x) => selected.add(x));
  }
  const fromAnswers = [...selected]
    .map((id) => studio.driverByAnswer[id])
    .filter(Boolean) as string[];
  // Prefer answer-specific drivers, then fill with base
  const out: string[] = [];
  for (const d of fromAnswers) {
    if (!out.includes(d)) out.push(d);
  }
  for (const d of studio.baseCostDrivers) {
    if (out.length >= 6) break;
    if (!out.includes(d)) out.push(d);
  }
  return out.slice(0, 6);
}

export function effectiveProjectType(
  studio: StudioDefinition,
  answers: StudioAnswers
): ProjectTypeId {
  return studio.resolveProjectType?.(answers) ?? studio.projectType;
}

export function buildStudioContext(
  studio: StudioDefinition,
  answers: StudioAnswers
): StudioContext {
  const scale = studio.resolveScale(answers);
  const projectType = effectiveProjectType(studio, answers);
  const def = getProjectType(projectType);
  const zip = normalizeZip(answers.zip);
  const county = countyFromFloridaZip(zip);
  return {
    studioSlug: studio.slug,
    studioName: studio.name,
    projectType,
    projectLabel: def.label,
    answers: { ...answers, projectType },
    answerSummary: buildAnswerSummary(studio, answers),
    scale,
    scaleLabel: def.scaleLabels[scale],
    budgetBand: answers.budgetBand ?? null,
    location: {
      state: (answers.state || "FL").toUpperCase(),
      zip: zip || undefined,
      city: answers.city?.trim() || undefined,
      county,
    },
  };
}

export function studioCostRange(
  studio: StudioDefinition,
  answers: StudioAnswers
): CostRangeResult {
  const scale = studio.resolveScale(answers);
  const projectType = effectiveProjectType(studio, answers);
  const base = getCostRange(projectType, scale, answers.state || "FL");
  const drivers = resolveDrivers(studio, answers);
  const unitNote = studio.resolveUnitNote?.(answers) || base.unitNote;
  // Mild adjustments: multi-select complexity
  let { low, mid, high } = base;
  const multi = answers.values.work_included;
  const multiAreas = answers.values.major_areas;
  const workCount =
    (Array.isArray(multi) ? multi.length : 0) +
    (Array.isArray(multiAreas) ? multiAreas.length : 0);
  if (workCount >= 5) {
    low = Math.round(low * 1.05);
    mid = Math.round(mid * 1.08);
    high = Math.round(high * 1.1);
  }
  if (
    answers.values.plumbing_move === "plumbing_move" ||
    (Array.isArray(multi) && multi.includes("plumbing_move")) ||
    (Array.isArray(multi) && multi.includes("bathroom_add"))
  ) {
    mid = Math.round(mid * 1.06);
    high = Math.round(high * 1.1);
  }
  if (
    answers.values.layout === "layout" ||
    (Array.isArray(multi) && multi.includes("layout")) ||
    (Array.isArray(multi) && multi.includes("structural")) ||
    (Array.isArray(multiAreas) && multiAreas.includes("layout"))
  ) {
    mid = Math.round(mid * 1.05);
    high = Math.round(high * 1.08);
  }
  // Roofing studio adjustments (full replacement first-class)
  const roofAction = answers.values.roof_action;
  const roofMat = answers.values.roof_type;
  const roofFactors = answers.values.replace_factors;
  if (roofAction === "full_replace") {
    mid = Math.round(mid * 1.06);
    high = Math.round(high * 1.1);
  }
  if (roofAction === "reroof") {
    // Overlay can sit slightly under full replacement mid
    low = Math.round(low * 0.95);
  }
  if (answers.values.access === "complex" || roofMat === "tile" || roofMat === "metal") {
    mid = Math.round(mid * 1.08);
    high = Math.round(high * 1.12);
  }
  if (roofMat === "flat") {
    mid = Math.round(mid * 1.04);
    high = Math.round(high * 1.08);
  }
  if (Array.isArray(roofFactors)) {
    if (roofFactors.includes("decking_concern") || roofFactors.includes("multiple_layers")) {
      mid = Math.round(mid * 1.05);
      high = Math.round(high * 1.1);
    }
    if (roofFactors.includes("skylights")) {
      mid = Math.round(mid * 1.03);
      high = Math.round(high * 1.05);
    }
    if (roofFactors.includes("wind_mit") || roofFactors.includes("hoa_permit")) {
      mid = Math.round(mid * 1.03);
      high = Math.round(high * 1.06);
    }
    if (roofFactors.includes("ventilation")) {
      mid = Math.round(mid * 1.02);
      high = Math.round(high * 1.04);
    }
    if (roofFactors.includes("active_leak")) {
      // Urgency — slight mid lift; still conceptual
      mid = Math.round(mid * 1.02);
    }
  }
  if (
    answers.values.access === "multi_story" ||
    answers.values.access === "steep" ||
    answers.values.access === "limited"
  ) {
    mid = Math.round(mid * 1.06);
    high = Math.round(high * 1.1);
  }
  if (answers.values.addition_type === "second_story") {
    mid = Math.round(mid * 1.12);
    high = Math.round(high * 1.15);
  }
  if (answers.values.occupied === "yes") {
    mid = Math.round(mid * 1.04);
    high = Math.round(high * 1.06);
  }

  // Kitchen studio — mid-range / full remodel first-class
  const kitchenScale = answers.values.project_scale;
  const layoutCx = answers.values.layout_complexity;
  const kitchenConstraints = answers.values.kitchen_constraints;
  if (kitchenScale === "full_gut") {
    mid = Math.round(mid * 1.06);
    high = Math.round(high * 1.1);
  }
  if (kitchenScale === "refresh") {
    high = Math.round(high * 0.92);
    mid = Math.round(mid * 0.9);
  }
  if (layoutCx === "major") {
    mid = Math.round(mid * 1.07);
    high = Math.round(high * 1.12);
  } else if (layoutCx === "minor") {
    mid = Math.round(mid * 1.03);
    high = Math.round(high * 1.05);
  }
  if (Array.isArray(multi)) {
    if (multi.includes("cabinets") && multi.includes("layout")) {
      mid = Math.round(mid * 1.04);
      high = Math.round(high * 1.06);
    }
    if (multi.includes("plumbing") || multi.includes("electrical")) {
      mid = Math.round(mid * 1.04);
      high = Math.round(high * 1.07);
    }
  }
  if (Array.isArray(kitchenConstraints)) {
    if (kitchenConstraints.includes("occupied")) {
      mid = Math.round(mid * 1.04);
      high = Math.round(high * 1.06);
    }
    if (kitchenConstraints.includes("structural") || kitchenConstraints.includes("permit_likely")) {
      mid = Math.round(mid * 1.03);
      high = Math.round(high * 1.06);
    }
  }
  if (Array.isArray(multi) && multi.includes("moisture")) {
    mid = Math.round(mid * 1.05);
    high = Math.round(high * 1.08);
  }
  return {
    ...base,
    projectType,
    projectLabel: getProjectType(projectType).label,
    scale,
    scaleLabel: getProjectType(projectType).scaleLabels[scale],
    low,
    mid,
    high,
    drivers,
    unitNote,
  };
}

export function encodeStudioQuery(
  studioSlug: string,
  answers: StudioAnswers
): string {
  const p = new URLSearchParams();
  p.set("studio", studioSlug);
  p.set("state", answers.state || "FL");
  if (answers.zip) p.set("zip", answers.zip);
  if (answers.city) p.set("city", answers.city);
  if (answers.budgetBand) p.set("budget", answers.budgetBand);
  if (answers.details?.trim()) p.set("details", answers.details.trim().slice(0, 400));
  // Flatten values
  for (const [k, v] of Object.entries(answers.values)) {
    if (Array.isArray(v)) p.set(`a_${k}`, v.join(","));
    else if (v) p.set(`a_${k}`, v);
  }
  return p.toString();
}

export function parseStudioQuery(
  studioSlug: string,
  searchParams: Record<string, string | string[] | undefined>
): StudioAnswers | null {
  const studio = getStudioBySlug(studioSlug);
  if (!studio) return null;
  const get = (k: string) => {
    const v = searchParams[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const values: Record<string, string | string[]> = {};
  for (const step of studio.steps) {
    for (const field of step.fields) {
      const raw = get(`a_${field.id}`);
      if (!raw) continue;
      if (field.type === "multi") {
        values[field.id] = raw.split(",").map((s) => s.trim()).filter(Boolean);
      } else {
        values[field.id] = raw;
      }
    }
  }
  // Require first required fields roughly present
  const hasAny = Object.keys(values).length > 0;
  if (!hasAny) return null;
  return {
    studioSlug,
    projectType: studio.projectType,
    values,
    budgetBand: (get("budget") as BudgetBand) || null,
    zip: get("zip") || undefined,
    city: get("city") || undefined,
    state: get("state") || "FL",
    details: get("details") || undefined,
  };
}

export function storageKey(studioSlug: string) {
  return `cth-studio-${studioSlug}`;
}
