import type { CountyDef } from "./types";

/**
 * FL-DIR-PERF-004. The county listing used to join every Florida license onto
 * every contractor and only then apply the county predicate, so every county
 * paid for a full contractors scan. These lookups hit indexes that already
 * exist (licenses county name, licenses county code, contractors primary
 * county). The original WHERE clause stays in the query as a recheck, so a
 * wider id set cannot add a row the old filter would reject.
 *
 * County codes are plain DBPR numbers. If a code stops being plain numeric,
 * the raw county_code index no longer covers TRIM/LTRIM the way this lookup
 * does, and the caller must keep the old join.
 */

export const FLORIDA_DIRECTORY_FROM_LEGACY = `FROM contractors c
        JOIN licenses l ON l.contractor_id = c.id`;

// LIMIT 1 is a no-op (licenses.id and contractors.id are primary keys). It is
// the same optimizer boundary as the name-search join-back: a plain JOIN lets
// a high id-set estimate hash-scan the whole table. One indexed lookup per id
// stays a lookup however large that estimate is.
export const FLORIDA_DIRECTORY_FROM_PREFETCH = `FROM county_license_ids ids
        JOIN LATERAL (
          SELECT * FROM licenses WHERE id = ids.id LIMIT 1
        ) l ON TRUE
        JOIN LATERAL (
          SELECT * FROM contractors WHERE id = l.contractor_id LIMIT 1
        ) c ON TRUE`;

export function floridaCountyCodesArePlainNumeric(codes: readonly string[] | undefined): boolean {
  return (codes ?? []).every((code) => /^[0-9]+$/.test(code));
}

/** Stored forms the existing space-to-hyphen predicate accepts for one name. */
export function floridaCountyNameKeys(names: readonly string[]): string[] {
  const keys = new Set<string>();
  for (const raw of names) {
    const lower = raw.toLowerCase().trim();
    if (!lower) continue;
    const canonical = lower.replace(/ /g, "-");
    const parts = canonical.split("-");
    const slots = parts.length - 1;
    if (slots > 8) return [];
    const variants = 1 << slots;
    for (let mask = 0; mask < variants; mask++) {
      let value = parts[0] ?? "";
      for (let i = 0; i < slots; i++) {
        value += (mask & (1 << i)) !== 0 ? " " : "-";
        value += parts[i + 1];
      }
      if (value) keys.add(value);
    }
  }
  return [...keys];
}

/** Exact county_code values, plus one leading-zero pad and the stripped form. */
export function floridaCountyCodeKeys(codes: readonly string[]): string[] {
  const keys = new Set<string>();
  for (const code of codes) {
    keys.add(code);
    const stripped = code.replace(/^0+/, "") || "0";
    keys.add(stripped);
    keys.add(`0${stripped}`);
  }
  return [...keys];
}

export type FloridaCountyPrefetch =
  | { apply: false }
  | { apply: true; cte: string };

/**
 * Appends the lookup parameters and returns the id CTE. Does not change
 * `params` when the old join must be kept.
 */
export function floridaCountyLicensePrefetch(
  county: CountyDef | null | undefined,
  params: unknown[],
): FloridaCountyPrefetch {
  if (!county) return { apply: false };
  if (county.matchOutOfStateMailing) return { apply: false };
  if ((county.matchCities?.length ?? 0) > 0) return { apply: false };
  if ((county.matchPostalPrefixes?.length ?? 0) > 0) return { apply: false };
  if (!floridaCountyCodesArePlainNumeric(county.matchCodes)) return { apply: false };

  const nameKeys = floridaCountyNameKeys(county.matchNames);
  if (nameKeys.length === 0 && county.matchNames.some((name) => name.trim())) {
    return { apply: false };
  }
  const codeKeys = floridaCountyCodeKeys(county.matchCodes ?? []);
  if (nameKeys.length === 0 && codeKeys.length === 0) return { apply: false };

  const branches: string[] = [];
  if (nameKeys.length) {
    params.push(nameKeys);
    const nameIdx = params.length;
    branches.push(`
      SELECT l.id
      FROM licenses l
      WHERE l.county_name IS NOT NULL
        AND TRIM(l.county_name) <> ''
        AND LOWER(TRIM(l.county_name)) = ANY($${nameIdx}::text[])`);
  }
  if (codeKeys.length) {
    params.push(codeKeys);
    const codeIdx = params.length;
    branches.push(`
      SELECT l.id
      FROM licenses l
      WHERE l.county_code = ANY($${codeIdx}::text[])`);
  }
  const primaryKeys = [...new Set([...nameKeys, ...codeKeys])];
  if (primaryKeys.length) {
    params.push(primaryKeys);
    const primaryIdx = params.length;
    // OFFSET 0 keeps every license of a matching contractor (LIMIT 1 would drop
    // one) and stops the planner from pulling this lookup up into a full
    // licenses scan. licenses_contractor_idx is the existing index.
    branches.push(`
      SELECT lic.id
      FROM contractors c
      JOIN LATERAL (
        SELECT l.id
        FROM licenses l
        WHERE l.contractor_id = c.id
        OFFSET 0
      ) lic ON TRUE
      WHERE c.is_thin_profile = FALSE
        AND c.primary_county IS NOT NULL
        AND TRIM(c.primary_county) <> ''
        AND LOWER(TRIM(c.primary_county)) = ANY($${primaryIdx}::text[])`);
  }

  return {
    apply: true,
    cte: `county_license_ids AS MATERIALIZED (${branches.join("\n      UNION")}\n    )`,
  };
}
