/**
 * Florida journey context — persists contractor/project/scope across tools.
 * Client-only localStorage; not a durable account store.
 */

import { loadJson, saveJson } from "@/lib/decision/session";

export const JOURNEY_CONTEXT_KEY = "cth-journey-context-v1";

export type EntryPath = "plan" | "verify" | "property" | "studio" | "tools" | "unknown";

export type JourneyContext = {
  version: 1;
  entryPath?: EntryPath;
  projectType?: string | null;
  scale?: string | null;
  zip?: string | null;
  city?: string | null;
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
  return { version: 1, updatedAt: new Date().toISOString() };
}

export function loadJourneyContext(): JourneyContext {
  const j = loadJson<JourneyContext>(JOURNEY_CONTEXT_KEY);
  if (!j || j.version !== 1) return emptyJourney();
  return j;
}

export function saveJourneyContext(patch: Partial<JourneyContext>): JourneyContext {
  const prev = loadJourneyContext();
  const next: JourneyContext = {
    ...prev,
    ...patch,
    version: 1,
    updatedAt: new Date().toISOString(),
  };
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
  put("contractor", extra.contractor ?? j.contractorSlug);
  put("name", extra.name ?? j.contractorName);
  put("project", extra.project ?? j.projectId);
  put("from", extra.from ?? undefined);
  for (const [k, v] of Object.entries(extra)) {
    if (["type", "scale", "zip", "city", "contractor", "name", "project", "from"].includes(k))
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
