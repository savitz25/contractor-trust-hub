import { FLORIDA_COUNTIES } from "./counties";
import { FLORIDA_TRADES } from "./trades";
import type { CountyDef, DiscoveryStateConfig, TradeDef } from "./types";

/**
 * Discovery registry keyed by public URL slug.
 * Add New Jersey (etc.) here without changing route component shapes.
 */
export const DISCOVERY_STATES: Record<string, DiscoveryStateConfig> = {
  florida: {
    publicSlug: "florida",
    evidenceSlug: "fl",
    name: "Florida",
    shortName: "FL",
    blurb:
      "Browse Florida construction license evidence by county and trade. Independent verification from DBPR and high-confidence Sunbiz links — not a marketplace or lead board.",
    counties: FLORIDA_COUNTIES,
    trades: FLORIDA_TRADES,
    live: true,
  },
  // Wave 2 example (not live):
  // "new-jersey": { publicSlug: "new-jersey", evidenceSlug: "nj", ... live: false }
};

export function getDiscoveryState(publicSlug: string): DiscoveryStateConfig | null {
  const s = DISCOVERY_STATES[publicSlug.toLowerCase()];
  return s?.live ? s : null;
}

export function getLiveDiscoveryStates(): DiscoveryStateConfig[] {
  return Object.values(DISCOVERY_STATES).filter((s) => s.live);
}

export function getCounty(
  state: DiscoveryStateConfig,
  countySlug: string
): CountyDef | null {
  return state.counties.find((c) => c.slug === countySlug.toLowerCase()) ?? null;
}

export function getTrade(state: DiscoveryStateConfig, tradeSlug: string): TradeDef | null {
  return state.trades.find((t) => t.slug === tradeSlug.toLowerCase()) ?? null;
}

/** Resolve a single path segment under /{state}/ as county or trade. */
export function resolveDiscoverySegment(
  state: DiscoveryStateConfig,
  segment: string
): { kind: "county"; county: CountyDef } | { kind: "trade"; trade: TradeDef } | null {
  const county = getCounty(state, segment);
  if (county) return { kind: "county", county };
  const trade = getTrade(state, segment);
  if (trade) return { kind: "trade", trade };
  return null;
}

export function discoveryPath(
  state: DiscoveryStateConfig,
  parts?: { countySlug?: string; tradeSlug?: string }
): string {
  const base = `/${state.publicSlug}`;
  if (parts?.countySlug && parts?.tradeSlug) {
    return `${base}/${parts.countySlug}/${parts.tradeSlug}`;
  }
  if (parts?.countySlug) return `${base}/${parts.countySlug}`;
  if (parts?.tradeSlug) return `${base}/${parts.tradeSlug}`;
  return base;
}
