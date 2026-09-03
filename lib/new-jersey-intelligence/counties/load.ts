import "server-only";

import { NJ_COUNTY_FINGERPRINTS } from "./publication";
import { isNjCountySlug, type NjCountySlug } from "./catalog";
import middlesex from "./middlesex.json";
import monmouth from "./monmouth.json";
import njsavi from "./njsavi-construction-candidates.json";
import somerset from "./somerset.json";
import union from "./union.json";

const SNAPSHOTS = {
  "monmouth-county": monmouth,
  "middlesex-county": middlesex,
  "somerset-county": somerset,
  "union-county": union,
} as const;

export type NjCountySnapshot = (typeof SNAPSHOTS)[NjCountySlug];
export type NjsaviVendorRow = (typeof njsavi.rows)[number];

export function loadNjCountySnapshot(slug: string): NjCountySnapshot | null {
  if (!isNjCountySlug(slug)) return null;
  const snap = SNAPSHOTS[slug];
  if (snap.fingerprint !== NJ_COUNTY_FINGERPRINTS[slug]) {
    throw new Error(`NJ-CON-COUNTY-001 fingerprint mismatch for ${slug}`);
  }
  if (!snap.publication_gate.indexable) return snap;
  return snap;
}

export function njsaviVendorsForCounty(countyName: string): NjsaviVendorRow[] {
  const needle = countyName.toUpperCase();
  return njsavi.rows.filter((row) => row.county === needle);
}
