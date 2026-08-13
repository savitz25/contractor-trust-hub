/**
 * New Jersey credential labels + educational notes for Verify depth (Stage 8A).
 * NJ regulation is not DBPR — do not force Florida occupation codes.
 */

export type NjCredentialInfo = {
  code: string;
  plain: string;
  chip: string;
  official?: string;
  /** What this credential typically covers (educational) */
  allows: string;
  /** What it does not imply */
  doesNotImply: string;
};

export const NJ_CREDENTIAL_LABELS: Record<string, NjCredentialInfo> = {
  HIC: {
    code: "HIC",
    plain: "Home Improvement Contractor",
    chip: "Home improvement",
    official: "HIC registration",
    allows:
      "Home-improvement contractor registration is a common New Jersey consumer-facing credential for residential improvement work when required by state rules.",
    doesNotImply:
      "Registration alone is not a quality rating, insurance proof, or guarantee of permit compliance. Confirm current status on official New Jersey tools and local permit requirements.",
  },
  ELE: {
    code: "ELE",
    plain: "Electrical Contractor (NJ)",
    chip: "Electrical",
    allows:
      "Electrical contractor credentials, when present in extracts, relate to electrical work authorized under New Jersey trade rules for that class.",
    doesNotImply:
      "Does not replace local permitting, inspections, or proof of insurance. Confirm class and status for your specific job.",
  },
  PLB: {
    code: "PLB",
    plain: "Plumbing Contractor (NJ)",
    chip: "Plumbing",
    allows:
      "Plumbing contractor credentials in current extracts relate to plumbing trade authorization when applicable under NJ rules.",
    doesNotImply:
      "Does not prove insurance, workers’ compensation, or municipal-only requirements are met.",
  },
  HVAC: {
    code: "HVAC",
    plain: "HVAC / Mechanical Contractor (NJ)",
    chip: "HVAC",
    allows:
      "HVAC / mechanical credentials in extracts relate to heating, ventilation, air conditioning, or mechanical work for that class when required.",
    doesNotImply:
      "Does not include full permit history or a general contractor endorsement.",
  },
  GEN: {
    code: "GEN",
    plain: "General contractor registration (when present)",
    chip: "General",
    allows:
      "Some extracts include general contractor-style registration fields when the source publishes them. Coverage is source-dependent.",
    doesNotImply:
      "Not equivalent to a Florida CGC/CBC/CRC class map. Always confirm the exact credential type with official sources.",
  },
};

export function getNjCredentialInfo(code: string | null | undefined): NjCredentialInfo {
  if (!code) {
    return {
      code: "UNK",
      plain: "New Jersey contractor registration",
      chip: "Registration",
      allows:
        "Credential type was not classified in current extracts. Treat as registration evidence only.",
      doesNotImply:
        "Missing class labels are not a clearance — confirm the exact credential on official New Jersey tools.",
    };
  }
  const upper = code.toUpperCase();
  return (
    NJ_CREDENTIAL_LABELS[upper] || {
      code: upper,
      plain: code,
      chip: upper,
      allows: "Credential type as published in the source extract.",
      doesNotImply:
        "Confirm current status and scope on official New Jersey tools before hiring.",
    }
  );
}

export function njCredentialPlainLabel(code: string | null | undefined): string {
  return getNjCredentialInfo(code).plain;
}

export const NJ_PILOT_COVERED = [
  "Home Improvement Contractor registration",
  "Selected trade credentials when present in extract",
  "High-confidence business entity links when matched",
  "Public enforcement rows when linked in extract",
] as const;

export const NJ_PILOT_NOT_COVERED = [
  "Full NJ permit / activity history",
  "Every municipal trade card",
  "Live insurance / COI verification",
  "Florida-style planning, studios, and protection journey",
] as const;

export const NJ_SOURCE_MATRIX = [
  {
    id: "nj_dca",
    label: "NJ DCA / HIC registration extract",
    includes: "Registration keys, status, credential type, location when present",
    gaps: "Not every municipal credential; field gaps vary by source file",
  },
  {
    id: "nj_sos",
    label: "NJ business entity records (high-confidence only)",
    includes: "Legal name, status, formation date, principal when linked strictly",
    gaps: "No name-only entity joins; many registrants may have no link yet",
  },
  {
    id: "nj_enforcement",
    label: "Public enforcement / action records",
    includes: "Factual rows when present in extract (case id, disposition, date)",
    gaps: "Absence of a row is not a clearance; full case files may lag",
  },
] as const;
