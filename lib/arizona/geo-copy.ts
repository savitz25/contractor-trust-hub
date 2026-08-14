import type { CountyDef } from "@/lib/discovery/types";

/** Densest active mailing cities on the ROC extract (2026-08 load). */
export const AZ_TOP_MARKET_SLUGS = [
  "phoenix",
  "tucson",
  "mesa",
  "scottsdale",
  "glendale",
  "gilbert",
  "chandler",
  "peoria",
  "tempe",
  "queen-creek",
] as const;

export const AZ_GEO_CAVEATS = [
  "City of Maricopa is in Pinal County, not Maricopa County.",
  "San Tan Valley is mapped to Pinal.",
  "Apache Junction is mapped to Pinal (majority).",
  "Queen Creek is mapped to Maricopa (majority); some addresses sit in Pinal.",
] as const;

export function azGeoIsCity(geo: CountyDef): boolean {
  return geo.kind === "city";
}

export function azGeoHeadline(geo: CountyDef): string {
  if (azGeoIsCity(geo)) {
    return `${geo.name} matches the mailing city on the ROC list only.`;
  }
  return `${geo.name} County is derived from mailing city — not an official ROC county field.`;
}

export function azGeoBody(geo: CountyDef): string {
  if (azGeoIsCity(geo)) {
    return `The ROC current-contractor extract is strong on city and almost empty on county. This page includes active licenses whose city field is ${geo.name}. It is not a county-wide list.`;
  }
  return `The ROC extract rarely publishes county. This county view rolls up mailing cities we map to ${geo.name} County. Unmapped towns and out-of-state mailing cities are omitted.`;
}

export function azGeoCaveatsFor(geo: CountyDef): string[] {
  const slug = geo.slug;
  if (slug === "maricopa") {
    return [
      "City of Maricopa and San Tan Valley are not in this Maricopa County rollup — they are mapped to Pinal.",
      "Queen Creek is included here as majority-Maricopa; some Queen Creek addresses are in Pinal.",
    ];
  }
  if (slug === "pinal") {
    return [
      "Includes City of Maricopa, San Tan Valley, and Apache Junction (majority Pinal).",
      "Queen Creek is listed under Maricopa County (majority), not here.",
    ];
  }
  if (slug === "queen-creek") {
    return ["Queen Creek mailing city only. Some Queen Creek addresses sit in Pinal County."];
  }
  if (slug === "yuma-city") {
    return ["Yuma city only — not the full Yuma County list."];
  }
  return [];
}

export function azGeoEmptyBody(geo: CountyDef): string {
  if (azGeoIsCity(geo)) {
    return `No active ROC licenses with mailing city ${geo.name} in this extract. Try the surrounding county, a nearby city, or search by company name. Out-of-state mailing addresses are omitted.`;
  }
  return `No mapped mailing cities produced an active license in ${geo.name} County. That can mean the towns on file are unmapped, out of state, or the class filter is narrow. Try a major city or search by name.`;
}
