/**
 * Multi-state product config. Florida is the live reference implementation.
 * Texas: TDLR specialty trades + TSBPE plumbing (no statewide GC) — see docs/DATA_SOURCES_TX.md.
 * New Jersey: HIC + specialty boards via DCA (no statewide GC) — see docs/DATA_SOURCES_NJ.md.
 * Oregon: CCB statewide contractor licenses — see docs/DATA_SOURCES_OR.md.
 * California: CSLB top-county public list extracts — see docs/DATA_SOURCES_CA.md.
 * Arizona: ROC current active posting lists — see docs/DATA_SOURCES_AZ.md.
 * Washington: L&I contractor extract — Verify-first.
 * Adding a state: extend this map + ingest adapters; UI reads from here.
 */

import { getOccupationInfo } from "@/lib/contractors/occupations";
import { azClassPlainLabel } from "./az-roc";
import { caClassPlainLabel } from "./ca-classifications";
import { isNjVerifyPilotEnabled } from "./feature-flags";
import { njCredentialPlainLabel } from "./nj-credentials";
import { orCcbPlainLabel } from "./or-ccb";
import { waOccupationPlainLabel } from "./wa-lni";

export type StateCode = "FL" | "TX" | "NJ" | "OR" | "WA" | "CA" | "AZ";

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
      "California statewide CSLB licensing. Current dataset prioritizes top high-impact counties from official CSLB list extracts. Always confirm live status on CSLB Instant License Check. Bond and workers’ comp fields are as published — not live certificates. No discipline invented from list files.",
  },
  wa: {
    code: "WA",
    slug: "wa",
    name: "Washington",
    shortName: "WA",
    boardLabel: "Washington Department of Labor & Industries (L&I)",
    boardUrl: "https://www.lni.wa.gov/",
    entityRegistryLabel: "Washington SOS business registry (not yet linked)",
    entityRegistryUrl: "https://www.sos.wa.gov/corps/",
    licenseSource: "wa_lni",
    entitySource: "wa_sos",
    live: true,
    pilot: true,
    coverageNote:
      "Washington licenses contractors statewide through L&I. This search uses the official contractor extract. Always confirm live status on L&I Verify. Not Florida-depth planning tools.",
  },
  az: {
    code: "AZ",
    slug: "az",
    name: "Arizona",
    shortName: "AZ",
    boardLabel: "Arizona Registrar of Contractors (ROC)",
    boardUrl: "https://roc.az.gov/",
    entityRegistryLabel: "Arizona Corporation Commission (not yet linked)",
    entityRegistryUrl: "https://ecorp.azcc.gov/",
    licenseSource: "az_roc",
    entitySource: "az_acc",
    live: true,
    pilot: true,
    coverageNote:
      "Arizona licenses contractors statewide through the ROC. This search uses the official current active contractor posting list (residential, commercial, and dual) plus linked disciplinary actions when present. Always confirm on the official ROC contractor search.",
  },
};

export const DEFAULT_STATE_SLUG = "fl";

/** Stable display order for homepage + Verify tabs */
export const LIVE_STATE_ORDER = ["fl", "tx", "nj", "or", "wa", "ca", "az"] as const;

export function getStateBySlug(slug: string): EvidenceState | null {
  const key = slug.toLowerCase();
  const mapped =
    key === "oregon"
      ? "or"
      : key === "california"
        ? "ca"
        : key === "arizona"
          ? "az"
          : key === "washington"
            ? "wa"
            : key;
  const s = EVIDENCE_STATES[mapped] ?? null;
  if (!s) return null;
  // NJ pilot can be disabled without removing config
  if (s.slug === "nj" && !isNjVerifyPilotEnabled()) {
    return { ...s, live: false };
  }
  return s;
}

export function getLiveStates(): EvidenceState[] {
  const ordered = LIVE_STATE_ORDER.map((slug) => getStateBySlug(slug)).filter(
    (s): s is EvidenceState => Boolean(s?.live)
  );
  const extras = Object.values(EVIDENCE_STATES)
    .map((s) => getStateBySlug(s.slug))
    .filter((s): s is EvidenceState => Boolean(s?.live && !ordered.some((o) => o.slug === s.slug)));
  return [...ordered, ...extras];
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
  // Keep original code for hyphenated AZ/CA class forms (CR-3, C-10)
  const raw = code.trim();
  return (
    FL_OCCUPATION_LABELS[upper] ??
    TX_OCCUPATION_LABELS[upper] ??
    NJ_OCCUPATION_LABELS[upper] ??
    azClassPlainLabel(raw) ??
    azClassPlainLabel(upper) ??
    caClassPlainLabel(raw) ??
    caClassPlainLabel(upper) ??
    orCcbPlainLabel(upper) ??
    waOccupationPlainLabel(upper) ??
    njCredentialPlainLabel(upper) ??
    getOccupationInfo(upper).label
  );
}

/** Short scope labels for homepage / pickers (honest, not marketing). */
export const STATE_SCOPE_UI: Record<
  string,
  { badge: string; summary: string; verifyHint: string }
> = {
  fl: {
    badge: "Full journey",
    summary:
      "Full construction verification plus planning tools: licenses, Sunbiz entity links, discipline, discovery, plan, studios, and guides.",
    verifyHint: "Full construction licenses",
  },
  tx: {
    badge: "Specialty verify",
    summary:
      "TDLR specialty trades and TSBPE plumbing. No statewide general contractor license — not a full builder directory.",
    verifyHint: "TDLR + TSBPE plumbing",
  },
  nj: {
    badge: "HIC + specialty",
    summary:
      "Home Improvement Contractor registrations plus specialty boards (electrical, plumbing, HVACR, and related). No single statewide GC license.",
    verifyHint: "HIC + specialty boards",
  },
  or: {
    badge: "CCB statewide",
    summary:
      "Oregon CCB active contractor licenses statewide. Bond and insurance fields as published — not a live COI check.",
    verifyHint: "CCB statewide licenses",
  },
  wa: {
    badge: "L&I statewide",
    summary:
      "Washington L&I contractor licensing extract statewide. Always confirm live status on L&I Verify.",
    verifyHint: "L&I contractors",
  },
  ca: {
    badge: "CSLB counties",
    summary:
      "CSLB licenses from official public list extracts for high-impact counties — not every California county file.",
    verifyHint: "CSLB high-impact counties",
  },
  az: {
    badge: "ROC + discipline",
    summary:
      "Arizona ROC statewide active licenses plus linked disciplinary actions when present. Confirm on ROC contractor search.",
    verifyHint: "ROC statewide + discipline",
  },
};
