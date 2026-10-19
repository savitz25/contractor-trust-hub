import { FLORIDA_DBPR_COUNTY_CODES } from "@/lib/intelligence/florida-county-codes";

/** SQL fragment. `expr` must be a trusted column expression, never user input. */
export function resolvedFloridaCountySql(expr: string): string {
  const whens = Object.entries(FLORIDA_DBPR_COUNTY_CODES)
    .map(([code, name]) => `WHEN '${code}' THEN '${name.toLowerCase().replace(/'/g, "''")}'`)
    .join(" ");
  return `CASE
    WHEN LTRIM(TRIM(COALESCE(${expr}, '')), '0') ~ '^[0-9]+$'
      THEN CASE LTRIM(TRIM(COALESCE(${expr}, '')), '0') ${whens} ELSE NULL END
    WHEN TRIM(COALESCE(${expr}, '')) ~ '[A-Za-z]'
      THEN LOWER(TRIM(COALESCE(${expr}, '')))
    ELSE NULL END`;
}

export const DISCOVERY_COUNTY_EXPR =
  "COALESCE(NULLIF(TRIM(l.county_name), ''), NULLIF(TRIM(c.primary_county), ''), NULLIF(TRIM(l.county_code), ''))";

/** Match a stored name or a bare DBPR code, including a single leading-zero pad. */
export function floridaCountyCodePredicates(
  params: unknown[],
  codes: readonly string[],
): string[] {
  const clauses: string[] = [];
  for (const code of codes) {
    params.push(code);
    const i = params.length;
    clauses.push(`TRIM(COALESCE(l.county_code, '')) = $${i}`);
    clauses.push(`TRIM(COALESCE(c.primary_county, '')) = $${i}`);
    clauses.push(`LTRIM(TRIM(COALESCE(l.county_code, '')), '0') = $${i}`);
    clauses.push(`LTRIM(TRIM(COALESCE(c.primary_county, '')), '0') = $${i}`);
  }
  return clauses;
}

export function storedFloridaCountyMatches(
  county: { name: string; matchNames: string[]; matchCodes?: readonly string[] },
  stored: { countyName?: string | null; primaryCounty?: string | null; countyCode?: string | null },
): boolean {
  const names = new Set(
    [county.name, ...county.matchNames].map((name) => name.toLowerCase().replace(/\s+/g, " ").trim()),
  );
  const codes = new Set(county.matchCodes ?? []);
  for (const field of [stored.countyName, stored.primaryCounty, stored.countyCode]) {
    const value = (field ?? "").trim();
    if (!value) continue;
    const lower = value.toLowerCase().replace(/\s+/g, " ").trim();
    if (names.has(lower) || names.has(lower.replace(/-/g, " "))) return true;
    if (/^\d+$/.test(value)) {
      const normalized = value.replace(/^0+/, "") || "0";
      if (codes.has(value) || codes.has(normalized)) return true;
    }
  }
  return false;
}
