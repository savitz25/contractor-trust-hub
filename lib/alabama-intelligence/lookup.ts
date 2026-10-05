import roster from "./roster.json";

export type AlabamaRosterRow = {
  license: string;
  name: string;
  city: string;
  state: string;
  zip: string;
  bidLimit: string;
  specialty: string;
  expiration: string;
  extension: string;
};

const rows = roster as AlabamaRosterRow[];
const byLicense = new Map(rows.map((row) => [row.license.toUpperCase(), row]));

export const ALABAMA_ROSTER_ROWS = rows.length;

/** Exact printed license number. This does not match a name. */
export function lookupAlabamaLicense(raw: string | undefined | null): AlabamaRosterRow | null {
  if (!raw) return null;
  const key = raw.trim().toUpperCase().replace(/\s+/g, "");
  return byLicense.get(key) ?? null;
}

export function alabamaLicenseInText(query: string): AlabamaRosterRow | null {
  const labelled = query.match(/\b(?:S-\d+|IA-\d+)\b/i);
  if (labelled) return lookupAlabamaLicense(labelled[0]);
  const numeric = query.match(/\b\d{4,5}\b/g) ?? [];
  for (const token of numeric) {
    const hit = lookupAlabamaLicense(token);
    if (hit) return hit;
  }
  const short = query.match(/\blicen[sc]e(?:\s+number)?\s+#?\s*(\d{1,3})\b/i);
  return short ? lookupAlabamaLicense(short[1]) : null;
}
