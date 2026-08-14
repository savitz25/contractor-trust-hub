import { azGeoEmptyBody } from "@/lib/arizona/geo-copy";
import type { CountyDef, TradeDef } from "@/lib/discovery/types";

export function azGeoLabel(geo: CountyDef): string {
  return geo.kind === "city" ? geo.name : `${geo.name} County`;
}

export { azGeoEmptyBody };

export function azListVerifyHref(): string {
  return "/verify?state=az";
}

export function azContractorHref(slug: string, projectSlug?: string): string {
  const base = `/contractors/${encodeURIComponent(slug)}`;
  if (!projectSlug) return base;
  return `${base}?project=${encodeURIComponent(projectSlug)}`;
}

export function azTradeAsFilter(trade: TradeDef): TradeDef {
  return {
    ...trade,
    occupationCodes: trade.occupationCodes.map((c) => c.toUpperCase()),
  };
}
