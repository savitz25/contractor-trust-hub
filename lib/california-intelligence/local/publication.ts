export const CA_LOCAL_INTEL_VERSION = "contractor-ca-local-intel-v1" as const;
export const CA_LOCAL_PUBLIC_FINGERPRINT =
  "8bda38b1d8a365d832331b9a5168a1e7429eb7c764e0665c2a040493b8e54373";

export const CA_SF_GATE = {
  path: "/california/san-francisco",
  robotsIndex: true,
  sitemap: true,
  title: "City and County of San Francisco Contractor & Permit Intelligence | ContractorTrustHub",
  description:
    "Research official San Francisco building permits, permit-contact CSLB numbers, inspections, and registered businesses. Exact license identifiers only. Not a ranking or Trust Score. Not Los Angeles County. Not a complete CSLB roster.",
} as const;

export const CA_LA_GATE = {
  path: "/california/los-angeles",
  robotsIndex: true,
  sitemap: true,
  title: "City of Los Angeles Contractor & Permit Intelligence | ContractorTrustHub",
  description:
    "Research City of Los Angeles certificates of occupancy, PCIS permit extracts, current 2020+ permit activity, and exact CSLB identifiers. City of Los Angeles only — not Los Angeles County. Not a ranking or Trust Score.",
} as const;

export const CSLB_VERIFY =
  "https://www.cslb.ca.gov/OnlineServices/CheckLicenseII/CheckLicense.aspx";

export function cslbDetailUrl(license: string): string {
  return `https://www.cslb.ca.gov/OnlineServices/CheckLicenseII/LicenseDetail.aspx?LicNum=${encodeURIComponent(license)}`;
}
