/**
 * Official Florida DBPR county codes.
 * Source: https://www2.myfloridalicense.com/about-us/understanding-dbpr-codes/
 *
 * The 67-county table and the documented special codes live in
 * florida-dbpr-county-codes.json. Python ingest loads that same file.
 *
 * License mailing county = headquarters/base county.
 * This is NOT evidence of operating in the county.
 */

import table from "./florida-dbpr-county-codes.json";

export type FloridaCountyCodeKind = "florida_county" | "unknown" | "out_of_state" | "foreign";

export type FloridaCountyCodeDef = {
  code: string;
  name: string;
  slug: string;
  kind: FloridaCountyCodeKind;
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/miami-dade|dade/g, "miami-dade")
    .replace(/st\.\s+/g, "st-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const COUNTY_CODE_KINDS = new Set<FloridaCountyCodeKind>([
  "florida_county",
  "unknown",
  "out_of_state",
  "foreign",
]);

function countyKind(kind: string): FloridaCountyCodeKind {
  if (COUNTY_CODE_KINDS.has(kind as FloridaCountyCodeKind)) return kind as FloridaCountyCodeKind;
  return "unknown";
}

/** Codes 11–77 are the 67 Florida counties (Dade = Miami-Dade). */
export const FLORIDA_DBPR_COUNTY_CODES: Record<string, string> = table.counties;

export const FLORIDA_COUNTY_SPECIAL_CODES: Record<string, { name: string; kind: FloridaCountyCodeKind }> =
  Object.fromEntries(
    Object.entries(table.special).map(([code, spec]) => [code, { name: spec.name, kind: countyKind(spec.kind) }]),
  );

const COUNTY_CODE_RANGES = table.ranges.map((range) => ({ ...range, kind: countyKind(range.kind) }));

/** Trim, then drop a leading-zero pad so "074" uses the same entry as "74". */
export function normalizeFloridaCountyCode(raw: string | null | undefined): string {
  const code = String(raw ?? "").trim();
  if (!/^\d+$/.test(code)) return code;
  return code.replace(/^0+/, "") || "0";
}

export function classifyFloridaCountyCode(raw: string | null | undefined): FloridaCountyCodeDef | null {
  const code = normalizeFloridaCountyCode(raw);
  if (!code) return null;
  const n = Number(code);
  if (FLORIDA_DBPR_COUNTY_CODES[code]) {
    const name = FLORIDA_DBPR_COUNTY_CODES[code];
    return { code, name, slug: slugify(name), kind: "florida_county" };
  }
  if (FLORIDA_COUNTY_SPECIAL_CODES[code]) {
    const spec = FLORIDA_COUNTY_SPECIAL_CODES[code];
    return { code, name: spec.name, slug: slugify(spec.name), kind: spec.kind };
  }
  for (const range of COUNTY_CODE_RANGES) {
    if (Number.isFinite(n) && n >= range.min && n <= range.max) {
      return { code, name: range.name, slug: slugify(range.name), kind: countyKind(range.kind) };
    }
  }
  return { code, name: "Unknown", slug: "unknown", kind: "unknown" };
}

export function isHeadquartersCountyCode(code: string | null | undefined): boolean {
  return classifyFloridaCountyCode(code)?.kind === "florida_county";
}

/** Discovery county pages — one entry per Florida county. */
export function floridaDiscoveryCounties(): Array<{
  slug: string;
  name: string;
  matchNames: string[];
  matchCodes: string[];
}> {
  return Object.entries(FLORIDA_DBPR_COUNTY_CODES).map(([code, name]) => {
    const slug = slugify(name);
    const matchNames = [name];
    if (name === "Miami-Dade") matchNames.push("Miami Dade", "Dade");
    if (name.startsWith("St. ")) {
      matchNames.push(name.replace("St. ", "St "), name.replace("St. ", "Saint "));
    }
    return { slug, name, matchNames, matchCodes: [code] };
  });
}
