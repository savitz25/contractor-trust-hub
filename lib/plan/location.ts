/**
 * Lightweight Florida location helpers.
 * Architecture supports multi-state expansion; ZIP map is FL-first and partial.
 */

/** Common FL ZIP3 prefixes → county (not exhaustive — fail open). */
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
};

export function normalizeZip(zip: string | undefined | null): string | null {
  if (!zip) return null;
  const digits = zip.replace(/\D/g, "").slice(0, 5);
  return digits.length === 5 ? digits : null;
}

export function countyFromFloridaZip(zip: string | null): string | null {
  if (!zip || zip.length < 3) return null;
  return FL_ZIP3_COUNTY[zip.slice(0, 3)] ?? null;
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
