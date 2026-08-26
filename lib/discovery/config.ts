import { AZ_COUNTIES, AZ_GEO_NOTE, AZ_MAJOR_CITIES, getAzGeo } from "@/lib/arizona/geos";
import { ARIZONA_TRADES } from "@/lib/arizona/trades";
import { OREGON_COUNTIES, OREGON_GEO_NOTE } from "@/lib/oregon/counties";
import { OREGON_TRADES } from "@/lib/oregon/trades";
import { getWaGeo, WA_COUNTIES, WA_GEO_NOTE, WA_MAJOR_CITIES } from "@/lib/washington/geos";
import { WASHINGTON_TRADES } from "@/lib/washington/trades";
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
      "Research Florida construction license evidence by county and trade. Independent verification from DBPR public records — not a marketplace, ranking, or lead board.",
    counties: FLORIDA_COUNTIES,
    trades: FLORIDA_TRADES,
    live: true,
    geoNote:
      "County pages use the license mailing/principal county (headquarters/base). That is not evidence of operating in the county. Statewide totals are not the sum of county operating totals.",
  },
  /**
   * Texas discovery browse is not live until TDLR specialty data is loaded and
   * county/trade facets are defined honestly (no statewide GC browse).
   * publicSlug reserved: /texas
   */
  // texas: {
  //   publicSlug: "texas",
  //   evidenceSlug: "tx",
  //   name: "Texas",
  //   shortName: "TX",
  //   blurb:
  //     "TDLR specialty trade licenses only — Texas has no statewide general contractor license.",
  //   counties: [],
  //   trades: [],
  //   live: false,
  // },
  arizona: {
    publicSlug: "arizona",
    evidenceSlug: "az",
    name: "Arizona",
    shortName: "AZ",
    blurb:
      "Browse Arizona ROC current contractor licenses by county, major city, trade, or project type. Official posting list plus linked disciplinary rows when present — not a marketplace or ranking.",
    counties: AZ_COUNTIES,
    cities: AZ_MAJOR_CITIES,
    trades: ARIZONA_TRADES,
    live: true,
    geoNote: AZ_GEO_NOTE,
    activeOnlyDefault: true,
  },
  oregon: {
    publicSlug: "oregon",
    evidenceSlug: "or",
    name: "Oregon",
    shortName: "OR",
    blurb:
      "Browse Oregon CCB active contractor licenses by official county and endorsement family. Bond and insurance fields are as published — not a live certificate check.",
    counties: OREGON_COUNTIES,
    trades: OREGON_TRADES,
    live: true,
    geoNote: OREGON_GEO_NOTE,
    activeOnlyDefault: true,
    requireInStateAddress: false,
  },
  washington: {
    publicSlug: "washington",
    evidenceSlug: "wa",
    name: "Washington",
    shortName: "WA",
    blurb:
      "Browse Washington L&I contractor licenses by city, derived county, license type, or project. Official contractor-license extract — not a marketplace or ranking.",
    counties: WA_COUNTIES,
    cities: WA_MAJOR_CITIES,
    trades: WASHINGTON_TRADES,
    live: true,
    geoNote: WA_GEO_NOTE,
    activeOnlyDefault: true,
  },
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
  const key = countySlug.toLowerCase();
  return (
    state.counties.find((c) => c.slug === key) ??
    state.cities?.find((c) => c.slug === key) ??
    (state.publicSlug === "arizona" ? getAzGeo(key) : null) ??
    (state.publicSlug === "washington" ? getWaGeo(key) : null)
  );
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
  parts?: { countySlug?: string; tradeSlug?: string; citySlug?: string }
): string {
  const base = `/${state.publicSlug}`;
  if (parts?.countySlug && parts?.citySlug && parts?.tradeSlug) {
    return `${base}/${parts.countySlug}/${parts.citySlug}/${parts.tradeSlug}`;
  }
  if (parts?.countySlug && parts?.tradeSlug) {
    return `${base}/${parts.countySlug}/${parts.tradeSlug}`;
  }
  if (parts?.countySlug) return `${base}/${parts.countySlug}`;
  if (parts?.tradeSlug) return `${base}/${parts.tradeSlug}`;
  return base;
}
