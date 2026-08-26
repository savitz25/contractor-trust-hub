/**
 * Official Florida DBPR county codes.
 * Source: https://www2.myfloridalicense.com/about-us/understanding-dbpr-codes/
 *
 * License mailing county = headquarters/base county.
 * This is NOT evidence of operating in the county.
 */

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

/** Codes 11–77 are the 67 Florida counties (Dade = Miami-Dade). */
export const FLORIDA_DBPR_COUNTY_CODES: Record<string, string> = {
  "11": "Alachua",
  "12": "Baker",
  "13": "Bay",
  "14": "Bradford",
  "15": "Brevard",
  "16": "Broward",
  "17": "Calhoun",
  "18": "Charlotte",
  "19": "Citrus",
  "20": "Clay",
  "21": "Collier",
  "22": "Columbia",
  "23": "Miami-Dade",
  "24": "DeSoto",
  "25": "Dixie",
  "26": "Duval",
  "27": "Escambia",
  "28": "Flagler",
  "29": "Franklin",
  "30": "Gadsden",
  "31": "Gilchrist",
  "32": "Glades",
  "33": "Gulf",
  "34": "Hamilton",
  "35": "Hardee",
  "36": "Hendry",
  "37": "Hernando",
  "38": "Highlands",
  "39": "Hillsborough",
  "40": "Holmes",
  "41": "Indian River",
  "42": "Jackson",
  "43": "Jefferson",
  "44": "Lafayette",
  "45": "Lake",
  "46": "Lee",
  "47": "Leon",
  "48": "Levy",
  "49": "Liberty",
  "50": "Madison",
  "51": "Manatee",
  "52": "Marion",
  "53": "Martin",
  "54": "Monroe",
  "55": "Nassau",
  "56": "Okaloosa",
  "57": "Okeechobee",
  "58": "Orange",
  "59": "Osceola",
  "60": "Palm Beach",
  "61": "Pasco",
  "62": "Pinellas",
  "63": "Polk",
  "64": "Putnam",
  "65": "St. Johns",
  "66": "St. Lucie",
  "67": "Santa Rosa",
  "68": "Sarasota",
  "69": "Seminole",
  "70": "Sumter",
  "71": "Suwannee",
  "72": "Taylor",
  "73": "Union",
  "74": "Volusia",
  "75": "Wakulla",
  "76": "Walton",
  "77": "Washington",
};

export const FLORIDA_COUNTY_SPECIAL_CODES: Record<string, { name: string; kind: FloridaCountyCodeKind }> = {
  "78": { name: "Unknown", kind: "unknown" },
  "79": { name: "Out of State", kind: "out_of_state" },
  "80": { name: "Foreign", kind: "foreign" },
  "99": { name: "Unknown", kind: "unknown" },
};

export function classifyFloridaCountyCode(raw: string | null | undefined): FloridaCountyCodeDef | null {
  const code = String(raw || "").trim();
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
  if (n >= 701 && n <= 799) {
    return { code, name: "Out of State", slug: "out-of-state", kind: "out_of_state" };
  }
  if (n >= 801 && n <= 899) {
    return { code, name: "Foreign", slug: "foreign", kind: "foreign" };
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
