/**
 * Studio → Trust Report context handoff (query params + session storage).
 */

export type StudioHandoff = {
  studioSlug: string;
  studioName: string;
  answerSummary: string[];
  resultsPath: string;
  projectType?: string;
  scaleLabel?: string;
  locationLabel?: string;
};

/** Query helpers for decision-tool deep links from a Trust Report. */
export function toolsQueryFromHandoff(
  contractor: { slug: string; name: string },
  handoff?: StudioHandoff | null
): string {
  const p = new URLSearchParams();
  p.set("name", contractor.name);
  p.set("contractor", contractor.slug);
  if (handoff?.projectType) p.set("type", handoff.projectType);
  if (handoff?.locationLabel) {
    const zip = handoff.locationLabel.match(/\b\d{5}\b/);
    if (zip) p.set("zip", zip[0]);
  }
  return p.toString();
}

const STORAGE_KEY = "cth-studio-handoff";

export function handoffStorageKey() {
  return STORAGE_KEY;
}

/** Build query string to attach to contractor profile links. */
export function encodeHandoffQuery(h: StudioHandoff): string {
  const p = new URLSearchParams();
  p.set("from", "studio");
  p.set("studio", h.studioSlug);
  p.set("studioName", h.studioName.slice(0, 80));
  p.set("back", h.resultsPath.slice(0, 1500));
  if (h.scaleLabel) p.set("scale", h.scaleLabel.slice(0, 80));
  if (h.locationLabel) p.set("loc", h.locationLabel.slice(0, 120));
  if (h.projectType) p.set("ptype", h.projectType.slice(0, 40));
  // Compact summary as pipe-separated (first 3 lines)
  const sum = h.answerSummary.slice(0, 3).join(" | ").slice(0, 280);
  if (sum) p.set("summary", sum);
  return p.toString();
}

export function parseHandoffQuery(
  searchParams: Record<string, string | string[] | undefined>
): StudioHandoff | null {
  const get = (k: string) => {
    const v = searchParams[k];
    return Array.isArray(v) ? v[0] : v;
  };
  if (get("from") !== "studio") return null;
  const studioSlug = get("studio");
  if (!studioSlug) return null;
  const summaryRaw = get("summary") || "";
  return {
    studioSlug,
    studioName: get("studioName") || "Project Studio",
    answerSummary: summaryRaw
      ? summaryRaw.split(" | ").map((s) => s.trim()).filter(Boolean)
      : [],
    resultsPath: get("back") || `/studios/${studioSlug}`,
    scaleLabel: get("scale") || undefined,
    locationLabel: get("loc") || undefined,
    projectType: get("ptype") || undefined,
  };
}

export function saveHandoffClient(h: StudioHandoff) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(h));
  } catch {
    /* ignore */
  }
}

export function loadHandoffClient(): StudioHandoff | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StudioHandoff;
  } catch {
    return null;
  }
}

export function contractorProfileHref(slug: string, handoff: StudioHandoff): string {
  return `/contractors/${encodeURIComponent(slug)}?${encodeHandoffQuery(handoff)}`;
}
