import type { CountyDef } from "@/lib/discovery/types";

/**
 * Arizona geo layer.
 *
 * The ROC posting list has city (and ZIP) but almost never county.
 * County browse is derived from a maintained city → county map of cities
 * that actually appear on the extract. This is not an official ROC county field.
 *
 * City of Maricopa and San Tan Valley are Pinal, not Maricopa County.
 */

export type AzGeoDef = CountyDef & {
  kind: "county" | "city";
};

function cityGeo(
  slug: string,
  name: string,
  cities: string[],
  countyName: string
): AzGeoDef {
  return {
    slug,
    name,
    kind: "city",
    matchNames: [countyName],
    matchCities: cities,
  };
}

function countyGeo(slug: string, name: string, cities: string[]): AzGeoDef {
  return {
    slug,
    name,
    kind: "county",
    matchNames: [name],
    matchCities: cities,
  };
}

/** Cities observed on the ROC extract, assigned to a county. */
export const AZ_CITY_TO_COUNTY: Record<string, string> = {
  // Maricopa
  phoenix: "Maricopa",
  mesa: "Maricopa",
  scottsdale: "Maricopa",
  glendale: "Maricopa",
  gilbert: "Maricopa",
  chandler: "Maricopa",
  peoria: "Maricopa",
  tempe: "Maricopa",
  "queen creek": "Maricopa",
  surprise: "Maricopa",
  buckeye: "Maricopa",
  goodyear: "Maricopa",
  avondale: "Maricopa",
  "cave creek": "Maricopa",
  "litchfield park": "Maricopa",
  laveen: "Maricopa",
  tolleson: "Maricopa",
  "fountain hills": "Maricopa",
  waddell: "Maricopa",
  "el mirage": "Maricopa",
  "paradise valley": "Maricopa",
  "sun city": "Maricopa",
  "sun city west": "Maricopa",
  youngtown: "Maricopa",
  guadalupe: "Maricopa",
  carefree: "Maricopa",
  anthem: "Maricopa",
  "new river": "Maricopa",
  wittmann: "Maricopa",
  "gila bend": "Maricopa",
  wickenburg: "Maricopa",
  "sun lakes": "Maricopa",
  "laveen village": "Maricopa",
  // Pima
  tucson: "Pima",
  marana: "Pima",
  "oro valley": "Pima",
  "green valley": "Pima",
  sahuarita: "Pima",
  vail: "Pima",
  catalina: "Pima",
  "south tucson": "Pima",
  // Pinal
  "casa grande": "Pinal",
  "apache junction": "Pinal",
  "san tan valley": "Pinal",
  maricopa: "Pinal",
  florence: "Pinal",
  eloy: "Pinal",
  coolidge: "Pinal",
  oracle: "Pinal",
  "gold canyon": "Pinal",
  superior: "Pinal",
  // Yavapai
  prescott: "Yavapai",
  "prescott valley": "Yavapai",
  "chino valley": "Yavapai",
  cottonwood: "Yavapai",
  "camp verde": "Yavapai",
  "dewey-humboldt": "Yavapai",
  dewey: "Yavapai",
  clarkdale: "Yavapai",
  "jerome": "Yavapai",
  "humboldt": "Yavapai",
  // Coconino
  flagstaff: "Coconino",
  page: "Coconino",
  williams: "Coconino",
  sedona: "Coconino",
  "grand canyon": "Coconino",
  // Mohave
  "lake havasu city": "Mohave",
  kingman: "Mohave",
  "bullhead city": "Mohave",
  "fort mohave": "Mohave",
  "golden valley": "Mohave",
  "mohave valley": "Mohave",
  "colorado city": "Mohave",
  // Yuma
  yuma: "Yuma",
  somerton: "Yuma",
  "san luis": "Yuma",
  wellton: "Yuma",
  // Cochise
  "sierra vista": "Cochise",
  douglas: "Cochise",
  benson: "Cochise",
  willcox: "Cochise",
  bisbee: "Cochise",
  "fort huachuca": "Cochise",
  // Navajo
  "show low": "Navajo",
  snowflake: "Navajo",
  winslow: "Navajo",
  holbrook: "Navajo",
  "pinetop-lakeside": "Navajo",
  pinetop: "Navajo",
  lakeside: "Navajo",
  // Gila
  payson: "Gila",
  globe: "Gila",
  miami: "Gila",
  "pine": "Gila",
  // Santa Cruz
  nogales: "Santa Cruz",
  "rio rico": "Santa Cruz",
  patagonia: "Santa Cruz",
  // Apache
  springerville: "Apache",
  eagar: "Apache",
  chinle: "Apache",
  "st johns": "Apache",
  // Graham
  safford: "Graham",
  thatcher: "Graham",
  pima: "Graham",
  // Greenlee
  clifton: "Greenlee",
  duncan: "Greenlee",
  // La Paz
  parker: "La Paz",
  quartzsite: "La Paz",
};

function citiesForCounty(countyName: string): string[] {
  return Object.entries(AZ_CITY_TO_COUNTY)
    .filter(([, c]) => c.toLowerCase() === countyName.toLowerCase())
    .map(([city]) => city);
}

export const AZ_COUNTIES: AzGeoDef[] = [
  countyGeo("apache", "Apache", citiesForCounty("Apache")),
  countyGeo("cochise", "Cochise", citiesForCounty("Cochise")),
  countyGeo("coconino", "Coconino", citiesForCounty("Coconino")),
  countyGeo("gila", "Gila", citiesForCounty("Gila")),
  countyGeo("graham", "Graham", citiesForCounty("Graham")),
  countyGeo("greenlee", "Greenlee", citiesForCounty("Greenlee")),
  countyGeo("la-paz", "La Paz", citiesForCounty("La Paz")),
  countyGeo("maricopa", "Maricopa", citiesForCounty("Maricopa")),
  countyGeo("mohave", "Mohave", citiesForCounty("Mohave")),
  countyGeo("navajo", "Navajo", citiesForCounty("Navajo")),
  countyGeo("pima", "Pima", citiesForCounty("Pima")),
  countyGeo("pinal", "Pinal", citiesForCounty("Pinal")),
  countyGeo("santa-cruz", "Santa Cruz", citiesForCounty("Santa Cruz")),
  countyGeo("yavapai", "Yavapai", citiesForCounty("Yavapai")),
  countyGeo("yuma", "Yuma", citiesForCounty("Yuma")),
];

/** Major-city browse — dedicated pages, not a substitute for official county. */
export const AZ_MAJOR_CITIES: AzGeoDef[] = [
  cityGeo("phoenix", "Phoenix", ["phoenix"], "Maricopa"),
  cityGeo("tucson", "Tucson", ["tucson"], "Pima"),
  cityGeo("mesa", "Mesa", ["mesa"], "Maricopa"),
  cityGeo("scottsdale", "Scottsdale", ["scottsdale"], "Maricopa"),
  cityGeo("glendale", "Glendale", ["glendale"], "Maricopa"),
  cityGeo("gilbert", "Gilbert", ["gilbert"], "Maricopa"),
  cityGeo("chandler", "Chandler", ["chandler"], "Maricopa"),
  cityGeo("peoria", "Peoria", ["peoria"], "Maricopa"),
  cityGeo("tempe", "Tempe", ["tempe"], "Maricopa"),
  cityGeo("queen-creek", "Queen Creek", ["queen creek"], "Maricopa"),
  cityGeo("surprise", "Surprise", ["surprise"], "Maricopa"),
  cityGeo("lake-havasu-city", "Lake Havasu City", ["lake havasu city"], "Mohave"),
  cityGeo("yuma-city", "Yuma", ["yuma"], "Yuma"),
  cityGeo("prescott", "Prescott", ["prescott"], "Yavapai"),
  cityGeo("flagstaff", "Flagstaff", ["flagstaff"], "Coconino"),
];

export const AZ_GEO_NOTE =
  "County is derived from the city on the ROC posting list, not an official ROC county field. Out-of-state mailing cities and unmapped towns are omitted from county totals.";

export function allAzGeos(): AzGeoDef[] {
  return [...AZ_COUNTIES, ...AZ_MAJOR_CITIES];
}

export function getAzGeo(slug: string): AzGeoDef | null {
  const key = slug.toLowerCase();
  return allAzGeos().find((g) => g.slug === key) ?? null;
}
