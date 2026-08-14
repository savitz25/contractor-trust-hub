/**
 * Louisiana LSLBC license-type labels.
 * Codes are product keys for published roster "Credential Type" values.
 */

export type LaLslbcTypeInfo = {
  code: string;
  plain: string;
  chip: string;
  official: string;
  family: "commercial" | "residential" | "specialty";
  scopeNote: string;
};

const BY_CODE: Record<string, Omit<LaLslbcTypeInfo, "code">> = {
  CLC: {
    plain: "Commercial contractor license",
    chip: "Commercial",
    official: "Commercial License Certificate",
    family: "commercial",
    scopeNote:
      "Louisiana LSLBC commercial license. Required for commercial projects at or above the published threshold. Confirm current status and classifications on the official LSLBC lookup.",
  },
  RLC: {
    plain: "Residential contractor license",
    chip: "Residential",
    official: "Residential License Certificate",
    family: "residential",
    scopeNote:
      "Louisiana LSLBC residential license. Required for residential construction at or above the published threshold. Confirm current status on the official LSLBC lookup.",
  },
  HIR: {
    plain: "Home improvement registration",
    chip: "Home improvement",
    official: "Home Improvement Registration",
    family: "specialty",
    scopeNote:
      "Louisiana LSLBC home improvement registration. This is not a commercial or residential construction license by itself. Confirm scope on the official LSLBC lookup.",
  },
  MRL: {
    plain: "Mold remediation license",
    chip: "Mold remediation",
    official: "Mold Remediation License Certificate",
    family: "specialty",
    scopeNote:
      "Louisiana LSLBC mold remediation license. Specialty credential — not a general construction license. Confirm current status on the official LSLBC lookup.",
  },
};

export function getLaLslbcTypeInfo(code: string | null | undefined): LaLslbcTypeInfo | null {
  if (!code) return null;
  const upper = code.toUpperCase();
  const row = BY_CODE[upper];
  if (!row) return null;
  return { code: upper, ...row };
}

export function laLslbcPlainLabel(code: string | null | undefined): string | null {
  return getLaLslbcTypeInfo(code)?.plain ?? null;
}

export function laLslbcDisplayLabel(
  code: string | null | undefined,
  description?: string | null
): string {
  if (description && description.trim()) return description.trim();
  return (
    laLslbcPlainLabel(code) ||
    (code ? `Louisiana LSLBC (${code.toUpperCase()})` : "Louisiana LSLBC license")
  );
}

export function laLslbcChipLabel(code: string | null | undefined): string {
  return getLaLslbcTypeInfo(code)?.chip ?? "Louisiana LSLBC";
}

export const LA_LSLBC_SEARCH_URL = "https://arlspublic.lslbc.louisiana.gov/Public/Search";
export const LA_LSLBC_ROSTER_URL = "https://arlspublic.lslbc.louisiana.gov/Public/RequestRoster";
export const LA_LSLBC_VERIFY_PAGE = "https://lslbc.gov/verify-licensure/";
export const LA_LSLBC_HOME_URL = "https://lslbc.gov/";
