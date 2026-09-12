/** Reviewed official destinations; no query-dependent external URLs or live-check claim. */
export const RECOVERY_SOURCES = {
  florida: {
    agency: "Florida Department of Business and Professional Regulation",
    title: "Verify a Licensee",
    url: "https://www.myfloridalicense.com/wl11.asp?mode=0&search=contractors",
    hostname: "www.myfloridalicense.com",
    jurisdiction: "FL",
    purpose:
      "Search DBPR-regulated individuals and businesses by name, license number or license type.",
    limitation:
      "Not every Florida trade is regulated by DBPR. Select the relevant board and credential class; this link is not a completed status check.",
    checkedAt: "2026-09-12",
    deepLink: "Search landing only; no individual credential parameters added.",
  },
  texas: {
    agency: "Texas Department of Licensing and Regulation",
    title: "TDLR Active License Search",
    url: "https://www.tdlr.texas.gov/LicenseSearch/",
    hostname: "www.tdlr.texas.gov",
    jurisdiction: "TX",
    purpose:
      "Search active TDLR specialty licenses, including air conditioning and electrical.",
    limitation:
      "Not a general-contractor registry or a plumbing-board search. Absence from this active-only search does not establish that no credential ever existed.",
    checkedAt: "2026-09-12",
    deepLink: "Search landing only; no individual credential parameters added.",
  },
  texasGc: {
    agency: "City of Austin Development Services",
    title: "Contractor Registration",
    url: "https://www.austintexas.gov/development-services/contractor-registration",
    hostname: "www.austintexas.gov",
    jurisdiction: "TX",
    purpose:
      "Official explanation of Texas general-contractor licensing and Austin building/trade contractor registration.",
    limitation:
      "Austin registration procedures apply to Austin; confirm requirements with the authority for the actual project location. Not a contractor status lookup.",
    checkedAt: "2026-09-12",
    deepLink:
      "Information landing page; no transaction or registration form is submitted.",
  },
  california: {
    agency: "California Contractors State License Board",
    title: "Check A License",
    url: "https://www.cslb.ca.gov/OnlineServices/CheckLicenseII/CheckLicense.aspx",
    hostname: "www.cslb.ca.gov",
    jurisdiction: "CA",
    purpose:
      "Check a California contractor license using its number or business name.",
    limitation:
      "A license search does not establish availability or Los Angeles service territory. No individual official lookup has been performed here.",
    checkedAt: "2026-09-12",
    deepLink:
      "Verified generic license-search page; no invented provider parameters.",
  },
  alaskaElevator: {
    agency:
      "Alaska Department of Labor and Workforce Development, Mechanical Inspection",
    title: "Elevators, Escalators, Wheel-Chair Lifts, and Dumbwaiters",
    url: "https://labor.alaska.gov/lss/elevators.htm",
    hostname: "labor.alaska.gov",
    jurisdiction: "AK",
    purpose:
      "Elevator equipment oversight, inspection requirements and the responsible inspection contact; the page identifies Anchorage inspection responsibility separately.",
    limitation:
      "Equipment inspection or a Certificate of Operation is not proof of a contractor business license, individual qualification or approval.",
    checkedAt: "2026-09-12",
    deepLink:
      "Information landing page only; no equipment or contractor lookup parameters.",
  },
} as const;
export type RecoverySourceId = keyof typeof RECOVERY_SOURCES;
export function isOfficialRecoveryDestination(url: string): boolean {
  return Object.values(RECOVERY_SOURCES).some(
    (s) =>
      s.url === url &&
      new URL(url).protocol === "https:" &&
      new URL(url).hostname === s.hostname &&
      !new URL(url).username &&
      !new URL(url).password,
  );
}
