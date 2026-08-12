import sample from "@/data/property/sample-permits.json";
import type { PermitStatus, PropertyPermitRecord } from "./types";

type SampleFile = {
  byAddressKey: Record<
    string,
    Array<{
      id: string;
      permitNumber: string | null;
      description: string;
      category: string;
      status: string;
      filedDate: string | null;
      issuedDate: string | null;
      finalDate: string | null;
      declaredValue: number | null;
      contractorName: string | null;
      contractorLicenseKey: string | null;
      sourceJurisdiction: string;
      sourceLabel: string;
      notes?: string;
    }>
  >;
  contractorActivityByLicense: Record<
    string,
    {
      permitCount: number;
      counties: string[];
      recentWindow: string;
      categories: string[];
    }
  >;
};

const data = sample as SampleFile;

function addressKey(street: string, zip: string): string {
  return `${street.toUpperCase().replace(/\s+/g, " ").trim()}|${zip}`;
}

function asStatus(s: string): PermitStatus {
  const x = s.toLowerCase();
  if (x === "open" || x === "closed" || x === "expired" || x === "issued" || x === "finaled") {
    return x;
  }
  return "unknown";
}

/**
 * Load permits for an address from connected extracts.
 * Currently pilot JSON only — returns [] when no key matches (honest empty).
 * Contractor slug matching is high-confidence license-key only (no fuzzy name → slug).
 */
export function loadPermitsForAddress(input: {
  street: string;
  zip: string;
}): PropertyPermitRecord[] {
  const key = addressKey(input.street, input.zip);
  // Try exact key and a few spacing variants
  const rows =
    data.byAddressKey[key] ||
    data.byAddressKey[key.replace(/\s+/g, " ")] ||
    [];

  return rows.map((r) => ({
    id: r.id,
    permitNumber: r.permitNumber,
    description: r.description,
    category: r.category,
    status: asStatus(r.status),
    filedDate: r.filedDate,
    issuedDate: r.issuedDate,
    finalDate: r.finalDate,
    declaredValue: r.declaredValue,
    contractorName: r.contractorName,
    contractorLicenseKey: r.contractorLicenseKey,
    // License-key match only — slug filled by async enrich when we have DB
    contractorSlug: null,
    matchConfidence: r.contractorLicenseKey ? "license" : "none",
    sourceJurisdiction: r.sourceJurisdiction,
    sourceLabel: r.sourceLabel,
    notes: r.notes,
  }));
}

export function contractorActivityFromExtracts(licenseKeys: string[]): {
  permitCount: number;
  counties: string[];
  recentWindow: string | null;
  categories: string[];
} | null {
  const map = data.contractorActivityByLicense || {};
  let total = 0;
  const counties = new Set<string>();
  const categories = new Set<string>();
  let recent: string | null = null;
  for (const k of licenseKeys) {
    const row = map[k.toUpperCase()];
    if (!row) continue;
    total += row.permitCount || 0;
    row.counties?.forEach((c) => counties.add(c));
    row.categories?.forEach((c) => categories.add(c));
    if (row.recentWindow) recent = row.recentWindow;
  }
  if (total === 0 && counties.size === 0) return null;
  return {
    permitCount: total,
    counties: [...counties],
    recentWindow: recent,
    categories: [...categories],
  };
}
