/**
 * Lightweight project context — Florida plan/studio depth first.
 * Client-only localStorage; not an account. Evidence research only.
 */

import {
  emptyJourney,
  JOURNEY_CONTEXT_KEY,
  loadJourneyContext,
  saveJourneyContext,
  type EntryPath,
  type JourneyContext,
} from "@/lib/funnel/journey-context";
import { loadJson, saveJson } from "@/lib/decision/session";

/** Canonical key (mirrors journey v2; journey store remains source of truth). */
export const PROJECT_CONTEXT_KEY = JOURNEY_CONTEXT_KEY;
export const PROJECT_CONTEXT_EVENT = "cth-journey-change";

/** Shortlist / compare tray (shared storage). */
export const SHORTLIST_STORAGE_KEY = "cth-compare-slugs";
/** Max finalists in shortlist → compare. */
export const MAX_SHORTLIST = 3;

export type ProjectContext = {
  version: 1 | 2;
  /** Plan depth is Florida-first; other states may be stored for verify handoff only. */
  state: string;
  projectType?: string | null;
  scale?: string | null;
  zip?: string | null;
  city?: string | null;
  county?: string | null;
  entryPath?: EntryPath;
  contractorSlug?: string | null;
  contractorName?: string | null;
  updatedAt: string;
};

export function emptyProjectContext(): ProjectContext {
  return {
    version: 2,
    state: "fl",
    updatedAt: new Date().toISOString(),
  };
}

export function loadProjectContext(): ProjectContext {
  const j = loadJourneyContext();
  return {
    version: 2,
    state: (j as JourneyContext & { state?: string }).state || "fl",
    projectType: j.projectType,
    scale: j.scale,
    zip: j.zip,
    city: j.city,
    county: (j as JourneyContext & { county?: string }).county,
    entryPath: j.entryPath,
    contractorSlug: j.contractorSlug,
    contractorName: j.contractorName,
    updatedAt: j.updatedAt,
  };
}

export type ProjectContextPatch = Partial<
  Omit<ProjectContext, "version" | "updatedAt">
>;

export function saveProjectContext(patch: ProjectContextPatch): ProjectContext {
  const next = saveJourneyContext({
    ...patch,
    state: patch.state ?? loadProjectContext().state ?? "fl",
    county: patch.county,
  } as Partial<JourneyContext> & { state?: string; county?: string });

  return {
    version: 2,
    state: (next as JourneyContext & { state?: string }).state || "fl",
    projectType: next.projectType,
    scale: next.scale,
    zip: next.zip,
    city: next.city,
    county: (next as JourneyContext & { county?: string }).county,
    entryPath: next.entryPath,
    contractorSlug: next.contractorSlug,
    contractorName: next.contractorName,
    updatedAt: next.updatedAt,
  };
}

export function clearProjectContext(): void {
  saveJson(PROJECT_CONTEXT_KEY, emptyJourney());
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(PROJECT_CONTEXT_EVENT, { detail: emptyProjectContext() })
    );
  }
}

export function hasProjectContext(ctx?: ProjectContext | null): boolean {
  const c = ctx ?? (typeof window !== "undefined" ? loadProjectContext() : null);
  if (!c) return false;
  return Boolean(
    c.projectType || c.zip || c.city || c.county || c.scale || c.contractorSlug
  );
}

/** Human-readable chips for sticky UI. */
export function projectContextSummary(ctx: ProjectContext): string[] {
  const bits: string[] = [];
  if (ctx.projectType) bits.push(ctx.projectType.replace(/_/g, " "));
  if (ctx.scale) bits.push(String(ctx.scale).replace(/_/g, " "));
  if (ctx.county) bits.push(`${ctx.county} County`);
  if (ctx.city) bits.push(ctx.city);
  if (ctx.zip) bits.push(ctx.zip);
  if (ctx.state && ctx.state.toLowerCase() !== "fl") {
    bits.push(ctx.state.toUpperCase());
  } else if (ctx.state) {
    bits.push("Florida");
  }
  return bits;
}

/** Map plan/studio project type → Florida discovery trade slug when known. */
export function discoveryTradeHint(projectType?: string | null): string | null {
  if (!projectType) return null;
  const t = projectType.toLowerCase();
  if (t.includes("roof")) return "roofers";
  if (t.includes("kitchen") || t.includes("bath") || t.includes("remodel")) {
    return "general-contractors";
  }
  if (t.includes("hvac") || t.includes("air") || t.includes("mechanical")) {
    return "air-conditioning";
  }
  if (t.includes("plumb")) return "plumbing";
  if (t.includes("electric")) return "electrical";
  if (t.includes("pool")) return "pool";
  return null;
}

export function floridaBrowseHrefFromContext(ctx?: ProjectContext | null): string {
  const c = ctx ?? loadProjectContext();
  const trade = discoveryTradeHint(c.projectType);
  if (trade) return `/florida/${trade}`;
  return "/florida";
}

/** Re-export empty journey for tests/docs. */
export { emptyJourney, loadJson };
