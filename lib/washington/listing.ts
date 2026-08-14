import { waGeoEmptyBody, waGeoLabel } from "@/lib/washington/geo-copy";
import type { TradeDef } from "@/lib/discovery/types";

export { waGeoEmptyBody, waGeoLabel };

export function waListVerifyHref(): string {
  return "/verify?state=wa";
}

export function waContractorHref(slug: string, projectSlug?: string): string {
  const base = `/contractors/${encodeURIComponent(slug)}`;
  if (!projectSlug) return base;
  return `${base}?project=${encodeURIComponent(projectSlug)}`;
}

export function waTradeAsFilter(trade: TradeDef): TradeDef {
  return {
    ...trade,
    occupationCodes: trade.occupationCodes.map((c) => c.toUpperCase()),
    classCodes: trade.classCodes?.map((c) => c.toUpperCase()),
  };
}
