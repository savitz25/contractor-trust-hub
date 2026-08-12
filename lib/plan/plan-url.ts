import { getProjectType } from "./project-types";
import type { PlanInput, ProjectTypeId, ScaleBand } from "./types";
import { formatLocationLabel } from "./location";

export function encodePlanQuery(input: PlanInput): string {
  const p = new URLSearchParams();
  p.set("type", input.projectType);
  p.set("scale", input.scale);
  p.set("state", input.state || "FL");
  if (input.zip) p.set("zip", input.zip);
  if (input.city) p.set("city", input.city);
  if (input.county) p.set("county", input.county);
  if (input.budgetBand) p.set("budget", input.budgetBand);
  if (input.details?.trim()) p.set("details", input.details.trim().slice(0, 500));
  return p.toString();
}

export function parsePlanQuery(
  searchParams: Record<string, string | string[] | undefined>
): PlanInput | null {
  const get = (k: string) => {
    const v = searchParams[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const type = get("type") as ProjectTypeId | undefined;
  const scale = (get("scale") || "medium") as ScaleBand;
  if (!type) return null;
  try {
    getProjectType(type);
  } catch {
    return null;
  }
  return {
    projectType: type,
    scale: ["small", "medium", "large"].includes(scale) ? scale : "medium",
    state: (get("state") || "FL").toUpperCase(),
    zip: get("zip") || undefined,
    city: get("city") || undefined,
    county: get("county") || undefined,
    budgetBand: (get("budget") as PlanInput["budgetBand"]) || null,
    details: get("details") || undefined,
  };
}

export function summarizePlan(input: PlanInput): {
  projectLabel: string;
  scaleLabel: string;
  locationLabel: string;
} {
  const def = getProjectType(input.projectType);
  return {
    projectLabel: def.label,
    scaleLabel: def.scaleLabels[input.scale as ScaleBand],
    locationLabel: formatLocationLabel(input),
  };
}
