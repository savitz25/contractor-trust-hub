/**
 * Contractor County Intelligence catalog.
 * Jurisdiction mapping is metadata, not permit coverage.
 * Miami-Dade county-issued permit ingest is not Enhanced Local Research.
 */
import type { FloridaCountyIntelSlug } from "./coverage";

export type CountyIntelCatalogEntry = {
  slug: FloridaCountyIntelSlug;
  name: string;
  dbprCountyCode: string;
  canonicalPath: string;
  addressFieldSemantics: string;
  pendingPermitRequestId?: string;
  pendingCredentialRequestId?: string;
  pendingAgency: string;
  heroIntro: string;
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
      heroIntro:
        "This county page currently combines Florida statewide licensing and regulatory research with mapped local jurisdictions. Permit and local credential exports are still being acquired.",
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
      heroIntro:
        "This county page currently combines Florida statewide licensing and regulatory research with mapped local jurisdictions. Permit and local credential exports are still being acquired.",
      jurisdictionDisclosures: [
        "Palm Beach County PZB permit search primarily represents unincorporated Palm Beach County. Those records are not all Palm Beach County permits.",
        "Westlake has had its own permit system since 2017.",
        "Loxahatchee Groves may have dual county/town coverage until an export resolves the AHJ. Do not assume either way.",
      ],
    },
    "miami-dade": {
      slug: "miami-dade",
      name: "Miami-Dade",
      dbprCountyCode: "23",
      canonicalPath: "/florida/miami-dade",
      addressFieldSemantics:
        "Florida contractor credentials whose DBPR license mailing county_code is 23 (Miami-Dade). Headquarters/base mailing county — not operating geography, not local authorization, and not all permit activity in Miami-Dade.",
      pendingPermitRequestId: undefined,
      pendingCredentialRequestId: undefined,
      pendingAgency: "Miami-Dade RER / Construction Trades Qualifying Board",
      heroIntro:
        "This county page combines Florida statewide licensing research with mapped local jurisdictions and confirmed Miami-Dade County-issued permit records linked to Florida contractor credentials. County-issued records are not the permit history of all 34 municipalities. Issued is not final.",
      jurisdictionDisclosures: [
        "Miami-Dade RER Open Data is county-issued permits (unincorporated folio 30 plus associated M/MBLD county reviews). It is not all Miami-Dade municipal permit history.",
        "Islandia was abolished in 2012 and is not an AHJ.",
        "City of Miami GIS permits are a separate AHJ and are not published as contractor permit volume on this page.",
      ],
    },
    pinellas: {
      slug: "pinellas",
      name: "Pinellas",
      dbprCountyCode: "62",
      canonicalPath: "/florida/pinellas",
      addressFieldSemantics:
        "Florida contractor credentials whose DBPR license mailing county_code is 62 (Pinellas). Headquarters/base mailing county — not operating geography, not PCCLB local authorization, and not permit activity.",
      pendingPermitRequestId: undefined,
      pendingCredentialRequestId: undefined,
      pendingAgency: "Pinellas County BDRS / PCCLB",
      heroIntro:
        "This county page currently combines Florida statewide licensing research with mapped local jurisdictions. Local permit, local credential, and county enforcement extracts have been requested and are not yet loaded.",
      jurisdictionDisclosures: [
        "PCCLB countywide licensing is not countywide permitting.",
        "Pinellas County Accela covers unincorporated Pinellas plus named partner cities only — not St. Petersburg, Clearwater, Largo, or other independent AHJs.",
        "Belleair Bluffs new permits moved to SAFEbuilt on 2025-08-15; historical Accela rows remain county-held through final.",
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
