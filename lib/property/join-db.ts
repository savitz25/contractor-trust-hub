import { query } from "@/lib/db";
import { normalizeLicenseKey } from "./matcher";
import { applyJoinToPermit } from "./permits";
import type { PropertyPermitRecord } from "./types";

/**
 * Lookup contractor candidate by exact license key for high-confidence joins.
 */
export async function findCandidateByLicenseKey(licenseKey: string): Promise<{
  slug: string;
  licenseKeys: string[];
  names: string[];
  city: string | null;
  zip: string | null;
} | null> {
  const norm = normalizeLicenseKey(licenseKey);
  if (!norm) return null;

  try {
    const rows = await query<{
      slug: string;
      display_name: string;
      legal_name: string | null;
      dba_name: string | null;
      primary_city: string | null;
      external_key: string;
      postal_code: string | null;
    }>(
      `
      SELECT c.slug, c.display_name, c.legal_name, c.dba_name, c.primary_city,
             l.external_key, l.postal_code
      FROM licenses l
      JOIN contractors c ON c.id = l.contractor_id
      WHERE UPPER(REGEXP_REPLACE(l.external_key, '[^A-Za-z0-9]', '', 'g')) = $1
      LIMIT 5
      `,
      [norm]
    );
    if (!rows.length) return null;
    const slug = rows[0].slug;
    return {
      slug,
      licenseKeys: rows.map((r) => r.external_key),
      names: [
        rows[0].display_name,
        rows[0].legal_name,
        rows[0].dba_name,
      ].filter(Boolean) as string[],
      city: rows[0].primary_city,
      zip: rows[0].postal_code,
    };
  } catch {
    return null;
  }
}

/** Enrich permit rows with high-confidence DB joins (license only). */
export async function enrichPermitsWithDbJoins(
  permits: PropertyPermitRecord[]
): Promise<PropertyPermitRecord[]> {
  const out: PropertyPermitRecord[] = [];
  for (const p of permits) {
    if (!p.contractorLicenseKey) {
      out.push(p);
      continue;
    }
    const cand = await findCandidateByLicenseKey(p.contractorLicenseKey);
    out.push(applyJoinToPermit(p, cand));
  }
  return out;
}

export async function activityFromDb(
  licenseKeys: string[]
): Promise<{
  permitCount: number;
  counties: string[];
  categories: string[];
  recentWindow: string | null;
  sampleTypes: string[];
  sourceLabel: string;
  retrievedAt: string | null;
} | null> {
  const norms = licenseKeys.map(normalizeLicenseKey).filter(Boolean);
  if (!norms.length) return null;
  try {
    const rows = await query<{
      permit_count: number;
      counties: string[] | null;
      categories: string[] | null;
      recent_window: string | null;
      sample_types: string[] | null;
      source_label: string;
      retrieved_at: string | null;
    }>(
      `
      SELECT permit_count, counties, categories, recent_window, sample_types,
             source_label, retrieved_at::text
      FROM contractor_permit_activity
      WHERE license_key_norm = ANY($1::text[])
      `,
      [norms]
    );
    if (!rows.length) return null;
    let total = 0;
    const counties = new Set<string>();
    const categories = new Set<string>();
    const samples: string[] = [];
    let recent: string | null = null;
    let source = "DB permit activity";
    let retrieved: string | null = null;
    for (const r of rows) {
      total += Number(r.permit_count) || 0;
      (r.counties || []).forEach((c) => counties.add(c));
      (r.categories || []).forEach((c) => categories.add(c));
      (r.sample_types || []).forEach((t) => {
        if (samples.length < 8) samples.push(t);
      });
      if (r.recent_window) recent = r.recent_window;
      if (r.source_label) source = r.source_label;
      if (r.retrieved_at) retrieved = r.retrieved_at;
    }
    return {
      permitCount: total,
      counties: [...counties],
      categories: [...categories],
      recentWindow: recent,
      sampleTypes: samples,
      sourceLabel: source,
      retrievedAt: retrieved,
    };
  } catch {
    return null;
  }
}
