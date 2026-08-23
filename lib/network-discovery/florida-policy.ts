import type { AskContractorCategory, TradeReadiness } from "./trades";
import type { NetworkDiscoveryEntity } from "./types";

/**
 * Frozen Florida discovery policy for future Ask ingestion.
 * ASK-SEARCH-CONTRACTOR-001.1 — do not widen without a new amendment.
 */
export const FLORIDA_READY_CATEGORIES = [
  "roofing",
  "plumbing",
  "hvac",
  "pool",
  "general_contractor",
] as const satisfies readonly AskContractorCategory[];

export const FLORIDA_BROWSE_TRADE_SLUGS: Record<(typeof FLORIDA_READY_CATEGORIES)[number], string> = {
  roofing: "roofers",
  plumbing: "plumbing",
  hvac: "air-conditioning",
  pool: "pool-spa",
  general_contractor: "general-contractors",
};

export const FLORIDA_FEED_UNSUPPORTED = [
  "electrical",
  "solar",
  "painting",
  "flooring",
  "kitchen_remodeling",
  "bathroom_remodeling",
  "home_inspector",
] as const;

/** Occupation lock: accepted FL CILB codes only. CMC/CBC/CRC are not widened. */
export const FLORIDA_OCCUPATION_LOCK: Record<string, AskContractorCategory | null> = {
  CCC: "roofing",
  RR: "roofing",
  CFC: "plumbing",
  CAC: "hvac",
  CMC: null,
  CPC: "pool",
  CGC: "general_contractor",
  CBC: null,
  CRC: null,
};

export const FLORIDA_DISCOVERY_POLICY = {
  amendment: "ASK-SEARCH-CONTRACTOR-001.1",
  hub: "contractor",
  jurisdiction: "FL",
  readiness: "READY" as TradeReadiness,
  bounded: true,
  ready_categories: FLORIDA_READY_CATEGORIES,
  browse_template: "/florida/{county}/{trade}",
  browse_trade_slugs: FLORIDA_BROWSE_TRADE_SLUGS,
  service_geography: "UNSUPPORTED",
  canonical_profile: "https://www.contractortrusthub.com/contractors/{slug}",
  identity: "contractor:{contractors.id}",
} as const;

export const NEW_JERSEY_DISCOVERY_POLICY = {
  amendment: "ASK-SEARCH-CONTRACTOR-001.1",
  hub: "contractor",
  jurisdiction: "NJ",
  readiness: "SOFT" as TradeReadiness,
  county_browse: false,
  trades: {
    plumbing: "SOFT",
    hvac: "SOFT",
    electrical: "SOFT",
    general_contractor: "SOFT",
    roofing: "UNSUPPORTED",
  },
  recommended_ask_activation: "Florida bounded subset first",
} as const;

export const ALLOWED_MATCH_REASONS = [
  "trade_match",
  "exact_physical_city",
  "exact_physical_county",
  "physical_state",
  "license_state",
] as const;

export const FORBIDDEN_MATCH_REASONS = [
  "explicit_service_city",
  "explicit_service_county",
  "service_state",
] as const;

export function floridaBrowseTradeSlug(category: string): string | undefined {
  return FLORIDA_BROWSE_TRADE_SLUGS[category as (typeof FLORIDA_READY_CATEGORIES)[number]];
}

export function isFloridaReadyDiscovery(e: NetworkDiscoveryEntity): boolean {
  if (e.state !== "FL" || e.hub !== "contractor" || e.entity_type !== "contractor") return false;
  if (!e.canonical_profile_url.startsWith("https://www.contractortrusthub.com/contractors/")) {
    return false;
  }
  if (!e.city && !e.county) return false;
  const cats = e.categories || [];
  return cats.some((c) =>
    (FLORIDA_READY_CATEGORIES as readonly string[]).includes(c)
  );
}
