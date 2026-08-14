import type { CountyDef } from "@/lib/discovery/types";

/** Priority city pages for the landing strip (observed active density). */
export const WA_TOP_MARKET_SLUGS = [
  "seattle",
  "vancouver",
  "spokane",
  "tacoma",
  "everett",
  "kent",
  "renton",
  "federal-way",
  "bellevue",
  "kirkland",
] as const;

/** Densest derived counties — ZIP5 rollup, not an official L&I field. */
export const WA_TOP_COUNTY_SLUGS = [
  "king",
  "snohomish",
  "pierce",
  "spokane-county",
  "clark",
] as const;

/** Project / type shortcuts from a market card. */
export const WA_MARKET_SHORTCUTS = [
  { slug: "kitchen-remodel", label: "Kitchen" },
  { slug: "roofing", label: "Roofing" },
  { slug: "electrical", label: "Electrical" },
] as const;

export const WA_GEO_METHOD_POINTS = [
  "City pages match the mailing city and mailing state Washington — not the jobsite.",
  "County pages are derived from the five-digit mailing ZIP. L&I does not publish an official county field on this extract.",
  "When a ZIP spans counties, it is assigned to the majority county and called out on that county page.",
  "Three-digit ZIP prefixes are not used. 980, 982, 983, 985, and 986 each mix counties.",
  "Out-of-state mailing addresses are omitted from Washington county totals.",
] as const;

export function waGeoIsCity(geo: CountyDef): boolean {
  return geo.kind === "city";
}

export function waGeoIsOutOfState(geo: CountyDef): boolean {
  return geo.slug === "out-of-state" || Boolean(geo.matchOutOfStateMailing);
}

export function waGeoLabel(geo: CountyDef): string {
  if (waGeoIsOutOfState(geo)) return "Out of state (mailing address)";
  return waGeoIsCity(geo) ? geo.name : `${geo.name} County`;
}

export function waGeoHeadline(geo: CountyDef): string {
  if (waGeoIsOutOfState(geo)) {
    return "Out-of-state mailing address — not the jobsite.";
  }
  if (waGeoIsCity(geo)) {
    return `${geo.name} matches mailing city + Washington. Not a county list.`;
  }
  return `${geo.name} County is derived from mailing ZIP5 — not an official L&I county field.`;
}

export function waGeoBody(geo: CountyDef): string {
  if (waGeoIsOutOfState(geo)) {
    return "These businesses hold a Washington L&I credential and list a mailing address outside Washington. They may still work in Washington under L&I rules. Always confirm current status on the official L&I verify site.";
  }
  if (waGeoIsCity(geo)) {
    return `This page includes active licenses whose mailing city is ${geo.name} and mailing state is Washington. It is not a county-wide list. Mailing address is not the jobsite.`;
  }
  return `${geo.name} County is rolled up from a maintained five-digit ZIP → county map applied to the mailing ZIP. Multi-county ZIPs use the majority county. Three-digit prefixes are not used because they span counties. Unmapped ZIPs and out-of-state mailing addresses are omitted. Mailing address is not the jobsite.`;
}

const WA_CONFIRM =
  "Mailing address is not the jobsite. Confirm current status on the official L&I verify site.";

export function waGeoCaveatsFor(geo: CountyDef): string[] {
  const slug = geo.slug;
  if (slug === "king") {
    return [
      "Bainbridge Island (ZIP 98110) is mapped to Kitsap, not King.",
      "Some 980xx ZIPs (Lynnwood, Edmonds, Bothell 98012/98021) are Snohomish.",
      "Auburn 98001 and Pacific 98047 are mapped to King (majority); a few addresses sit in Pierce.",
      WA_CONFIRM,
    ];
  }
  if (slug === "snohomish") {
    return [
      "Bothell and Woodinville span King and Snohomish — county uses ZIP, not city name.",
      "Stanwood 98292 is mapped to Snohomish (majority); some addresses sit in Island County.",
      WA_CONFIRM,
    ];
  }
  if (slug === "pierce") {
    return [
      "Kitsap cities (Bremerton, Poulsbo, Port Orchard) use 983xx ZIPs that are not in this Pierce rollup.",
      "Milton 98354 is mapped to Pierce (majority).",
      WA_CONFIRM,
    ];
  }
  if (slug === "spokane-county") {
    return [
      "Spokane city is a separate page (/washington/spokane). This county view uses ZIP5 (992xx and suburban 990xx).",
      "A few 990xx ZIPs in Lincoln, Stevens, or Whitman are omitted.",
      WA_CONFIRM,
    ];
  }
  if (slug === "clark") {
    return [
      "Vancouver city is a separate page. Longview / Kelso / Woodland are Cowlitz, not Clark.",
      WA_CONFIRM,
    ];
  }
  if (slug === "benton") {
    return [
      "Pasco (99301) is Franklin County and is not in this Benton rollup.",
      WA_CONFIRM,
    ];
  }
  if (slug === "spokane") {
    return [
      "Spokane city only — not Spokane County. The ZIP-derived county list is /washington/spokane-county.",
      WA_CONFIRM,
    ];
  }
  if (slug === "vancouver") {
    return [
      "Vancouver, Washington mailing city only — not Vancouver, B.C., and not all of Clark County.",
      WA_CONFIRM,
    ];
  }
  if (slug === "bothell") {
    return [
      "Bothell mailing city only. The city spans King and Snohomish — use the county pages for ZIP-based county views.",
      WA_CONFIRM,
    ];
  }
  if (slug === "out-of-state") {
    return [
      "Mailing address is not the jobsite.",
      "The credential is still Washington L&I. Confirm current status on the official L&I verify site.",
    ];
  }
  return [WA_CONFIRM];
}

export function waGeoEmptyBody(geo: CountyDef): string {
  if (waGeoIsOutOfState(geo)) {
    return "No out-of-state mailing licenses matched this view. Mailing address is not the jobsite. Try a Washington city, or search by company name on Verify.";
  }
  if (waGeoIsCity(geo)) {
    return `No active L&I licenses with mailing city ${geo.name} and mailing state Washington. This city page is not a county list. Try the ZIP-derived county, a nearby city, or search by name on Verify.`;
  }
  return `No mapped five-digit mailing ZIPs produced an active license in ${geo.name} County. County is derived from ZIP5, not an official L&I field — unmapped ZIPs, out-of-state mailing addresses, or a narrow type filter can empty this view. Try a major city or search by name on Verify.`;
}
