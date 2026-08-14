/**
 * Wisconsin DSPS / LicensE labels.
 * Dwelling Contractor is a 1–2 family permit credential, not a commercial GC.
 */

export type WiDspsTypeInfo = {
  code: string;
  plain: string;
  chip: string;
  official: string;
  family: "dwelling" | "electrical" | "hvac" | "plumbing" | "other";
  firmLevel: boolean;
};

const BY_CODE: Record<string, Omit<WiDspsTypeInfo, "code">> = {
  DC: {
    plain: "Dwelling contractor (1–2 family permit)",
    chip: "Dwelling contractor",
    official: "Dwelling Contractor",
    family: "dwelling",
    firmLevel: true,
  },
  DCR: {
    plain: "Dwelling contractor restricted",
    chip: "Dwelling restricted",
    official: "Dwelling Contractor Restricted",
    family: "dwelling",
    firmLevel: true,
  },
  DCQ: {
    plain: "Dwelling contractor qualifier",
    chip: "Dwelling qualifier",
    official: "Dwelling Contractor Qualifier",
    family: "dwelling",
    firmLevel: false,
  },
  EC: {
    plain: "Electrical contractor",
    chip: "Electrical",
    official: "Electrical Contractor",
    family: "electrical",
    firmLevel: true,
  },
  HVACCONT: {
    plain: "HVAC contractor",
    chip: "HVAC",
    official: "HVAC Contractor",
    family: "hvac",
    firmLevel: true,
  },
  HVACQ: {
    plain: "HVAC qualifier",
    chip: "HVAC qualifier",
    official: "HVAC Qualifier",
    family: "hvac",
    firmLevel: false,
  },
  ME: {
    plain: "Master electrician",
    chip: "Master electrician",
    official: "Master Electrician",
    family: "electrical",
    firmLevel: false,
  },
  PM: {
    plain: "Master plumber",
    chip: "Master plumber",
    official: "Master Plumber",
    family: "plumbing",
    firmLevel: false,
  },
};

export function getWiDspsTypeInfo(code: string | null | undefined): WiDspsTypeInfo | null {
  if (!code) return null;
  const upper = code.toUpperCase();
  const row = BY_CODE[upper];
  if (!row) return null;
  return { code: upper, ...row };
}

export function wiDspsPlainLabel(code: string | null | undefined): string | null {
  return getWiDspsTypeInfo(code)?.plain ?? null;
}

export const WI_DSPS_LOOKUP_URL = "https://license.wi.gov/s/license-lookup";
export const WI_DSPS_HUB_URL = "https://dsps.wi.gov/Pages/SelfService/LicenseLookUp.aspx";
export const WI_DSPS_HOME_URL = "https://dsps.wi.gov/pages/Home.aspx";
