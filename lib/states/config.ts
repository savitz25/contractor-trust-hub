/**
 * Multi-state product config. Florida is the live reference implementation.
 * Texas: TDLR specialty trades only (no statewide GC) — see docs/DATA_SOURCES_TX.md.
 * Adding a state: extend this map + ingest adapters; UI reads from here.
 */

import { getOccupationInfo } from "@/lib/contractors/occupations";

export type StateCode = "FL" | "TX" | "NJ";

export type EvidenceState = {
  code: StateCode;
  slug: string;
  name: string;
  shortName: string;
  /** Primary license board label */
  boardLabel: string;
  boardUrl: string;
  entityRegistryLabel: string;
  entityRegistryUrl: string;
  /** License source_system in DB */
  licenseSource: string;
  /** Corporate entity source_system for high-confidence links */
  entitySource: string;
  live: boolean;
  /**
   * Optional honest coverage note for product UI (required for partial-coverage states).
   */
  coverageNote?: string;
};

export const EVIDENCE_STATES: Record<string, EvidenceState> = {
  fl: {
    code: "FL",
    slug: "fl",
    name: "Florida",
    shortName: "FL",
    boardLabel: "Florida DBPR — Construction Industry Licensing Board",
    boardUrl: "https://www2.myfloridalicense.com/construction-industry/",
    entityRegistryLabel: "Florida Division of Corporations (Sunbiz)",
    entityRegistryUrl: "https://dos.fl.gov/sunbiz/",
    licenseSource: "fl_dbpr",
    entitySource: "fl_sunbiz",
    live: true,
  },
  tx: {
    code: "TX",
    slug: "tx",
    name: "Texas",
    shortName: "TX",
    boardLabel: "Texas Department of Licensing and Regulation (TDLR)",
    boardUrl: "https://www.tdlr.texas.gov/",
    entityRegistryLabel: "Texas SOS / Comptroller entity data (not yet linked)",
    entityRegistryUrl: "https://www.sos.state.tx.us/",
    licenseSource: "tx_tdlr",
    entitySource: "tx_sos",
    // Flip to true only after TDLR load + Verify path are solid
    live: false,
    coverageNote:
      "Texas does not issue a statewide general contractor license. Coverage is TDLR specialty trades only (e.g. electrical, A/C). Plumbing is under TSBPE (separate). Many general builders are city/county only.",
  },
  nj: {
    code: "NJ",
    slug: "nj",
    name: "New Jersey",
    shortName: "NJ",
    boardLabel: "New Jersey DCA (planned)",
    boardUrl: "https://www.nj.gov/dca/",
    entityRegistryLabel: "NJ Business Gateway (planned)",
    entityRegistryUrl: "https://www.njportal.com/",
    licenseSource: "nj_dca",
    entitySource: "nj_sos",
    live: false,
  },
};

export const DEFAULT_STATE_SLUG = "fl";

export function getStateBySlug(slug: string): EvidenceState | null {
  return EVIDENCE_STATES[slug.toLowerCase()] ?? null;
}

export function getLiveStates(): EvidenceState[] {
  return Object.values(EVIDENCE_STATES).filter((s) => s.live);
}

/** Occupation codes seen in FL DBPR construction extract (subset of common labels). */
export const FL_OCCUPATION_LABELS: Record<string, string> = {
  CBC: "Certified Building Contractor",
  CGC: "Certified General Contractor",
  CRC: "Certified Residential Contractor",
  CCC: "Certified Roofing Contractor",
  CFC: "Certified Plumbing Contractor",
  CAC: "Certified Air Conditioning Contractor",
  CMC: "Certified Mechanical Contractor",
  CPC: "Certified Pool/Spa Contractor",
  CUC: "Certified Underground Utility Contractor",
  SCC: "Certified Specialty Structure Contractor",
  FRO: "Financially Responsible Officer",
  QB: "Qualifying Business",
  RR: "Registered Roofing Contractor",
  RF: "Registered Specialty",
};

/** Texas TDLR specialty codes used by tx_tdlr adapter (not a GC taxonomy). */
export const TX_OCCUPATION_LABELS: Record<string, string> = {
  TEC: "Electrical Contractor (TDLR)",
  TAC: "A/C Contractor (TDLR)",
  TES: "Electrical Sign Contractor (TDLR)",
  TAP: "Appliance Installation Contractor (TDLR)",
  TEL: "Elevator Contractor (TDLR)",
  TWW: "Water Well Driller/Pump Installer (TDLR)",
  TME: "Master Electrician (TDLR)",
  TJE: "Journeyman Electrician (TDLR)",
  TAE: "Apprentice Electrician (TDLR)",
  TAI: "Appliance Installer (TDLR)",
};

export function occupationLabel(code: string | null | undefined): string {
  if (!code) return "Construction license";
  const upper = code.toUpperCase();
  return (
    FL_OCCUPATION_LABELS[upper] ??
    TX_OCCUPATION_LABELS[upper] ??
    getOccupationInfo(upper).label
  );
}
