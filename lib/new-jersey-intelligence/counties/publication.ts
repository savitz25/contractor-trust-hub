import type { NjCountySlug } from "./catalog";

export const NJ_COUNTY_INTEL_VERSION = "contractor-nj-county-intel-v1" as const;

export const NJ_COUNTY_FINGERPRINTS: Record<NjCountySlug, string> = {
  "monmouth-county": "6a2b8f3311f5d6698497d4c5f2cd7c3ced918c1f8a2975e330da2c43c0047987",
  "middlesex-county": "12d4ae43716fb7bb4cd0145e00e6dd1413ebc174e008fcc1393bdbe21562b338",
  "somerset-county": "d4621406db5b72ca54f2a5ba26c7081d6471d4530d21471c67be7fc3bdab23fc",
  "union-county": "589e62b7cd42b12e46ae22d192247dbfd800e5112206d600cc3140571e6e18db",
};

export function njCountyGate(
  slug: NjCountySlug,
  countyName: string,
  indexable: boolean,
  held: { vendors: number; records: number },
) {
  const vendors = held.vendors.toLocaleString("en-US");
  const records = held.records.toLocaleString("en-US");
  return {
    path: `/new-jersey/${slug}`,
    robotsIndex: indexable,
    sitemap: indexable,
    title: `${countyName} County NJ contractors | ${vendors} construction vendors on file`,
    description: `${countyName} County, New Jersey: ${vendors} city-matched construction vendors and ${records} DCA construction source records in the acquired extract. Not a Home Improvement Contractor roster and not a ranking.`,
  } as const;
}
