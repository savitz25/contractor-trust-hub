/**
 * Mississippi State Board of Contractors (MSBOC) type / class labels.
 * Codes are product keys for published Type + official license suffix.
 */

export type MsSbcTypeInfo = {
  code: string;
  plain: string;
  chip: string;
  official: string;
  family: "commercial" | "residential" | "specialty";
  scopeNote: string;
};

const BY_CODE: Record<string, Omit<MsSbcTypeInfo, "code">> = {
  COM: {
    plain: "Commercial contractor license",
    chip: "Commercial",
    official: "Commercial",
    family: "commercial",
    scopeNote:
      "Mississippi State Board of Contractors commercial license. Confirm current status and classifications on the official MSBOC lookup.",
  },
  RES: {
    plain: "Residential contractor license",
    chip: "Residential",
    official: "Residential",
    family: "residential",
    scopeNote:
      "Mississippi State Board of Contractors residential license. Confirm current status on the official MSBOC lookup.",
  },
  MC: {
    plain: "Commercial contractor license (major)",
    chip: "Commercial · major",
    official: "Commercial (MC)",
    family: "commercial",
    scopeNote:
      "Mississippi MSBOC commercial license with official major-commercial (-MC) suffix. Confirm current status and classifications on the official MSBOC lookup.",
  },
  SC: {
    plain: "Commercial specialty contractor license",
    chip: "Commercial · specialty",
    official: "Commercial (SC)",
    family: "specialty",
    scopeNote:
      "Mississippi MSBOC commercial specialty license with official specialty-commercial (-SC) suffix. This is not a residential builder license by itself. Confirm scope on the official MSBOC lookup.",
  },
};

export function getMsSbcTypeInfo(code: string | null | undefined): MsSbcTypeInfo | null {
  if (!code) return null;
  const upper = code.toUpperCase();
  const row = BY_CODE[upper];
  if (!row) return null;
  return { code: upper, ...row };
}

export function msSbcPlainLabel(code: string | null | undefined): string | null {
  return getMsSbcTypeInfo(code)?.plain ?? null;
}

export function msSbcDisplayLabel(
  code: string | null | undefined,
  description?: string | null
): string {
  if (description && description.trim()) return description.trim();
  return (
    msSbcPlainLabel(code) ||
    (code ? `Mississippi MSBOC (${code.toUpperCase()})` : "Mississippi MSBOC license")
  );
}

export function msSbcChipLabel(code: string | null | undefined): string {
  return getMsSbcTypeInfo(code)?.chip ?? "Mississippi MSBOC";
}

export const MS_SBC_SEARCH_URL = "http://search.msboc.us/ConsolidatedSearch.cfm";
export const MS_SBC_RESULTS_URL = "http://search.msboc.us/ConsolidatedResults.cfm";
export const MS_SBC_HIRE_URL = "https://www.msboc.us/consumers/hire-a-contractor/";
export const MS_SBC_HOME_URL = "https://www.msboc.us/";
export const MS_SBC_CLASSIFICATIONS_URL = "https://www.msboc.us/classifications/";

/** Strong searches from the official Excel load (2026-08-14). */
export const MS_SBC_SAMPLE_QUERIES = [
  { q: "22954-MC", label: "22954-MC", hint: "Licensed commercial major · Forest" },
  { q: "3S HOMES", label: "3S HOMES", hint: "Licensed residential · Brandon" },
  { q: "18419-SC", label: "18419-SC", hint: "Licensed commercial specialty" },
] as const;

export function msSbcPublishedNumber(
  keyOrNumber: string | null | undefined
): string | null {
  if (!keyOrNumber) return null;
  const trimmed = keyOrNumber.trim();
  if (!trimmed || /^MS-SBC:UNLIC:/i.test(trimmed)) return null;
  const rest = trimmed.replace(/^MS-SBC:(?:COM|RES|OTH):/i, "").replace(/^MS-SBC:/i, "");
  return rest || null;
}

export function msSbcSuffixCode(licenseNumber: string | null | undefined): "MC" | "SC" | null {
  const m = (licenseNumber || "").toUpperCase().match(/-([A-Z]{2})$/);
  if (m?.[1] === "MC" || m?.[1] === "SC") return m[1];
  return null;
}
