/**
 * IN-CON-001 Indiana contractor evidence. Indiana licenses plumbers as its only statewide construction contractors;
 * general, electrical and HVAC contractor licensing is local. Counts below are PLA active-license class totals as
 * displayed in PLA's public Active Licenses view, not acquired licensee rows or a deduplicated contractor census.
 */
import discipline from "./discipline.json";

export const IN_DISCIPLINE = discipline;

export const IN_SNAPSHOT = {
  retrievedAt: "2026-09-29",
  generatedAt: "2026-09-29",
  structuralRule: "The only construction contractors licensed by the State of Indiana are plumbers.",
  businessGuideUrl: "https://www.in.gov/core/business_guide.html",
  plumbingHomeUrl: "https://www.in.gov/pla/professions/plumbing-home/",
  plumbingLicensingUrl: "https://www.in.gov/pla/professions/plumbing-home/plumbing-licensing-information/",
  verifyUrl: "https://mylicense.in.gov/EVerification/Search.aspx",
  licenseWatchUrl: "https://www.in.gov/ai/appfiles/licensewatch/",
  downloadUrl: "https://www.in.gov/pla/license/download-license-files",
  activeLicensesUrl: "https://www.in.gov/pla/data/indiana-active-licenses-map",
  disciplineUrl: "https://www.in.gov/ai/appfiles/pla-litigation/",
  disciplineSearchUrl: "https://www.in.gov/apps/pla/litigation/advancedsearch.aspx",
  complaintUrl: "https://www.in.gov/pla/licensure-discipline/report-a-professional/",
  publicWorksUrl: "https://www.in.gov/idoa/state-property-and-facilities/public-works/certification-board/contractors-and-sub-contractors/",
  publicWorksLookupUrl: "https://in.accessgov.com/dapw/Forms/Page/dapw/contractor-lookup",
  /** PLA Active Licenses view (Tableau), observed 2026-09-29; the view states no as-of date. */
  activeClock: { observedAt: "2026-09-29", viewAsOf: null },
  classes: [
    { label: "Plumbing Contractor", grain: "person", indiana: null, outOfState: null, note: "PLA license type (eVerification); not shown in the Active Licenses view, so its count is NOT_ACQUIRED" },
    { label: "Temporary Plumbing Contractor", grain: "person", indiana: null, outOfState: null, note: "PLA license type (eVerification); count NOT_ACQUIRED" },
    { label: "Plumbing Corporation", grain: "business", indiana: 500, outOfState: 69, note: "Corporate plumbing contractor license; must be associated with a licensed Plumbing Contractor" },
    { label: "Journeyman Plumber", grain: "person", indiana: 3628, outOfState: 434, note: "Individual credential; not a contracting business" },
    { label: "Plumbing Apprentice", grain: "person", indiana: 3508, outOfState: 164, note: "Individual credential; not a contracting business" },
    { label: "Plumbing Apprenticeship Program", grain: "program", indiana: 16, outOfState: 2, note: "Approved training program, not a contractor" },
  ],
  professionTotal: { indiana: 7652, outOfState: 669 },
  roster: {
    freeRoster: "NOT_ACQUIRED",
    reason: "Free Search & Verify is per-record and protected by reCAPTCHA; bulk license files are a paid IN.gov download ($150 first record + $10 per additional 1,000). No purchase was authorized.",
    credentialRows: 0,
  },
  publicWorks: {
    status: "CAPABILITY_KNOWN",
    rows: 0,
    reason: "IDOA publishes a filter-driven Certified Contractors Lookup; its list service returned HTTP 500 during retrieval and IDOA says the list is a reference, not final. No prequalification rows or count acquired.",
    threshold: "State public-works contracts valued at more than $150,000 (IC 4-13.6-4)",
  },
  complaints: { intake: "KNOWN", providerRows: "NOT_ACQUIRED", outcomes: "NOT_ACQUIRED" },
  localLicensing: "EXISTS / OUT_OF_SCOPE",
  newCanonicalCompanies: 0,
  graphWrites: 0,
  claimEligibilityChanges: 0,
} as const;

/** Exact labeled PLA plumbing identifiers (prefix + 8 digits). */
export const IN_PLUMBING_LICENSE = /\b(PC|JP|PA|CO)\s*-?\s*(\d{8})\b/i;
