/**
 * Florida location helpers for Plan matching.
 * ZIP→county is best-effort (ZIP3 + selective ZIP5). Fail honest when unknown.
 */

import { FLORIDA_COUNTIES } from "@/lib/discovery/counties";

/** FL ZIP3 → primary county name (approximate — multi-county prefixes exist). */
const FL_ZIP3_COUNTY: Record<string, string> = {
  "320": "Duval",
  "321": "Volusia",
  "322": "Duval",
  "323": "Leon",
  "324": "Bay",
  "325": "Escambia",
  "326": "Alachua",
  "327": "Seminole",
  "328": "Orange",
  "329": "Brevard",
  "330": "Broward",
  "331": "Miami-Dade",
  "332": "Miami-Dade",
  "333": "Broward",
  "334": "Palm Beach",
  "335": "Hillsborough",
  "336": "Hillsborough",
  "337": "Pinellas",
  "338": "Polk",
  "339": "Lee",
  "341": "Collier",
  "342": "Sarasota",
  "344": "Marion",
  "346": "Pasco",
  "347": "Osceola",
  "349": "St. Lucie",
  // Additional coverage
  "340": "Monroe",
  "343": "Manatee",
  "345": "Citrus",
  "348": "Palm Beach",
};

/**
 * ZIP5 overrides where ZIP3 is ambiguous or wrong for common metros.
 * Only high-confidence public mappings — incomplete by design.
 */
const FL_ZIP5_COUNTY: Record<string, string> = {
  // Miami-Dade (Homestead / South Dade often 330xx shared with Broward edge)
  "33030": "Miami-Dade",
  "33031": "Miami-Dade",
  "33032": "Miami-Dade",
  "33033": "Miami-Dade",
  "33034": "Miami-Dade",
  "33035": "Miami-Dade",
  "33039": "Miami-Dade",
  // Broward coastal
  "33004": "Broward",
  "33009": "Broward",
  "33019": "Broward",
  "33020": "Broward",
  "33021": "Broward",
  "33060": "Broward",
  "33062": "Broward",
  "33063": "Broward",
  "33064": "Broward",
  "33065": "Broward",
  "33066": "Broward",
  "33067": "Broward",
  "33068": "Broward",
  "33069": "Broward",
  "33071": "Broward",
  "33073": "Broward",
  "33076": "Broward",
  // Jacksonville suburbs
  "32003": "Clay",
  "32043": "Clay",
  "32065": "Clay",
  "32068": "Clay",
  "32073": "Clay",
  "32034": "Nassau",
  "32046": "Nassau",
  // Orlando area refinements
  "32789": "Orange",
  "32801": "Orange",
  "32803": "Orange",
  "32804": "Orange",
  "32805": "Orange",
  "32806": "Orange",
  "32714": "Seminole",
  "32746": "Seminole",
  "32765": "Seminole",
  "32771": "Seminole",
  "34741": "Osceola",
  "34744": "Osceola",
  "34746": "Osceola",
  "34747": "Osceola",
  // Tampa Bay
  "33602": "Hillsborough",
  "33606": "Hillsborough",
  "33609": "Hillsborough",
  "33611": "Hillsborough",
  "33612": "Hillsborough",
  "33613": "Hillsborough",
  "33617": "Hillsborough",
  "33629": "Hillsborough",
  "33701": "Pinellas",
  "33702": "Pinellas",
  "33703": "Pinellas",
  "33704": "Pinellas",
  "33705": "Pinellas",
  "33706": "Pinellas",
  "33707": "Pinellas",
  "33755": "Pinellas",
  "33756": "Pinellas",
  "33759": "Pinellas",
  "33761": "Pinellas",
  "33763": "Pinellas",
  "33764": "Pinellas",
  "33765": "Pinellas",
  "33767": "Pinellas",
  "33770": "Pinellas",
  "33771": "Pinellas",
  "33772": "Pinellas",
  "33773": "Pinellas",
  "33774": "Pinellas",
  "33776": "Pinellas",
  "33777": "Pinellas",
  "33778": "Pinellas",
  "33781": "Pinellas",
  "33782": "Pinellas",
  "33785": "Pinellas",
  "33786": "Pinellas",
  // SWFL
  "33901": "Lee",
  "33904": "Lee",
  "33907": "Lee",
  "33908": "Lee",
  "33912": "Lee",
  "33913": "Lee",
  "33914": "Lee",
  "33916": "Lee",
  "33919": "Lee",
  "33931": "Lee",
  "33950": "Charlotte",
  "33952": "Charlotte",
  "33980": "Charlotte",
  "33983": "Charlotte",
  "34102": "Collier",
  "34103": "Collier",
  "34104": "Collier",
  "34105": "Collier",
  "34108": "Collier",
  "34109": "Collier",
  "34110": "Collier",
  "34112": "Collier",
  "34113": "Collier",
  "34114": "Collier",
  "34116": "Collier",
  "34117": "Collier",
  "34119": "Collier",
  "34120": "Collier",
  "34134": "Collier",
  "34135": "Collier",
  "34145": "Collier",
  // Space Coast / Treasure Coast
  "32901": "Brevard",
  "32903": "Brevard",
  "32904": "Brevard",
  "32905": "Brevard",
  "32907": "Brevard",
  "32908": "Brevard",
  "32909": "Brevard",
  "32920": "Brevard",
  "32922": "Brevard",
  "32926": "Brevard",
  "32927": "Brevard",
  "32931": "Brevard",
  "32934": "Brevard",
  "32935": "Brevard",
  "32937": "Brevard",
  "32940": "Brevard",
  "32952": "Brevard",
  "32953": "Brevard",
  "32955": "Brevard",
  "32958": "Indian River",
  "32960": "Indian River",
  "32962": "Indian River",
  "32963": "Indian River",
  "32966": "Indian River",
  "32967": "Indian River",
  "32968": "Indian River",
  "34950": "St. Lucie",
  "34952": "St. Lucie",
  "34953": "St. Lucie",
  "34982": "St. Lucie",
  "34983": "St. Lucie",
  "34984": "St. Lucie",
  "34986": "St. Lucie",
  "34987": "St. Lucie",
  "34990": "Martin",
  "34994": "Martin",
  "34996": "Martin",
  "34997": "Martin",
  // North FL
  "32301": "Leon",
  "32303": "Leon",
  "32304": "Leon",
  "32308": "Leon",
  "32309": "Leon",
  "32311": "Leon",
  "32312": "Leon",
  "32317": "Leon",
  "32401": "Bay",
  "32404": "Bay",
  "32405": "Bay",
  "32407": "Bay",
  "32408": "Bay",
  "32409": "Bay",
  "32413": "Bay",
  "32444": "Bay",
  "32501": "Escambia",
  "32503": "Escambia",
  "32504": "Escambia",
  "32505": "Escambia",
  "32506": "Escambia",
  "32507": "Escambia",
  "32514": "Escambia",
  "32526": "Escambia",
  "32534": "Escambia",
  "32601": "Alachua",
  "32605": "Alachua",
  "32606": "Alachua",
  "32607": "Alachua",
  "32608": "Alachua",
  "32609": "Alachua",
  "32641": "Alachua",
  "32653": "Alachua",
};

export type ResolvedLocation = {
  zip: string | null;
  city: string | null;
  county: string | null;
  /** DBPR county_code values when known for this county */
  countyCodes: string[];
  /** How county was resolved */
  countySource: "input" | "zip5" | "zip3" | "none";
};

export function normalizeZip(zip: string | undefined | null): string | null {
  if (!zip) return null;
  const digits = zip.replace(/\D/g, "").slice(0, 5);
  return digits.length === 5 ? digits : null;
}

export function countyFromFloridaZip(zip: string | null): string | null {
  if (!zip) return null;
  if (zip.length === 5 && FL_ZIP5_COUNTY[zip]) return FL_ZIP5_COUNTY[zip];
  if (zip.length >= 3) return FL_ZIP3_COUNTY[zip.slice(0, 3)] ?? null;
  return null;
}

export function resolvePlanLocation(opts: {
  zip?: string | null;
  city?: string | null;
  county?: string | null;
}): ResolvedLocation {
  const zip = normalizeZip(opts.zip);
  const city = opts.city?.trim() || null;
  let county = opts.county?.trim() || null;
  let countySource: ResolvedLocation["countySource"] = county ? "input" : "none";

  if (!county && zip) {
    if (FL_ZIP5_COUNTY[zip]) {
      county = FL_ZIP5_COUNTY[zip];
      countySource = "zip5";
    } else {
      const from3 = countyFromFloridaZip(zip);
      if (from3) {
        county = from3;
        countySource = "zip3";
      }
    }
  }

  const def = county
    ? FLORIDA_COUNTIES.find(
        (c) =>
          c.name.toLowerCase() === county!.toLowerCase() ||
          c.matchNames.some((n) => n.toLowerCase() === county!.toLowerCase())
      )
    : null;

  return {
    zip,
    city,
    county: def?.name || county,
    countyCodes: def?.matchCodes ?? [],
    countySource,
  };
}

export function formatLocationLabel(opts: {
  city?: string | null;
  county?: string | null;
  zip?: string | null;
  state?: string;
}): string {
  const state = (opts.state || "FL").toUpperCase();
  const parts: string[] = [];
  if (opts.city?.trim()) parts.push(opts.city.trim());
  if (opts.county?.trim()) parts.push(`${opts.county.trim()} County`);
  if (opts.zip) parts.push(opts.zip);
  if (parts.length === 0) return state;
  return `${parts.join(", ")} · ${state}`;
}
