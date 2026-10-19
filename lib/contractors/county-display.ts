import { classifyFloridaCountyCode } from "@/lib/intelligence/florida-county-codes";

const DIGITS = /^\d+$/;

/**
 * Consumer-facing county label.
 * A stored Florida DBPR code resolves to the county name.
 * Unknown, out-of-state, and foreign codes render nothing.
 * An existing county name is unchanged. Non-FL values are unchanged.
 * The stored primary_county column is not rewritten here.
 */
export function displayCounty(
  primaryCounty: string | null | undefined,
  homeState?: string | null,
  countyCode?: string | null,
): string | null {
  const stored = (primaryCounty ?? "").trim();
  const state = (homeState ?? "").trim().toUpperCase();
  if (state !== "FL" && state !== "FLORIDA") return stored || null;
  if (stored && !DIGITS.test(stored)) return stored;
  const raw = stored || (countyCode ?? "").trim();
  if (!raw) return null;
  if (!DIGITS.test(raw)) return raw;
  const classified = classifyFloridaCountyCode(raw);
  if (classified?.kind === "florida_county") return classified.name;
  return null;
}

export function profileLocationLine(
  city: string | null | undefined,
  county: string | null | undefined,
  state: string | null | undefined,
  separator = " · ",
): string {
  return [city?.trim() || null, displayCounty(county, state), state?.trim() || null]
    .filter((part): part is string => Boolean(part))
    .join(separator);
}
