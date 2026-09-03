/**
 * Multi-state product config. Florida is the live reference implementation.
 * Texas: TDLR specialty trades + TSBPE plumbing (no statewide GC) — see docs/DATA_SOURCES_TX.md.
 * New Jersey: HIC + specialty boards via DCA (no statewide GC) — see docs/DATA_SOURCES_NJ.md.
 * Oregon: CCB statewide contractor licenses — see docs/DATA_SOURCES_OR.md.
 * California: CSLB License Master public-data rows (partial portal stream) — see docs/DATA_SOURCES_CA.md.
 * Arizona: ROC current active posting lists — see docs/DATA_SOURCES_AZ.md.
 * Washington: L&I contractor extract — Verify-first.
 * Louisiana: LSLBC statewide contractor licenses — see docs/DATA_SOURCES_LA.md.
 * Mississippi: MSBOC statewide contractor licenses — see docs/DATA_SOURCES_MS.md.
 * Kentucky: DHBC specialty trades only (no statewide GC) — see docs/DATA_SOURCES_KY.md.
 * Wisconsin: DSPS dwelling + trade credentials (no statewide commercial GC) — see docs/DATA_SOURCES_WI.md.
 * Adding a state: extend this map + ingest adapters; UI reads from here.
 */

import { getOccupationInfo } from "@/lib/contractors/occupations";
import { azClassPlainLabel } from "./az-roc";
import { caClassPlainLabel } from "./ca-classifications";
import { isNjVerifyPilotEnabled } from "./feature-flags";
import { njCredentialPlainLabel } from "./nj-credentials";
import { orCcbPlainLabel } from "./or-ccb";
import { waOccupationPlainLabel } from "./wa-lni";
import { laLslbcPlainLabel } from "./la-lslbc";
import { msSbcPlainLabel } from "./ms-sbc";
import { kyDhbcPlainLabel } from "./ky-dhbc";
import { wiDspsPlainLabel } from "./wi-dsps";

export type StateCode = "FL" | "TX" | "NJ" | "OR" | "WA" | "CA" | "AZ" | "LA" | "MS" | "KY" | "WI";

/**
 * Product depth — single source of truth for homepage badges, Verify, and coverage copy.
 * - full_journey: Florida-style verify + plan + browse
 * - verify: statewide (or broad) license Verify path
 * - specialty_verify: specialty trades only / no statewide GC framing
 * - pilot: Verify surface with explicit pilot limits
 */
export type StateProductDepth =
  | "full_journey"
  | "verify"
  | "specialty_verify"
  | "pilot";

export type EvidenceState = {
  code: StateCode;
  slug: string;
  /** Display name (e.g. Florida) */
  name: string;
  shortName: string;
  /** Primary license board label (full) */
  boardLabel: string;
  /** Short board label for chips / footer */
  boardShortLabel: string;
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
  /** Product depth for badges and path framing */
  depth: StateProductDepth;
  /**
   * Honest plain-English coverage for homepage tiles and proof strip.
   * Prefer short consumer language over long ingest notes.
   */
  coverageNote: string;
  /** Homepage / landscape badge (Full journey, Specialty, Statewide license, …) */
  badge: string;
  /** One-line scope hint under the name (e.g. TDLR + TSBPE plumbing) */
  scopeHint: string;
  /** County/trade browse product (Florida only today) */
  browseEnabled: boolean;
  /** Pilot / partial product surface (e.g. NJ Verify-only) */
  pilot?: boolean;
};

/** Default depth badge when a state omits a custom badge (should not happen). */
export function depthBadge(depth: StateProductDepth): string {
  switch (depth) {
    case "full_journey":
      return "Full journey";
    case "specialty_verify":
      return "Specialty";
    case "pilot":
      return "Verify pilot";
    case "verify":
    default:
      return "Statewide license";
  }
}

/** Verify URL for a state slug or EvidenceState. */
export function verifyPathFor(stateOrSlug: EvidenceState | string): string {
  const slug =
    typeof stateOrSlug === "string" ? stateOrSlug.toLowerCase() : stateOrSlug.slug;
  if (slug === "fl" || slug === "florida") return "/verify";
  return `/verify?state=${slug}`;
}

export function getLiveStateCount(): number {
  return getLiveStates().length;
}

/** Live states excluding Florida (Verify-first peers). */
export function getLiveVerifyPeerStates(): EvidenceState[] {
  return getLiveStates().filter((s) => s.slug !== "fl");
}

/** "Florida, Texas, New Jersey, …" for prose that must stay in sync with tabs. */
export function liveStatesPlainList(opts?: { short?: boolean }): string {
  const names = getLiveStates().map((s) => (opts?.short ? s.shortName : s.name));
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/** Compact "TX · NJ · OR" line for proof strips. */
export function livePeerShortCodesLine(): string {
  return getLiveVerifyPeerStates()
    .map((s) => s.shortName)
    .join(" · ");
}

/** Footer / homepage CTA links for every live Verify state. */
export function getLiveVerifyNavLinks(): { href: string; label: string }[] {
  return getLiveStates().map((s) => ({
    href: verifyPathFor(s),
    label: s.slug === "fl" ? "Florida Verify" : `${s.name} Verify`,
  }));
}

export const EVIDENCE_STATES: Record<string, EvidenceState> = {
  fl: {
    code: "FL",
    slug: "fl",
    name: "Florida",
    shortName: "FL",
    boardLabel: "Florida DBPR — Construction Industry Licensing Board",
    boardShortLabel: "DBPR",
    boardUrl: "https://www2.myfloridalicense.com/construction-industry/",
    entityRegistryLabel: "Florida Division of Corporations (Sunbiz)",
    entityRegistryUrl: "https://dos.fl.gov/sunbiz/",
    licenseSource: "fl_dbpr",
    entitySource: "fl_sunbiz",
    live: true,
    depth: "full_journey",
    badge: "Full journey",
    scopeHint: "Licenses · entity · plan · browse",
    browseEnabled: true,
    coverageNote:
      "Full construction verification plus planning tools: DBPR licenses, Sunbiz entity links, discipline, discovery, plan, studios, and guides.",
  },
  tx: {
    code: "TX",
    slug: "tx",
    name: "Texas",
    shortName: "TX",
    boardLabel: "Texas Department of Licensing and Regulation (TDLR)",
    boardShortLabel: "TDLR + TSBPE",
    boardUrl: "https://www.tdlr.texas.gov/",
    entityRegistryLabel: "Texas SOS / Comptroller entity data (not yet linked)",
    entityRegistryUrl: "https://www.sos.state.tx.us/",
    licenseSource: "tx_tdlr",
    licenseSources: ["tx_tdlr", "tx_tsbpe"],
    entitySource: "tx_sos",
    live: true,
    depth: "specialty_verify",
    badge: "Specialty",
    scopeHint: "TDLR trades + TSBPE plumbing",
    browseEnabled: false,
    coverageNote:
      "Texas: specialty trades and plumbing only — no statewide general contractor license. Many builders are city/county only.",
  },
  nj: {
    code: "NJ",
    slug: "nj",
    name: "New Jersey",
    shortName: "NJ",
    boardLabel: "New Jersey Division of Consumer Affairs (DCA) — HIC + specialty boards",
    boardShortLabel: "DCA HIC + specialty",
    boardUrl: "https://www.njconsumeraffairs.gov/",
    entityRegistryLabel: "NJ business entity records (high-confidence only when linked)",
    entityRegistryUrl: "https://www.njportal.com/DOR/BusinessRecords/",
    licenseSource: "nj_dca",
    entitySource: "nj_sos",
    live: true,
    pilot: true,
    depth: "specialty_verify",
    badge: "Specialty",
    scopeHint: "HIC + specialty boards",
    browseEnabled: false,
    coverageNote:
      "New Jersey: home improvement + specialty boards — no single statewide GC license. Confirm on official DCA / MyLicense.",
  },
  or: {
    code: "OR",
    slug: "or",
    name: "Oregon",
    shortName: "OR",
    boardLabel: "Oregon Construction Contractors Board (CCB)",
    boardShortLabel: "CCB",
    boardUrl: "https://www.oregon.gov/ccb/",
    entityRegistryLabel: "Oregon SOS business registry (not yet linked)",
    entityRegistryUrl: "https://sos.oregon.gov/business/Pages/default.aspx",
    licenseSource: "or_ccb",
    entitySource: "or_sos",
    live: true,
    depth: "verify",
    badge: "Statewide license",
    scopeHint: "CCB active licenses",
    browseEnabled: false,
    coverageNote:
      "Oregon: statewide CCB active licenses. Bond and insurance fields as published — not a live certificate check.",
  },
  ca: {
    code: "CA",
    slug: "ca",
    name: "California",
    shortName: "CA",
    boardLabel: "California Contractors State License Board (CSLB)",
    boardShortLabel: "CSLB",
    boardUrl: "https://www.cslb.ca.gov/",
    entityRegistryLabel: "California SOS business entities (not yet linked)",
    entityRegistryUrl: "https://bizfileonline.sos.ca.gov/",
    licenseSource: "ca_cslb",
    entitySource: "ca_sos",
    live: true,
    pilot: true,
    depth: "verify",
    badge: "Statewide license",
    scopeHint: "CSLB public-data rows (partial master)",
    browseEnabled: false,
    coverageNote:
      "California: acquired CSLB License Master rows from the official public data portal. Stream truncated; not the complete renewable universe. Confirm on Instant License Check.",
  },
  wa: {
    code: "WA",
    slug: "wa",
    name: "Washington",
    shortName: "WA",
    boardLabel: "Washington Department of Labor & Industries (L&I)",
    boardShortLabel: "L&I",
    boardUrl: "https://www.lni.wa.gov/",
    entityRegistryLabel: "Washington SOS business registry (not yet linked)",
    entityRegistryUrl: "https://www.sos.wa.gov/corps/",
    licenseSource: "wa_lni",
    entitySource: "wa_sos",
    live: true,
    pilot: true,
    depth: "verify",
    badge: "Statewide license",
    scopeHint: "L&I contractors",
    browseEnabled: false,
    coverageNote:
      "Washington: statewide L&I contractor extract. Always confirm live status on L&I Verify.",
  },
  az: {
    code: "AZ",
    slug: "az",
    name: "Arizona",
    shortName: "AZ",
    boardLabel: "Arizona Registrar of Contractors (ROC)",
    boardShortLabel: "ROC",
    boardUrl: "https://roc.az.gov/",
    entityRegistryLabel: "Arizona Corporation Commission (not yet linked)",
    entityRegistryUrl: "https://ecorp.azcc.gov/",
    licenseSource: "az_roc",
    entitySource: "az_acc",
    live: true,
    pilot: true,
    depth: "verify",
    badge: "Statewide license",
    scopeHint: "ROC active + discipline when linked",
    browseEnabled: false,
    coverageNote:
      "Arizona: statewide ROC active licenses plus disciplinary rows when linked. Confirm on the official ROC search.",
  },
  la: {
    code: "LA",
    slug: "la",
    name: "Louisiana",
    shortName: "LA",
    boardLabel: "Louisiana State Licensing Board for Contractors (LSLBC)",
    boardShortLabel: "LSLBC",
    boardUrl: "https://arlspublic.lslbc.louisiana.gov/Public/Search",
    entityRegistryLabel: "Louisiana SOS business filings (not yet linked)",
    entityRegistryUrl: "https://coraweb.sos.la.gov/commercialsearch/commercialsearch.aspx",
    licenseSource: "la_lslbc",
    entitySource: "la_sos",
    live: true,
    depth: "verify",
    badge: "Statewide license",
    scopeHint: "LSLBC public roster",
    browseEnabled: false,
    coverageNote:
      "Louisiana: statewide LSLBC roster (commercial, residential, home improvement, mold when published). Confirm on official lookup.",
  },
  ms: {
    code: "MS",
    slug: "ms",
    name: "Mississippi",
    shortName: "MS",
    boardLabel: "Mississippi State Board of Contractors (MSBOC)",
    boardShortLabel: "MSBOC",
    boardUrl: "http://search.msboc.us/ConsolidatedSearch.cfm",
    entityRegistryLabel: "Mississippi SOS business filings (not yet linked)",
    entityRegistryUrl: "https://www.sos.ms.gov/business-services",
    licenseSource: "ms_sbc",
    entitySource: "ms_sos",
    live: true,
    depth: "verify",
    badge: "Statewide license",
    scopeHint: "MSBOC commercial / residential",
    browseEnabled: false,
    coverageNote:
      "Mississippi: statewide MSBOC list (commercial / residential as published). Confirm on the official board lookup.",
  },
  ky: {
    code: "KY",
    slug: "ky",
    name: "Kentucky",
    shortName: "KY",
    boardLabel: "Kentucky Department of Housing, Buildings and Construction (DHBC)",
    boardShortLabel: "DHBC",
    boardUrl: "https://dhbc.ky.gov/Search/HBC_List_Licensees.aspx",
    entityRegistryLabel: "Kentucky SOS business filings (not yet linked)",
    entityRegistryUrl: "https://web.sos.ky.gov/ftsearch/",
    licenseSource: "ky_dhbc",
    entitySource: "ky_sos",
    live: true,
    depth: "specialty_verify",
    badge: "Specialty",
    scopeHint: "Electrical · HVAC · plumbing",
    browseEnabled: false,
    coverageNote:
      "Kentucky: DHBC specialty trades only (electrical, HVAC, plumbing) — no statewide general contractor license.",
  },
  wi: {
    code: "WI",
    slug: "wi",
    name: "Wisconsin",
    shortName: "WI",
    boardLabel: "Wisconsin Department of Safety and Professional Services (DSPS)",
    boardShortLabel: "DSPS",
    boardUrl: "https://license.wi.gov/s/license-lookup",
    entityRegistryLabel: "Wisconsin DFI business filings (not yet linked)",
    entityRegistryUrl: "https://apps.dfi.wi.gov/apps/corpsearch/search.aspx",
    licenseSource: "wi_dsps",
    entitySource: "wi_dfi",
    live: false,
    depth: "specialty_verify",
    badge: "Specialty",
    scopeHint: "Dwelling + trade credentials",
    browseEnabled: false,
    coverageNote:
      "Wisconsin: no statewide commercial GC. DSPS dwelling contractor plus trade credentials when loaded. Not live in Verify yet.",
  },
};

export const DEFAULT_STATE_SLUG = "fl";

/** Stable display order for homepage + Verify tabs */
export const LIVE_STATE_ORDER = ["fl", "tx", "nj", "or", "wa", "ca", "az", "la", "ms", "ky"] as const;

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
            : key === "louisiana"
              ? "la"
              : key === "mississippi"
                ? "ms"
                : key === "kentucky"
                  ? "ky"
                  : key === "wisconsin"
                    ? "wi"
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
    laLslbcPlainLabel(upper) ??
    msSbcPlainLabel(upper) ??
    kyDhbcPlainLabel(upper) ??
    wiDspsPlainLabel(upper) ??
    njCredentialPlainLabel(upper) ??
    getOccupationInfo(upper).label
  );
}

/**
 * @deprecated Prefer fields on EvidenceState (badge, coverageNote, scopeHint).
 * Kept as a derived map so older imports keep working.
 */
export const STATE_SCOPE_UI: Record<
  string,
  { badge: string; summary: string; verifyHint: string }
> = Object.fromEntries(
  Object.values(EVIDENCE_STATES).map((s) => [
    s.slug,
    {
      badge: s.badge || depthBadge(s.depth),
      summary: s.coverageNote,
      verifyHint: s.scopeHint,
    },
  ])
);
