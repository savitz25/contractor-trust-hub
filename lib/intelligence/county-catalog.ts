/**
 * Contractor County Intelligence catalog — Broward and Palm Beach only.
 * Jurisdiction mapping is metadata, not permit coverage.
 */
import type { FloridaCountyIntelSlug } from "./coverage";

export type CountyIntelCatalogEntry = {
  slug: FloridaCountyIntelSlug;
  name: string;
  dbprCountyCode: string;
  canonicalPath: string;
  addressFieldSemantics: string;
  pendingPermitRequestId: string;
  pendingCredentialRequestId: string;
  pendingAgency: string;
  jurisdictionDisclosures: string[];
};

export const FLORIDA_COUNTY_INTEL_CATALOG: Record<FloridaCountyIntelSlug, CountyIntelCatalogEntry> =
  {
    broward: {
      slug: "broward",
      name: "Broward",
      dbprCountyCode: "16",
      canonicalPath: "/florida/broward",
      addressFieldSemantics:
        "Florida contractor credentials whose DBPR license mailing county_code is 16 (Broward). Headquarters/base mailing county — not operating geography, not local authorization, and not permit activity.",
      pendingPermitRequestId: "R002812-082626",
      pendingCredentialRequestId: "R002813-082626",
      pendingAgency: "Broward County Building Code Division",
      jurisdictionDisclosures: [
        "County-issued BMSD / unincorporated permits are not every Broward municipality’s permit history.",
        "Broward OneStop / ePermits is a submittal path for associated county approvals and some municipal applications. It is not a complete countywide permit warehouse.",
      ],
    },
    "palm-beach": {
      slug: "palm-beach",
      name: "Palm Beach",
      dbprCountyCode: "60",
      canonicalPath: "/florida/palm-beach",
      addressFieldSemantics:
        "Florida contractor credentials whose DBPR license mailing county_code is 60 (Palm Beach). Headquarters/base mailing county — not operating geography, not local authorization, and not permit activity.",
      pendingPermitRequestId: "REQ-2026-09008",
      pendingCredentialRequestId: "REQ-2026-09009",
      pendingAgency: "Palm Beach County PZB / Contractor Regulations",
      jurisdictionDisclosures: [
        "Palm Beach County PZB permit search primarily represents unincorporated Palm Beach County. Those records are not all Palm Beach County permits.",
        "Westlake has had its own permit system since 2017.",
        "Loxahatchee Groves may have dual county/town coverage until an export resolves the AHJ. Do not assume either way.",
      ],
    },
  };

export const LOCAL_CREDENTIAL_CURRENTNESS = [
  "CURRENT_LOCAL_AUTHORIZATION",
  "CURRENT_REGISTRATION",
  "STATE_ENROLLED",
  "INSTALLER_REGISTRATION",
  "HISTORICAL_LOCAL_LICENSE",
  "PREEMPTED_CLASS",
  "EXPIRED",
  "REVOKED",
  "UNKNOWN",
] as const;

export const PERMIT_MODULE_SLOTS = [
  "permits_last_12_months",
  "permits_last_3_years",
  "open_permits",
  "final_closed_permits",
  "permit_valuation",
  "permit_type",
  "source_jurisdiction",
  "contractor_attribution_rate",
] as const;
