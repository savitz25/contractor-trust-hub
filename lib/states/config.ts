/**
 * Multi-state product config. Florida is the live reference implementation.
 * Texas: TDLR specialty trades + TSBPE plumbing (no statewide GC) — see docs/DATA_SOURCES_TX.md.
 * New Jersey: HIC + specialty boards via DCA (no statewide GC) — see docs/DATA_SOURCES_NJ.md.
 * Oregon: CCB statewide contractor licenses — see docs/DATA_SOURCES_OR.md.
 * California: CSLB top-county public list extracts — see docs/DATA_SOURCES_CA.md.
 * Adding a state: extend this map + ingest adapters; UI reads from here.
 */

import { getOccupationInfo } from "@/lib/contractors/occupations";
import { caClassPlainLabel } from "./ca-classifications";
import { isNjVerifyPilotEnabled } from "./feature-flags";
import { njCredentialPlainLabel } from "./nj-credentials";
import { orCcbPlainLabel } from "./or-ccb";

export type StateCode = "FL" | "TX" | "NJ" | "OR" | "CA";

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
  /** Additional license source_systems searched with licenseSource (e.g. TX TSBPE). */
  licenseSources?: string[];
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
    licenseSources: ["tx_tdlr", "tx_tsbpe"],
    // No high-confidence statewide entity linker yet (unlike FL Sunbiz)
    entitySource: "tx_sos",
    live: true,
    coverageNote:
      "Texas does not issue a statewide general contractor license. Coverage is TDLR specialty trades plus TSBPE plumbing. Many general builders are city/county only.",
  },
  nj: {
    code: "NJ",
    slug: "nj",
    name: "New Jersey",
    shortName: "NJ",
    boardLabel: "New Jersey Division of Consumer Affairs (DCA) — HIC + specialty boards",
    boardUrl: "https://www.njconsumeraffairs.gov/",
    entityRegistryLabel: "NJ business entity records (high-confidence only when linked)",
    entityRegistryUrl: "https://www.njportal.com/DOR/BusinessRecords/",
    licenseSource: "nj_dca",
    entitySource: "nj_sos",
    // Verify pilot — controlled by feature flag (default on). Not Florida-depth.
    live: true,
    pilot: true,
    coverageNote:
      "New Jersey does not issue a single statewide general contractor license. Coverage prioritizes Home Improvement Contractor (HIC) registrations (active Standard Files) plus specialty boards when loaded (electrical, telecom, alarm, locksmith, master plumber, master HVACR, hearth). Specialty inactive/expired rows are included when present; HIC inactive is not in Box Standard Files. Always confirm on the official DCA / MyLicense site.",
  },
  or: {
    code: "OR",
    slug: "or",
    name: "Oregon",
    shortName: "OR",
    boardLabel: "Oregon Construction Contractors Board (CCB)",
    boardUrl: "https://www.oregon.gov/ccb/",
    entityRegistryLabel: "Oregon SOS business registry (not yet linked)",
    entityRegistryUrl: "https://sos.oregon.gov/business/Pages/default.aspx",
    licenseSource: "or_ccb",
    entitySource: "or_sos",
    live: true,
    coverageNote:
      "Oregon licenses contractors statewide through the CCB. This search uses the official Active Licenses open-data extract. Bond and insurance fields are as published — not a live certificate check. Always confirm on the official CCB site.",
  },
  ca: {
    code: "CA",
    slug: "ca",
    name: "California",
    shortName: "CA",
    boardLabel: "California Contractors State License Board (CSLB)",
    boardUrl: "https://www.cslb.ca.gov/",
    entityRegistryLabel: "California SOS business entities (not yet linked)",
    entityRegistryUrl: "https://bizfileonline.sos.ca.gov/",
    licenseSource: "ca_cslb",
    entitySource: "ca_sos",
    // Live once load + Verify path are ready (set true after production load)
    live: true,
    pilot: true,
    coverageNote:
      "California licenses contractors statewide through CSLB. This extract covers high-impact counties from official public list downloads — not every county file. Always confirm current status on CSLB Instant License Check. Bond and workers’ comp fields are as published, not live certificates.",
  },
};

export const DEFAULT_STATE_SLUG = "fl";

export function getStateBySlug(slug: string): EvidenceState | null {
  const key = slug.toLowerCase();
  const mapped =
    key === "oregon" ? "or" : key === "california" ? "ca" : key;
  const s = EVIDENCE_STATES[mapped] ?? null;
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

export function licenseSourcesFor(state: EvidenceState): string[] {
  if (state.licenseSources && state.licenseSources.length > 0) {
    return state.licenseSources;
  }
  return [state.licenseSource];
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
  TRMP: "Plumbing — Responsible Master Plumber",
  TMP: "Plumbing — Master Plumber",
  TJP: "Plumbing — Journeyman Plumber",
  TTP: "Plumbing — Tradesman Plumber-Limited",
};

/** New Jersey pilot occupation / credential codes */
export const NJ_OCCUPATION_LABELS: Record<string, string> = {
  HIC: "Home Improvement Contractor",
  ELE: "Electrical Contractor (NJ)",
  TEL: "Telecom Contractor (NJ)",
  ALM: "Alarm Contractor (NJ)",
  LCK: "Locksmith (NJ)",
  PLB: "Master Plumber (NJ)",
  HVAC: "Master HVACR Contractor (NJ)",
  HRT: "Master Hearth Specialist (NJ)",
  GEN: "General contractor registration (NJ)",
};

export function occupationLabel(code: string | null | undefined): string {
  if (!code) return "Construction license";
  const upper = code.toUpperCase().replace(/-/g, "");
  return (
    FL_OCCUPATION_LABELS[upper] ??
    TX_OCCUPATION_LABELS[upper] ??
    NJ_OCCUPATION_LABELS[upper] ??
    caClassPlainLabel(upper) ??
    orCcbPlainLabel(upper) ??
    njCredentialPlainLabel(upper) ??
    getOccupationInfo(upper).label
  );
}
