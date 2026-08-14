/**
 * Washington L&I contractor verify labels (thin Verify path).
 */

export const WA_LNI_SEARCH_URL =
  "https://secure.lni.wa.gov/verify/";
export const WA_LNI_VERIFY_URL = WA_LNI_SEARCH_URL;

export const WA_PILOT_COVERED = [
  "Statewide Washington L&I contractor licensing extract",
  "License / UBI-style contractor numbers and business names",
  "Status and trade / specialty class when published",
  "City / state when present",
] as const;

export const WA_PILOT_NOT_COVERED = [
  "Florida-depth planning, studios, or passport journey",
  "Live bond / insurance certificate verification",
  "Automatic SOS entity linkage",
  "Full disciplinary case narrative beyond what is linked in extracts",
] as const;

export function waOccupationPlainLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  const u = code.trim().toUpperCase();
  if (u === "CC") return "Construction contractor";
  return null;
}

export function waLniDisplayLabel(code: string | null | undefined): string {
  return waOccupationPlainLabel(code) || (code ? `Washington L&I (${code})` : "Washington L&I license");
}

export function getWaLniTypeInfo(code: string | null | undefined) {
  const plain = waOccupationPlainLabel(code);
  if (!code && !plain) return null;
  return {
    code: (code || "").toUpperCase(),
    chip: plain || "L&I",
    plain: waLniDisplayLabel(code),
    official: code || "L&I",
    scopeNote:
      "Washington L&I contractor license as published on the official extract. Confirm on L&I Verify.",
  };
}
