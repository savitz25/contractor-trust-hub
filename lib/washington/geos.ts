import type { CountyDef } from "@/lib/discovery/types";
import { zipsForCounty } from "./zip-counties";

/**
 * Washington geo layer.
 *
 * L&I is strong on city and ZIP and does not publish an official county field
 * on the general contractor-license extract. County browse is derived from a
 * maintained ZIP5 → county map. City pages match mailing city only.
 */

export type WaGeoDef = CountyDef & {
  kind: "county" | "city";
};

function cityGeo(slug: string, name: string, cities: string[]): WaGeoDef {
  return {
    slug,
    name,
    kind: "city",
    matchNames: [],
    matchCities: cities,
    matchStates: ["WA"],
  };
}

function countyGeo(slug: string, name: string): WaGeoDef {
  return {
    slug,
    name,
    kind: "county",
    matchNames: [],
    matchPostalPrefixes: zipsForCounty(name),
  };
}

export const WA_COUNTIES: WaGeoDef[] = [
  countyGeo("king", "King"),
  countyGeo("pierce", "Pierce"),
  countyGeo("snohomish", "Snohomish"),
  countyGeo("spokane-county", "Spokane"),
  countyGeo("clark", "Clark"),
  countyGeo("kitsap", "Kitsap"),
  countyGeo("whatcom", "Whatcom"),
  countyGeo("thurston", "Thurston"),
  countyGeo("benton", "Benton"),
  countyGeo("yakima", "Yakima"),
  {
    slug: "out-of-state",
    name: "Out of state (mailing address)",
    kind: "county",
    matchNames: [],
    matchOutOfStateMailing: true,
  },
];

/** Major-city browse — dedicated pages, not a substitute for county. */
export const WA_MAJOR_CITIES: WaGeoDef[] = [
  cityGeo("seattle", "Seattle", ["seattle"]),
  cityGeo("vancouver", "Vancouver", ["vancouver"]),
  cityGeo("spokane", "Spokane", ["spokane"]),
  cityGeo("tacoma", "Tacoma", ["tacoma"]),
  cityGeo("everett", "Everett", ["everett"]),
  cityGeo("auburn", "Auburn", ["auburn"]),
  cityGeo("kent", "Kent", ["kent"]),
  cityGeo("renton", "Renton", ["renton"]),
  cityGeo("puyallup", "Puyallup", ["puyallup"]),
  cityGeo("lynnwood", "Lynnwood", ["lynnwood"]),
  cityGeo("bellingham", "Bellingham", ["bellingham"]),
  cityGeo("olympia", "Olympia", ["olympia"]),
  cityGeo("federal-way", "Federal Way", ["federal way"]),
  cityGeo("bellevue", "Bellevue", ["bellevue"]),
  cityGeo("kennewick", "Kennewick", ["kennewick"]),
  cityGeo("bothell", "Bothell", ["bothell"]),
  cityGeo("yakima-city", "Yakima", ["yakima"]),
  cityGeo("kirkland", "Kirkland", ["kirkland"]),
  cityGeo("spokane-valley", "Spokane Valley", ["spokane valley"]),
  cityGeo("redmond", "Redmond", ["redmond"]),
];

export const WA_GEO_NOTE =
  "County is derived from five-digit mailing ZIP, not an official L&I county field. City pages match mailing city + Washington. Multi-county ZIPs use the majority county. Mailing address is not the jobsite.";

export function allWaGeos(): WaGeoDef[] {
  return [...WA_COUNTIES, ...WA_MAJOR_CITIES];
}

export function getWaGeo(slug: string): WaGeoDef | null {
  const key = slug.toLowerCase();
  return allWaGeos().find((g) => g.slug === key) ?? null;
}
