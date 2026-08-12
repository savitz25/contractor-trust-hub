import type { PropertyContext, PropertyResearchResult } from "./types";

export const PROPERTY_CONTEXT_KEY = "cth-property-context";

export function propertyContextFromResult(
  r: PropertyResearchResult
): PropertyContext | null {
  if (!r.propertyId || r.resolveStatus === "unresolved") return null;
  return {
    propertyId: r.propertyId,
    normalizedAddress: r.normalizedAddress,
    zip: r.zip,
    city: r.city,
    county: r.county,
    countySlug: r.countySlug,
    coverage: r.coverage,
    savedAt: new Date().toISOString(),
  };
}

export function savePropertyContext(ctx: PropertyContext): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PROPERTY_CONTEXT_KEY, JSON.stringify(ctx));
    window.dispatchEvent(new CustomEvent("cth-property-change", { detail: ctx }));
  } catch {
    /* ignore */
  }
}

export function loadPropertyContext(): PropertyContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PROPERTY_CONTEXT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PropertyContext;
  } catch {
    return null;
  }
}

export function clearPropertyContext(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(PROPERTY_CONTEXT_KEY);
    window.dispatchEvent(new CustomEvent("cth-property-change", { detail: null }));
  } catch {
    /* ignore */
  }
}

export function propertyResultHref(r: PropertyResearchResult): string {
  if (r.propertyId) return `/property/${encodeURIComponent(r.propertyId)}?city=${encodeURIComponent(r.city || "")}`;
  const p = new URLSearchParams();
  p.set("street", r.street);
  p.set("zip", r.zip);
  if (r.city) p.set("city", r.city);
  if (r.unit) p.set("unit", r.unit);
  return `/property/results?${p.toString()}`;
}

export function planWithPropertyHref(ctx: PropertyContext): string {
  const p = new URLSearchParams();
  p.set("zip", ctx.zip);
  if (ctx.city) p.set("city", ctx.city);
  p.set("from", "property");
  p.set("property", ctx.propertyId);
  return `/plan?${p.toString()}`;
}

export function permitPlannerHref(ctx: Partial<PropertyContext> & { zip?: string }): string {
  const p = new URLSearchParams();
  if (ctx.zip) p.set("zip", ctx.zip);
  if (ctx.city) p.set("city", ctx.city);
  if (ctx.county) p.set("county", ctx.county);
  return `/tools/permit-planner?${p.toString()}`;
}
