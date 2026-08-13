/**
 * Multi-state product config. Florida is the live reference implementation.
 * Texas: TDLR specialty trades only (no statewide GC) — see docs/DATA_SOURCES_TX.md.
 * New Jersey: Stage 7 Verify pilot (registration-first) — see docs/STAGE_7_FL_DEPTH_AND_NJ_SPIKE.md.
 * Adding a state: extend this map + ingest adapters; UI reads from here.
 */

import { getOccupationInfo } from "@/lib/contractors/occupations";
import { isNjVerifyPilotEnabled } from "./feature-flags";
import { njCredentialPlainLabel } from "./nj-credentials";

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
  /** Pilot / partial product surface (e.g. NJ Verify-only) */
  pilot?: boolean;
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
    // No high-confidence statewide entity linker yet (unlike FL Sunbiz)
    entitySource: "tx_sos",
    live: true,
    coverageNote:
      "Texas does not issue a statewide general contractor license. Coverage is TDLR specialty trades only (e.g. electrical, A/C). Plumbing is under TSBPE (separate). Many general builders are city/county only.",
  },
  nj: {
    code: "NJ",
    slug: "nj",
    name: "New Jersey",
    shortName: "NJ",
    boardLabel: "New Jersey Division of Consumer Affairs (DCA) — contractor / HIC registration",
    boardUrl: "https://www.njconsumeraffairs.gov/",
    entityRegistryLabel: "NJ business entity records (high-confidence only when linked)",
    entityRegistryUrl: "https://www.njportal.com/DOR/BusinessRecords/",
    licenseSource: "nj_dca",
    entitySource: "nj_sos",
    // Stage 7 pilot — controlled by feature flag (default on)
    live: true,
    pilot: true,
    coverageNote:
      "New Jersey verification pilot (Stage 8A depth): home-improvement contractor registration, selected trade credentials, high-confidence entity links, and public enforcement rows when present in extracts. Not Florida-depth (no full permit history, studios, or protection journey). Coverage differs by state.",
  },
};

export const DEFAULT_STATE_SLUG = "fl";

export function getStateBySlug(slug: string): EvidenceState | null {
  const s = EVIDENCE_STATES[slug.toLowerCase()] ?? null;
  if (!s) return null;
  // NJ pilot can be disabled without removing config
  if (s.slug === "nj" && !isNjVerifyPilotEnabled()) {
    return { ...s, live: false };
  }
  return s;
}

export function getLiveStates(): EvidenceState[] {
  return Object.values(EVIDENCE_STATES)
    .map((s) => getStateBySlug(s.slug)!)
    .filter((s) => s.live);
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

/** Texas TDLR specialty codes — plain-language labels (see also lib/states/tx-trades.ts). */
export const TX_OCCUPATION_LABELS: Record<string, string> = {
  TEC: "Electrical Contractor",
  TAC: "Air Conditioning Contractor",
  TES: "Electrical Sign Contractor",
  TAP: "Appliance Installation Contractor",
  TEL: "Elevator Contractor",
  TWW: "Water Well Driller / Pump Installer",
  TME: "Master Electrician",
  TJE: "Journeyman Electrician",
  TAE: "Apprentice Electrician",
  TAI: "Appliance Installer",
};

/** New Jersey pilot occupation / credential codes */
export const NJ_OCCUPATION_LABELS: Record<string, string> = {
  HIC: "Home Improvement Contractor",
  ELE: "Electrical Contractor (NJ)",
  PLB: "Plumbing Contractor (NJ)",
  HVAC: "HVAC / Mechanical Contractor (NJ)",
  GEN: "General contractor registration (NJ)",
};

export function occupationLabel(code: string | null | undefined): string {
  if (!code) return "Construction license";
  const upper = code.toUpperCase();
  return (
    FL_OCCUPATION_LABELS[upper] ??
    TX_OCCUPATION_LABELS[upper] ??
    NJ_OCCUPATION_LABELS[upper] ??
    njCredentialPlainLabel(upper) ??
    getOccupationInfo(upper).label
  );
}
