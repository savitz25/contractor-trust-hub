/**
 * Curated Florida city → county for Ask handoff.
 * Physical mapping only. Not a service-area graph. No geocoding.
 */

import { FLORIDA_COUNTIES } from "@/lib/discovery/counties";
import { cityToSlug } from "@/lib/discovery/browse";
import type { ContractorAskSearchContext } from "./allowlist";

export type ContractorGeoMatchClass =
  | "exact_physical_city"
  | "exact_physical_county"
  | "physical_state"
  | "license_state";

export type ResolvedContractorGeography = {
  state: "FL";
  countySlug: string;
  countyName: string;
  city?: string;
  citySlug?: string;
  /** City was requested; landing is county browse, not fabricated exact-city coverage. */
  cityCoveredByCountyOnly: boolean;
  matchClass: ContractorGeoMatchClass;
};

const COUNTY_BY_SLUG = new Map(FLORIDA_COUNTIES.map((c) => [c.slug, c]));

const COUNTY_ALIASES: Record<string, string> = {};
for (const c of FLORIDA_COUNTIES) {
  COUNTY_ALIASES[c.slug] = c.slug;
  COUNTY_ALIASES[cityToSlug(c.name)] = c.slug;
  for (const n of c.matchNames) COUNTY_ALIASES[cityToSlug(n)] = c.slug;
}

/** Curated major-city → existing Florida county slug. Fail closed if missing. */
export const FLORIDA_CITY_TO_COUNTY: Record<string, string> = {
  miami: "miami-dade",
  "miami-beach": "miami-dade",
  "miami-springs": "miami-dade",
  hialeah: "miami-dade",
  "coral-gables": "miami-dade",
  homestead: "miami-dade",
  doral: "miami-dade",
  kendall: "miami-dade",
  tampa: "hillsborough",
  brandon: "hillsborough",
  orlando: "orange",
  "winter-park": "orange",
  jacksonville: "duval",
  "fort-lauderdale": "broward",
  hollywood: "broward",
  pembroke: "broward",
  "pembroke-pines": "broward",
  sunrise: "broward",
  "west-palm-beach": "palm-beach",
  "palm-beach": "palm-beach",
  "boca-raton": "palm-beach",
  "delray-beach": "palm-beach",
  "st-petersburg": "pinellas",
  clearwater: "pinellas",
  naples: "collier",
  "fort-myers": "lee",
  "cape-coral": "lee",
  sarasota: "sarasota",
  bradenton: "manatee",
  lakeland: "polk",
  kissimmee: "osceola",
  "daytona-beach": "volusia",
  melbourne: "brevard",
  ocala: "marion",
  tallahassee: "leon",
  gainesville: "alachua",
  pensacola: "escambia",
};

export function resolveFloridaCountySlug(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const slug = cityToSlug(raw.replace(/\s+county$/i, ""));
  const mapped = COUNTY_ALIASES[slug];
  return mapped && COUNTY_BY_SLUG.has(mapped) ? mapped : undefined;
}

export function resolveFloridaCityCounty(city: string | undefined): string | undefined {
  if (!city) return undefined;
  const slug = cityToSlug(city);
  const county = FLORIDA_CITY_TO_COUNTY[slug];
  return county && COUNTY_BY_SLUG.has(county) ? county : undefined;
}

export function resolveContractorHandoffGeography(
  ctx: ContractorAskSearchContext
): ResolvedContractorGeography | null {
  const state = ctx.state;
  if (state && state !== "FL") return null;

  const countyFromParam = resolveFloridaCountySlug(ctx.county);
  const countyFromCity = resolveFloridaCityCounty(ctx.city);
  const countySlug = countyFromParam || countyFromCity;
  if (!countySlug) {
    if (state === "FL" || (!state && (ctx.county || ctx.city))) return null;
    return null;
  }
  const county = COUNTY_BY_SLUG.get(countySlug);
  if (!county) return null;

  const citySlug = ctx.city ? cityToSlug(ctx.city) : undefined;
  const cityKnown = Boolean(citySlug && FLORIDA_CITY_TO_COUNTY[citySlug] === countySlug);
  const cityCoveredByCountyOnly = Boolean(ctx.city);

  return {
    state: "FL",
    countySlug,
    countyName: county.name,
    city: ctx.city,
    citySlug: cityKnown ? citySlug : undefined,
    cityCoveredByCountyOnly,
    matchClass: cityCoveredByCountyOnly ? "exact_physical_county" : "exact_physical_county",
  };
}
