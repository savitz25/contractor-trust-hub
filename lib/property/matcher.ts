/**
 * Stage 6 contractor ↔ permit join rulebook.
 * Precision over recall — false joins are worse than empty links.
 */

export type MatchMethod = "license" | "license_name_geo" | "none";

export type PermitJoinInput = {
  contractorLicenseKey?: string | null;
  contractorName?: string | null;
  /** ZIP or city from permit row */
  permitGeo?: string | null;
  /** Candidate from DB: license key, display/legal names, city/zip */
  candidate?: {
    slug: string;
    licenseKeys: string[];
    names: string[];
    city?: string | null;
    zip?: string | null;
  } | null;
};

export type PermitJoinResult = {
  slug: string | null;
  matchMethod: MatchMethod;
  matchConfidence: "high" | "none";
  label: string;
};

export function normalizeLicenseKey(key: string | null | undefined): string {
  if (!key) return "";
  return key.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function normalizePersonOrBizName(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toUpperCase()
    .replace(/[.,'"/\\-]/g, " ")
    .replace(/\b(INC|LLC|L L C|CORP|CORPORATION|CO|COMPANY|LTD|PLLC|PA|LP|THE)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Common personal/business tokens that must not drive name-only joins. */
const WEAK_NAME_TOKENS = new Set([
  "CONSTRUCTION",
  "CONTRACTING",
  "SERVICES",
  "ROOFING",
  "PLUMBING",
  "ELECTRIC",
  "ELECTRICAL",
  "BUILDERS",
  "BUILDER",
  "GROUP",
  "ENTERPRISES",
  "SOLUTIONS",
]);

export function nameHasDistinctiveToken(name: string): boolean {
  const n = normalizePersonOrBizName(name);
  if (n.length < 8) return false;
  const tokens = n.split(" ").filter((t) => t.length >= 3 && !WEAK_NAME_TOKENS.has(t));
  return tokens.length >= 2;
}

export function namesStronglyMatch(a: string, b: string): boolean {
  const na = normalizePersonOrBizName(a);
  const nb = normalizePersonOrBizName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length < 10 || nb.length < 10) return false;
  if (!nameHasDistinctiveToken(na) || !nameHasDistinctiveToken(nb)) return false;
  return na.includes(nb) || nb.includes(na);
}

export function geoConsistent(
  permitGeo: string | null | undefined,
  candidateCity?: string | null,
  candidateZip?: string | null
): boolean {
  if (!permitGeo) return false;
  const g = permitGeo.toUpperCase().replace(/\s+/g, "");
  if (candidateZip && g.includes(candidateZip)) return true;
  if (candidateCity) {
    const c = candidateCity.toUpperCase().replace(/\s+/g, "");
    if (c.length >= 4 && g.includes(c)) return true;
  }
  return false;
}

/**
 * Preferred order:
 * 1. Exact license number
 * 2. Strong license + name + geo (license already required on candidate)
 * 3. Otherwise do not join
 *
 * Never invent slugs from name alone.
 */
export function resolvePermitContractorJoin(input: PermitJoinInput): PermitJoinResult {
  const key = normalizeLicenseKey(input.contractorLicenseKey);
  const cand = input.candidate;

  if (!cand) {
    return {
      slug: null,
      matchMethod: "none",
      matchConfidence: "none",
      label: key
        ? "License on permit — contractor profile not confidently linked"
        : "Contractor identity not confidently linked",
    };
  }

  const candKeys = cand.licenseKeys.map(normalizeLicenseKey).filter(Boolean);

  // 1. Exact license
  if (key && candKeys.includes(key)) {
    return {
      slug: cand.slug,
      matchMethod: "license",
      matchConfidence: "high",
      label: "Matched by license number",
    };
  }

  // 2. If permit has license that doesn't match candidate keys — refuse
  if (key && candKeys.length > 0 && !candKeys.includes(key)) {
    return {
      slug: null,
      matchMethod: "none",
      matchConfidence: "none",
      label: "License on permit does not match this profile",
    };
  }

  // 3. Strong name + geo only when candidate has a license key already known
  //    and permit name strongly matches — still requires permit license OR we refuse.
  //    Spec: "Strong license + name + geo consistency" — needs license field present.
  if (
    key &&
    candKeys.length > 0 &&
    input.contractorName &&
    cand.names.some((n) => namesStronglyMatch(n, input.contractorName!)) &&
    geoConsistent(input.permitGeo, cand.city, cand.zip)
  ) {
    // License key on permit must still equal one of candidate keys for high confidence
    // (already failed exact above — so this path is for formatted variants already normalized)
    return {
      slug: null,
      matchMethod: "none",
      matchConfidence: "none",
      label: "Contractor identity not confidently linked",
    };
  }

  // Explicit: never name-only
  if (input.contractorName && !key) {
    return {
      slug: null,
      matchMethod: "none",
      matchConfidence: "none",
      label: "Name-only contractor data — not auto-linked",
    };
  }

  return {
    slug: null,
    matchMethod: "none",
    matchConfidence: "none",
    label: "Contractor identity not confidently linked",
  };
}

/** Normalize street for address_key matching across extracts. */
export function normalizeStreetKey(street: string): string {
  return street
    .toUpperCase()
    .replace(/\./g, "")
    .replace(/\b(STREET|ST)\b/g, "ST")
    .replace(/\b(AVENUE|AVE)\b/g, "AVE")
    .replace(/\b(BOULEVARD|BLVD)\b/g, "BLVD")
    .replace(/\b(DRIVE|DR)\b/g, "DR")
    .replace(/\b(ROAD|RD)\b/g, "RD")
    .replace(/\b(LANE|LN)\b/g, "LN")
    .replace(/\b(COURT|CT)\b/g, "CT")
    .replace(/\b(PLACE|PL)\b/g, "PL")
    .replace(/\b(CIRCLE|CIR)\b/g, "CIR")
    .replace(/\b(TERRACE|TER)\b/g, "TER")
    .replace(/\b(HIGHWAY|HWY)\b/g, "HWY")
    .replace(/\b(NORTH|N)\b/g, "N")
    .replace(/\b(SOUTH|S)\b/g, "S")
    .replace(/\b(EAST|E)\b/g, "E")
    .replace(/\b(WEST|W)\b/g, "W")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildAddressKey(street: string, zip: string, unit?: string): string {
  const s = normalizeStreetKey(street);
  const u = unit ? normalizeStreetKey(unit) : "";
  return u ? `${s}|${u}|${zip}` : `${s}|${zip}`;
}
