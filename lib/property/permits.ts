import sample from "@/data/property/sample-permits.json";
import {
  buildAddressKey,
  normalizeLicenseKey,
  resolvePermitContractorJoin,
} from "./matcher";
import { normalizePermitStatus } from "./status";
import type {
  PermitJoinAudit,
  PermitMatchConfidence,
  PropertyPermitRecord,
} from "./types";

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
  _meta?: { updated?: string; waves?: string[] };
  byAddressKey: Record<string, ExtractRow[]>;
  contractorActivityByLicense: Record<string, ActivityRow>;
};

const data = sample as SampleFile;

function mapRow(r: ExtractRow): PropertyPermitRecord {
  const hasLic = Boolean(r.contractorLicenseKey?.trim());
  const sn = normalizePermitStatus(r.status);
  const licNorm = hasLic ? normalizeLicenseKey(r.contractorLicenseKey) : null;

  return {
    id: r.id,
    permitNumber: r.permitNumber,
    description: r.description,
    category: r.category,
    status: sn.status,
    statusRaw: sn.statusRaw || r.status,
    statusNote: sn.statusNote || null,
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
      ? "License on permit — profile link only after exact license join"
      : "Contractor identity not confidently linked",
    joinAudit: {
      licenseKeyNorm: licNorm,
      method: hasLic ? "license_pending_profile_join" : "none",
      confidence: "none",
      label: hasLic
        ? "License present; Trust Report link requires exact key match in contractor DB"
        : "No license key — will not auto-join",
      candidateSlug: null,
      auditedAt: new Date().toISOString(),
    },
    sourceJurisdiction: r.sourceJurisdiction,
    sourceLabel: r.sourceLabel,
    retrievedAt: r.retrievedAt || data._meta?.updated || null,
    notes: r.notes,
  };
}

/**
 * Load permits for an address from Wave extracts (JSON) — DB path optional via join-db.
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
  /** Which license keys matched the activity index */
  matchedLicenseKeys: string[];
};

export function contractorActivityFromExtracts(
  licenseKeys: string[]
): ContractorActivityResult | null {
  const map = data.contractorActivityByLicense || {};
  let total = 0;
  const counties = new Set<string>();
  const categories = new Set<string>();
  const samples: string[] = [];
  const matchedLicenseKeys: string[] = [];
  let recent: string | null = null;
  let sourceLabel = "CTH permit activity extracts";
  let retrievedAt: string | null = null;
  let matched = false;

  for (const k of licenseKeys) {
    const norm = normalizeLicenseKey(k);
    if (!norm) continue;
    const row =
      map[k.toUpperCase()] ||
      map[norm] ||
      Object.entries(map).find(([key]) => normalizeLicenseKey(key) === norm)?.[1];
    if (!row) continue;
    matched = true;
    matchedLicenseKeys.push(norm);
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
    matchedLicenseKeys,
  };
}

export function extractStats() {
  const addressKeys = Object.keys(data.byAddressKey || {});
  let permitRows = 0;
  let withLicense = 0;
  const byJurisdiction: Record<string, number> = {};
  const licenseKeys = new Set<string>();

  for (const rows of Object.values(data.byAddressKey || {})) {
    for (const r of rows) {
      permitRows += 1;
      if (r.contractorLicenseKey) {
        withLicense += 1;
        const n = normalizeLicenseKey(r.contractorLicenseKey);
        if (n) licenseKeys.add(n);
      }
      const j = r.sourceJurisdiction || "unknown";
      byJurisdiction[j] = (byJurisdiction[j] || 0) + 1;
    }
  }

  const activityKeys = Object.keys(data.contractorActivityByLicense || {});
  const activityNorm = new Set(
    activityKeys.map((k) => normalizeLicenseKey(k)).filter(Boolean)
  );

  // License keys on permits that have no activity rollup row
  let unmatchedLicenseBearing = 0;
  for (const k of licenseKeys) {
    if (!activityNorm.has(k)) unmatchedLicenseBearing += 1;
  }

  // Join rate proxy: activity keys that appear on at least one permit
  let activityKeysWithPermit = 0;
  for (const k of activityNorm) {
    if (licenseKeys.has(k)) activityKeysWithPermit += 1;
  }

  return {
    addressKeys: addressKeys.length,
    permitRows,
    withLicenseKey: withLicense,
    withoutLicenseKey: permitRows - withLicense,
    activityLicenseKeys: activityKeys.length,
    licenseKeysOnPermits: licenseKeys.size,
    unmatchedLicenseBearingRows: unmatchedLicenseBearing,
    activityKeysAlsoOnPermits: activityKeysWithPermit,
    joinRateProxy:
      licenseKeys.size > 0
        ? Math.round((activityKeysWithPermit / licenseKeys.size) * 1000) / 10
        : 0,
    byJurisdiction,
    freshness: data._meta?.updated || null,
    waves: data._meta?.waves || [],
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
    permitGeo: [permit.sourceJurisdiction, permit.contractorName]
      .filter(Boolean)
      .join(" "),
    candidate,
  });

  const conf: PermitMatchConfidence =
    join.matchConfidence === "high" ? "license" : "none";

  const audit: PermitJoinAudit = {
    licenseKeyNorm: normalizeLicenseKey(permit.contractorLicenseKey) || null,
    method: join.matchMethod,
    confidence: join.matchConfidence,
    label: join.label,
    candidateSlug: join.slug,
    auditedAt: new Date().toISOString(),
  };

  return {
    ...permit,
    contractorSlug: join.slug,
    matchConfidence: conf,
    matchMethod: join.matchMethod,
    matchLabel: join.label,
    joinAudit: audit,
  };
}

/** All extract rows for ops / batch load (Wave extracts). */
export function getAllExtractRows(): Array<ExtractRow & { addressKey: string }> {
  const out: Array<ExtractRow & { addressKey: string }> = [];
  for (const [addressKey, rows] of Object.entries(data.byAddressKey || {})) {
    for (const r of rows) out.push({ ...r, addressKey });
  }
  return out;
}

export function getActivityMap(): Record<string, ActivityRow> {
  return data.contractorActivityByLicense || {};
}
