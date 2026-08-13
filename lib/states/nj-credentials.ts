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
      "Electrical contractor or electrical business credentials in extracts relate to electrical work authorized under New Jersey trade rules for that class.",
    doesNotImply:
      "Does not replace local permitting, inspections, or proof of insurance. Confirm class and status for your specific job.",
  },
  TEL: {
    code: "TEL",
    plain: "Telecom Contractor (NJ)",
    chip: "Telecom",
    allows:
      "Telecom contractor business credentials relate to telecommunications contracting when required under New Jersey electrical board rules.",
    doesNotImply:
      "Not a general home-improvement registration and not a statewide GC credential.",
  },
  ALM: {
    code: "ALM",
    plain: "Alarm Contractor (NJ)",
    chip: "Alarm",
    allows:
      "Burglar / fire alarm business or individual licenses when present in official extracts.",
    doesNotImply:
      "Does not cover general remodeling or a general contractor endorsement. Confirm status for your job type.",
  },
  LCK: {
    code: "LCK",
    plain: "Locksmith (NJ)",
    chip: "Locksmith",
    allows:
      "Locksmith business or individual licenses when published in official DCA extracts.",
    doesNotImply:
      "Not a home-improvement contractor registration or general builder credential.",
  },
  PLB: {
    code: "PLB",
    plain: "Master Plumber (NJ)",
    chip: "Plumbing",
    allows:
      "Master Plumber credentials in current extracts relate to plumbing trade authorization when applicable under NJ rules.",
    doesNotImply:
      "Does not prove insurance, workers’ compensation, or municipal-only requirements are met. Journeyman/apprentice cards are not the default consumer set.",
  },
  HVAC: {
    code: "HVAC",
    plain: "Master HVACR Contractor (NJ)",
    chip: "HVAC",
    allows:
      "Master HVACR contractor credentials relate to heating, ventilation, air conditioning, or refrigeration work for that class when required.",
    doesNotImply:
      "Does not include full permit history or a general contractor endorsement.",
  },
  HRT: {
    code: "HRT",
    plain: "Master Hearth Specialist (NJ)",
    chip: "Hearth",
    allows:
      "Master Hearth Specialist credentials relate to hearth / solid-fuel appliance work when required under NJ rules.",
    doesNotImply:
      "Not a general home-improvement registration or statewide GC credential.",
  },
  GEN: {
    code: "GEN",
    plain: "General contractor registration (when present)",
    chip: "General",
    allows:
      "Some extracts include general contractor-style registration fields when the source publishes them. Coverage is source-dependent.",
    doesNotImply:
      "New Jersey has no single statewide general contractor license like Florida CGC/CBC/CRC. Always confirm the exact credential type with official sources.",
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
  "Home Improvement Contractor (HIC) registration (active Standard Files)",
  "Electrical, telecom, alarm, locksmith, master plumber, master HVACR, hearth when in bulk",
  "Inactive / expired specialty rows when present in all-status Standard Files",
  "Public discipline flags (Y/N) from Standard Files when present — no full case files",
] as const;

export const NJ_PILOT_NOT_COVERED = [
  "A single statewide general contractor license (does not exist in NJ)",
  "Expired / inactive HIC in Box Standard Files (HIC is active-only in that feed)",
  "Every municipal trade card / apprentices / CE-only cards",
  "Full permit history, studios, or Florida-depth journey",
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
