/**
 * Florida journey / project context — persists across Plan, Studios, Verify, Compare.
 * Client-only localStorage; not a durable account store.
 * See docs/PROJECT_CONTEXT.md
 */

import { loadJson, saveJson } from "@/lib/decision/session";

export const JOURNEY_CONTEXT_KEY = "cth-journey-context-v1";

export type EntryPath =
  | "plan"
  | "verify"
  | "property"
  | "studio"
  | "tools"
  | "discovery"
  | "unknown";

export type JourneyContext = {
  /** v1 and v2 both accepted; writes are always v2. */
  version: 1 | 2;
  /** Plan depth is Florida-first (default fl). */
  state?: string | null;
  entryPath?: EntryPath;
  projectType?: string | null;
  scale?: string | null;
  zip?: string | null;
  city?: string | null;
  county?: string | null;
  contractorSlug?: string | null;
  contractorName?: string | null;
  projectId?: string | null;
  propertyId?: string | null;
  hasScope?: boolean;
  hasQuoteAnalysis?: boolean;
  hasCompare?: boolean;
  updatedAt: string;
};

export function emptyJourney(): JourneyContext {
  return {
    version: 2,
    state: "fl",
    updatedAt: new Date().toISOString(),
  };
}

export function loadJourneyContext(): JourneyContext {
  const j = loadJson<JourneyContext>(JOURNEY_CONTEXT_KEY);
  if (!j || (j.version !== 1 && j.version !== 2)) return emptyJourney();
  return {
    ...emptyJourney(),
    ...j,
    version: 2,
    state: j.state || "fl",
  };
}

export function saveJourneyContext(patch: Partial<JourneyContext>): JourneyContext {
  const prev = loadJourneyContext();
  const next: JourneyContext = {
    ...prev,
    ...patch,
    version: 2,
    state: patch.state ?? prev.state ?? "fl",
    updatedAt: new Date().toISOString(),
  };
  saveJson(JOURNEY_CONTEXT_KEY, next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("cth-journey-change", { detail: next }));
  }
  return next;
}

export function clearJourneyContext(): JourneyContext {
  const next = emptyJourney();
  saveJson(JOURNEY_CONTEXT_KEY, next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("cth-journey-change", { detail: next }));
  }
  return next;
}

/** Build query string preserving journey context for tool handoffs */
export function journeyQuery(extra: Record<string, string | null | undefined> = {}): string {
  const j = typeof window !== "undefined" ? loadJourneyContext() : emptyJourney();
  const p = new URLSearchParams();
  const put = (k: string, v?: string | null) => {
    if (v) p.set(k, v);
  };
  put("type", extra.type ?? j.projectType);
  put("scale", extra.scale ?? j.scale);
  put("zip", extra.zip ?? j.zip);
  put("city", extra.city ?? j.city);
  put("county", extra.county ?? j.county);
  put("state", extra.state ?? j.state ?? "fl");
  put("contractor", extra.contractor ?? j.contractorSlug);
  put("name", extra.name ?? j.contractorName);
  put("project", extra.project ?? j.projectId);
  put("from", extra.from ?? undefined);
  for (const [k, v] of Object.entries(extra)) {
    if (
      [
        "type",
        "scale",
        "zip",
        "city",
        "county",
        "state",
        "contractor",
        "name",
        "project",
        "from",
      ].includes(k)
    )
      continue;
    put(k, v);
  }
  const s = p.toString();
  return s;
}

export function toolHref(
  path: string,
  extra: Record<string, string | null | undefined> = {}
): string {
  const q = journeyQuery(extra);
  return q ? `${path}?${q}` : path;
}
