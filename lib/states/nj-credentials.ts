/**
 * New Jersey credential labels for Verify pilot.
 * NJ regulation is not DBPR — do not force Florida occupation codes.
 */

export type NjCredentialInfo = {
  code: string;
  plain: string;
  chip: string;
  official?: string;
};

/** Common NJ credential / registration classes in pilot extracts */
export const NJ_CREDENTIAL_LABELS: Record<string, NjCredentialInfo> = {
  HIC: {
    code: "HIC",
    plain: "Home Improvement Contractor",
    chip: "Home improvement",
    official: "HIC registration",
  },
  ELE: {
    code: "ELE",
    plain: "Electrical Contractor (NJ)",
    chip: "Electrical",
  },
  PLB: {
    code: "PLB",
    plain: "Plumbing Contractor (NJ)",
    chip: "Plumbing",
  },
  HVAC: {
    code: "HVAC",
    plain: "HVAC / Mechanical Contractor (NJ)",
    chip: "HVAC",
  },
  GEN: {
    code: "GEN",
    plain: "General contractor registration (when present)",
    chip: "General",
  },
};

export function getNjCredentialInfo(code: string | null | undefined): NjCredentialInfo {
  if (!code) {
    return {
      code: "UNK",
      plain: "New Jersey contractor registration",
      chip: "Registration",
    };
  }
  const upper = code.toUpperCase();
  return (
    NJ_CREDENTIAL_LABELS[upper] || {
      code: upper,
      plain: code,
      chip: upper,
    }
  );
}

export function njCredentialPlainLabel(code: string | null | undefined): string {
  return getNjCredentialInfo(code).plain;
}

export const NJ_PILOT_COVERED = [
  "Home Improvement Contractor registration",
  "Selected trade credentials when present in extract",
] as const;

export const NJ_PILOT_NOT_COVERED = [
  "Full NJ permit / activity history",
  "Every municipal trade card",
  "Florida-style planning, studios, and protection journey",
] as const;
