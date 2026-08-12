import sample from "@/data/property/sample-permits.json";
import {
  buildAddressKey,
  normalizeLicenseKey,
  resolvePermitContractorJoin,
} from "./matcher";
import type { PermitMatchConfidence, PermitStatus, PropertyPermitRecord } from "./types";

type ExtractRow = {
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
  retrievedAt?: string;
  notes?: string;
};

type ActivityRow = {
  permitCount: number;
  counties: string[];
  recentWindow: string;
  categories: string[];
  sampleTypes?: string[];
  sourceLabel?: string;
  retrievedAt?: string;
  matchMethod?: string;
};

type SampleFile = {
  _meta?: { updated?: string };
  byAddressKey: Record<string, ExtractRow[]>;
  contractorActivityByLicense: Record<string, ActivityRow>;
};

const data = sample as SampleFile;

function asStatus(s: string): PermitStatus {
  const x = s.toLowerCase();
  if (
    x === "open" ||
    x === "closed" ||
    x === "expired" ||
    x === "issued" ||
    x === "finaled"
  ) {
    return x;
  }
  return "unknown";
}

function mapRow(r: ExtractRow): PropertyPermitRecord {
  const hasLic = Boolean(r.contractorLicenseKey);
  return {
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
    contractorSlug: null,
    matchConfidence: hasLic ? "license" : "none",
    matchMethod: hasLic ? "license" : "none",
    matchLabel: hasLic
      ? "License on permit — profile link pending high-confidence join"
      : "Contractor identity not confidently linked",
    sourceJurisdiction: r.sourceJurisdiction,
    sourceLabel: r.sourceLabel,
    retrievedAt: r.retrievedAt || data._meta?.updated || null,
    notes: r.notes,
  };
}

/**
 * Load permits for an address from connected extracts (JSON wave extracts + optional DB later).
 */
export function loadPermitsForAddress(input: {
  street: string;
  zip: string;
  unit?: string;
}): PropertyPermitRecord[] {
  const key = buildAddressKey(input.street, input.zip, input.unit);
  const keyNoUnit = buildAddressKey(input.street, input.zip);
  const rows = data.byAddressKey[key] || data.byAddressKey[keyNoUnit] || [];
  return rows.map(mapRow);
}

export type ContractorActivityResult = {
  permitCount: number;
  counties: string[];
  recentWindow: string | null;
  categories: string[];
  sampleTypes: string[];
  sourceLabel: string;
  retrievedAt: string | null;
  matchMethod: string;
};

export function contractorActivityFromExtracts(
  licenseKeys: string[]
): ContractorActivityResult | null {
  const map = data.contractorActivityByLicense || {};
  let total = 0;
  const counties = new Set<string>();
  const categories = new Set<string>();
  const samples: string[] = [];
  let recent: string | null = null;
  let sourceLabel = "CTH permit activity extracts";
  let retrievedAt: string | null = null;
  let matched = false;

  for (const k of licenseKeys) {
    const norm = normalizeLicenseKey(k);
    const row =
      map[k.toUpperCase()] ||
      map[norm] ||
      Object.entries(map).find(([key]) => normalizeLicenseKey(key) === norm)?.[1];
    if (!row) continue;
    matched = true;
    total += row.permitCount || 0;
    row.counties?.forEach((c) => counties.add(c));
    row.categories?.forEach((c) => categories.add(c));
    row.sampleTypes?.forEach((t) => {
      if (samples.length < 8 && !samples.includes(t)) samples.push(t);
    });
    if (row.recentWindow) recent = row.recentWindow;
    if (row.sourceLabel) sourceLabel = row.sourceLabel;
    if (row.retrievedAt) retrievedAt = row.retrievedAt;
  }

  if (!matched) return null;
  return {
    permitCount: total,
    counties: [...counties],
    recentWindow: recent,
    categories: [...categories],
    sampleTypes: samples,
    sourceLabel,
    retrievedAt,
    matchMethod: "license",
  };
}

export function extractStats() {
  const addressKeys = Object.keys(data.byAddressKey || {});
  let permitRows = 0;
  let withLicense = 0;
  for (const rows of Object.values(data.byAddressKey || {})) {
    permitRows += rows.length;
    withLicense += rows.filter((r) => r.contractorLicenseKey).length;
  }
  const activityKeys = Object.keys(data.contractorActivityByLicense || {}).length;
  return {
    addressKeys: addressKeys.length,
    permitRows,
    withLicenseKey: withLicense,
    activityLicenseKeys: activityKeys,
    freshness: data._meta?.updated || null,
  };
}

/**
 * Apply high-confidence join result onto a permit row (slug only when high confidence).
 */
export function applyJoinToPermit(
  permit: PropertyPermitRecord,
  candidate: {
    slug: string;
    licenseKeys: string[];
    names: string[];
    city?: string | null;
    zip?: string | null;
  } | null
): PropertyPermitRecord {
  const join = resolvePermitContractorJoin({
    contractorLicenseKey: permit.contractorLicenseKey,
    contractorName: permit.contractorName,
    permitGeo: [permit.sourceJurisdiction, permit.contractorName].filter(Boolean).join(" "),
    candidate,
  });

  // Override geo using zip from address context when enriching in batch
  const conf: PermitMatchConfidence =
    join.matchConfidence === "high" ? "license" : "none";

  return {
    ...permit,
    contractorSlug: join.slug,
    matchConfidence: conf,
    matchMethod: join.matchMethod,
    matchLabel: join.label,
  };
}
