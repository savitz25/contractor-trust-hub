/**
 * Oregon CCB license-type labels (statewide contractor board).
 * Codes come from data.oregon.gov dataset g77e-6bhs.
 */

export type OrCcbTypeInfo = {
  code: string;
  plain: string;
  chip: string;
  scopeNote: string;
};

const BY_CODE: Record<string, Omit<OrCcbTypeInfo, "code">> = {
  RGC: {
    plain: "Residential General Contractor",
    chip: "Residential GC",
    scopeNote:
      "Oregon CCB residential general contractor endorsement — confirm current status on the official CCB search.",
  },
  RSC: {
    plain: "Residential Specialty Contractor",
    chip: "Residential specialty",
    scopeNote:
      "Oregon CCB residential specialty endorsement. Scope is limited to the specialty — not automatically all residential work.",
  },
  CGC1: {
    plain: "Commercial General Contractor Level 1",
    chip: "Commercial GC 1",
    scopeNote: "Oregon CCB commercial general contractor (Level 1). Confirm status on the official CCB search.",
  },
  CGC2: {
    plain: "Commercial General Contractor Level 2",
    chip: "Commercial GC 2",
    scopeNote: "Oregon CCB commercial general contractor (Level 2). Confirm status on the official CCB search.",
  },
  CSC1: {
    plain: "Commercial Specialty Contractor Level 1",
    chip: "Commercial specialty 1",
    scopeNote: "Oregon CCB commercial specialty (Level 1). Limited to the endorsed specialty.",
  },
  CSC2: {
    plain: "Commercial Specialty Contractor Level 2",
    chip: "Commercial specialty 2",
    scopeNote: "Oregon CCB commercial specialty (Level 2). Limited to the endorsed specialty.",
  },
  RLC: {
    plain: "Residential Limited Contractor",
    chip: "Residential limited",
    scopeNote: "Oregon CCB residential limited contractor. Scope is narrower than residential general.",
  },
  LBPR: {
    plain: "Lead-Based Paint Renovation Contractor",
    chip: "Lead renovation",
    scopeNote: "Oregon CCB lead-based paint renovation credential — not a general contractor license by itself.",
  },
  OCHI: {
    plain: "Oregon Certified Home Inspector",
    chip: "Home inspector",
    scopeNote: "Oregon certified home inspector credential — not a construction contracting license.",
  },
  OCLS: {
    plain: "Oregon Certified Locksmith",
    chip: "Locksmith",
    scopeNote: "Oregon certified locksmith credential — not a general contractor license.",
  },
  RHISC: {
    plain: "Home Inspector Services Contractor",
    chip: "Inspector services",
    scopeNote: "Oregon CCB home inspector services contractor endorsement.",
  },
  RD: {
    plain: "Residential Developer",
    chip: "Residential developer",
    scopeNote: "Oregon CCB residential developer endorsement.",
  },
  RLSC: {
    plain: "Residential Locksmith Services Contractor",
    chip: "Locksmith services",
    scopeNote: "Oregon CCB residential locksmith services contractor.",
  },
  CD: {
    plain: "Commercial Developer",
    chip: "Commercial developer",
    scopeNote: "Oregon CCB commercial developer endorsement.",
  },
  RHSC: {
    plain: "Home Services Contractor",
    chip: "Home services",
    scopeNote: "Oregon CCB home services contractor endorsement.",
  },
  CF: {
    plain: "Construction Flagging Contractor",
    chip: "Flagging",
    scopeNote: "Oregon CCB construction flagging contractor — not a general contractor license.",
  },
  RHEPSC: {
    plain: "Home Energy Performance Score Contractor",
    chip: "Energy score",
    scopeNote: "Oregon CCB home energy performance score contractor.",
  },
  RRC: {
    plain: "Residential Restoration Contractor",
    chip: "Restoration",
    scopeNote: "Oregon CCB residential restoration contractor endorsement.",
  },
};

export function getOrCcbTypeInfo(code: string | null | undefined): OrCcbTypeInfo | null {
  if (!code) return null;
  const upper = code.toUpperCase();
  const row = BY_CODE[upper];
  if (!row) return null;
  return { code: upper, ...row };
}

export function orCcbPlainLabel(code: string | null | undefined): string | null {
  return getOrCcbTypeInfo(code)?.plain ?? null;
}

export function orCcbDisplayLabel(code: string | null | undefined): string {
  return orCcbPlainLabel(code) || (code ? `Oregon CCB (${code.toUpperCase()})` : "Oregon CCB license");
}

export function orCcbChipLabel(code: string | null | undefined): string {
  return getOrCcbTypeInfo(code)?.chip ?? "Oregon CCB";
}

export const OR_CCB_SEARCH_URL = "https://search.ccb.state.or.us/search/";
export const OR_CCB_HOME_URL = "https://www.oregon.gov/ccb/";
