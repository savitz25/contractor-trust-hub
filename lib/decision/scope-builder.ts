import { getProjectType } from "@/lib/plan/project-types";
import type { ProjectTypeId, ScaleBand } from "@/lib/plan/types";
import type { ProjectScope, ScopeLineItem } from "./types";
import { scopeTemplateFor } from "./scope-templates";

export type ScopeBuilderInput = {
  projectType: ProjectTypeId;
  scale?: ScaleBand;
  zip?: string;
  city?: string;
  state?: string;
  budgetBand?: string | null;
  details?: string;
  studioSlug?: string;
  /** Labels from studio answer summary or freeform work items */
  includedLabels?: string[];
  excludedLabels?: string[];
  unknownLabels?: string[];
  assumptions?: string[];
  sourceNotes?: string[];
  titleOverride?: string;
};

function uid(): string {
  return `scope_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function locationLabel(input: ScopeBuilderInput): string {
  const parts = [input.city, input.zip, (input.state || "FL").toUpperCase()].filter(Boolean);
  return parts.join(", ") || "Florida (location TBD)";
}

function line(id: string, label: string, status: ScopeLineItem["status"], note?: string): ScopeLineItem {
  return { id, label, status, note };
}

/**
 * Build a contractor-ready scope summary from plan/studio context + refinements.
 * Does not invent technical specs beyond provided labels and templates.
 */
export function buildProjectScope(input: ScopeBuilderInput): ProjectScope {
  const def = getProjectType(input.projectType);
  const scale = input.scale || "medium";
  const template = scopeTemplateFor(input.projectType);

  const includedSet = new Set(
    (input.includedLabels || []).map((s) => s.trim().toLowerCase()).filter(Boolean)
  );
  const excludedSet = new Set(
    (input.excludedLabels || []).map((s) => s.trim().toLowerCase()).filter(Boolean)
  );
  const unknownSet = new Set(
    (input.unknownLabels || []).map((s) => s.trim().toLowerCase()).filter(Boolean)
  );

  const included: ScopeLineItem[] = [];
  const excluded: ScopeLineItem[] = [];
  const unknowns: ScopeLineItem[] = [];

  // User-provided freeform first
  for (const label of input.includedLabels || []) {
    const t = label.trim();
    if (t) included.push(line(`inc_${included.length}`, t, "included"));
  }
  for (const label of input.excludedLabels || []) {
    const t = label.trim();
    if (t) excluded.push(line(`exc_${excluded.length}`, t, "excluded"));
  }
  for (const label of input.unknownLabels || []) {
    const t = label.trim();
    if (t) unknowns.push(line(`unk_${unknowns.length}`, t, "unknown"));
  }

  // Template items not already covered → unknowns (not invented as included)
  for (const t of template) {
    const key = t.label.toLowerCase();
    const already =
      includedSet.has(key) ||
      excludedSet.has(key) ||
      unknownSet.has(key) ||
      included.some((i) => i.label.toLowerCase().includes(key.slice(0, 12))) ||
      excluded.some((i) => i.label.toLowerCase().includes(key.slice(0, 12)));
    if (already) continue;
    // Mark as worth confirming — not assumed in or out
    unknowns.push(
      line(t.id, t.label, "unknown", "Not confirmed in your answers — clarify with bidders")
    );
  }

  const assumptions = [
    ...(input.assumptions || []),
    "Bidders should price the same written scope; note any substitutions in writing.",
    "Allowances must list amount, unit, and what is excluded from the allowance.",
    "Permit responsibility and inspection coordination should be stated explicitly.",
  ];

  if (input.details?.trim()) {
    assumptions.unshift(`Owner notes: ${input.details.trim().slice(0, 400)}`);
  }

  return {
    id: uid(),
    title: input.titleOverride || `${def.label} — Florida project scope`,
    projectType: input.projectType,
    projectLabel: def.label,
    locationLabel: locationLabel(input),
    state: (input.state || "FL").toUpperCase(),
    zip: input.zip,
    city: input.city,
    scale,
    scaleLabel: def.scaleLabels[scale],
    included,
    excluded,
    unknowns: unknowns.slice(0, 18),
    assumptions,
    bidderNotes:
      "Please price this same scope. List exclusions and allowances separately. Do not assume owner-furnished items unless listed. If something is unclear, ask before bidding.",
    sourceNotes: input.sourceNotes || [],
    generatedAt: new Date().toISOString(),
    studioSlug: input.studioSlug,
    budgetBand: input.budgetBand,
    details: input.details,
  };
}

export function scopeToPlainText(scope: ProjectScope): string {
  const lines: string[] = [
    scope.title,
    `Generated: ${new Date(scope.generatedAt).toLocaleString()}`,
    `Project type: ${scope.projectLabel}`,
    `Scale: ${scope.scaleLabel}`,
    `Location: ${scope.locationLabel}`,
    "",
    "INCLUDED",
    ...(scope.included.length
      ? scope.included.map((i) => `• ${i.label}`)
      : ["• (none listed yet — refine scope)"]),
    "",
    "EXCLUDED / NOT IN SCOPE",
    ...(scope.excluded.length
      ? scope.excluded.map((i) => `• ${i.label}`)
      : ["• (none listed)"]),
    "",
    "UNKNOWN / NOT DECIDED",
    ...(scope.unknowns.length
      ? scope.unknowns.map((i) => `• ${i.label}${i.note ? ` — ${i.note}` : ""}`)
      : ["• (none)"]),
    "",
    "ASSUMPTIONS",
    ...scope.assumptions.map((a) => `• ${a}`),
    "",
    "NOTES FOR BIDDERS",
    scope.bidderNotes,
    "",
    "Contractor Trust Hub — educational scope worksheet. Not a contract.",
  ];
  return lines.join("\n");
}

export function parseCsvLines(text: string): string[] {
  return text
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
