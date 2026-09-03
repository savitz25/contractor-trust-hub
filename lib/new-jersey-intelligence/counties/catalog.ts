export const NJ_COUNTY_SLUGS = [
  "monmouth-county",
  "middlesex-county",
  "somerset-county",
  "union-county",
] as const;

export type NjCountySlug = (typeof NJ_COUNTY_SLUGS)[number];

export const NJ_COUNTY_META: Record<
  NjCountySlug,
  { name: string; fips: string; jsonStem: "monmouth" | "middlesex" | "somerset" | "union" }
> = {
  "monmouth-county": { name: "Monmouth", fips: "34025", jsonStem: "monmouth" },
  "middlesex-county": { name: "Middlesex", fips: "34023", jsonStem: "middlesex" },
  "somerset-county": { name: "Somerset", fips: "34035", jsonStem: "somerset" },
  "union-county": { name: "Union", fips: "34039", jsonStem: "union" },
};

export function isNjCountySlug(value: string): value is NjCountySlug {
  return (NJ_COUNTY_SLUGS as readonly string[]).includes(value);
}
