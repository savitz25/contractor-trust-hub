/**
 * Kentucky DHBC specialty labels. Not a statewide GC.
 */

export type KyDhbcTypeInfo = {
  code: string;
  plain: string;
  chip: string;
  official: string;
  family: "electrical" | "hvac" | "plumbing" | "fire" | "other";
  firmLevel: boolean;
};

const BY_CODE: Record<string, Omit<KyDhbcTypeInfo, "code">> = {
  ELEC: {
    plain: "Electrical contractor (business)",
    chip: "Electrical",
    official: "Contractor Electrician-Business",
    family: "electrical",
    firmLevel: true,
  },
  ELE: {
    plain: "Electrical contractor (business)",
    chip: "Electrical",
    official: "Contractor Electrician-Business",
    family: "electrical",
    firmLevel: true,
  },
  HVAC: {
    plain: "Master HVAC contractor",
    chip: "HVAC",
    official: "Master HVAC Contractor",
    family: "hvac",
    firmLevel: true,
  },
  PLB: {
    plain: "Master plumber",
    chip: "Plumbing",
    official: "Master Plumber",
    family: "plumbing",
    firmLevel: true,
  },
  FIRE: {
    plain: "Fire-protection contractor",
    chip: "Fire protection",
    official: "Fire Protection contractor license",
    family: "fire",
    firmLevel: true,
  },
  MEL: {
    plain: "Master electrician",
    chip: "Master electrician",
    official: "Master Electrician",
    family: "electrical",
    firmLevel: false,
  },
};

export function getKyDhbcTypeInfo(code: string | null | undefined): KyDhbcTypeInfo | null {
  if (!code) return null;
  const upper = code.toUpperCase();
  const row = BY_CODE[upper];
  if (!row) return null;
  return { code: upper, ...row };
}

export function kyDhbcPlainLabel(code: string | null | undefined): string | null {
  return getKyDhbcTypeInfo(code)?.plain ?? null;
}

export const KY_DHBC_SEARCH_URL = "https://dhbc.ky.gov/Search/HBC_List_Licensees.aspx";
export const KY_DHBC_OVERVIEW_URL = "https://dhbc.ky.gov/newstatic_Info.aspx?static_ID=573";
export const KY_DHBC_HOME_URL = "https://dhbc.ky.gov/";
