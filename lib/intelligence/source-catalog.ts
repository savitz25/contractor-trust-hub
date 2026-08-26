/**
 * Static source descriptions (no living counts). Counts come from the snapshot query.
 */

import type { SourceFamily } from "./types";

export type IntelligenceSourceCatalogEntry = {
  id: SourceFamily;
  agency: string;
  label: string;
  whatItContains: string;
  contribution: string;
  limitation: string;
  attributionStatus: string;
  cadence: string;
};

export const FLORIDA_SOURCE_CATALOG: IntelligenceSourceCatalogEntry[] = [
  {
    id: "fl_dbpr_licensing",
    agency: "Florida Department of Business and Professional Regulation — Construction Industry Licensing Board",
    label: "DBPR construction credentials",
    whatItContains:
      "CILB licensee extract: occupation, full license identity, status, mailing address, county code, and related dates as published.",
    contribution: "The credential universe used for category and HQ-county research.",
    limitation:
      "NULL & VOID, delinquent, and involuntarily inactive credentials are omitted from the official licensee download. QB shells are not board credentials. County is mailing/base, not jobsites.",
    attributionStatus: "Credential identity is the published full license key.",
    cadence: "DBPR posts licensee extracts on a periodic public-records schedule (not real-time).",
  },
  {
    id: "fl_dbpr_discipline",
    agency: "Florida DBPR / CILB",
    label: "DBPR licensed contractor discipline records",
    whatItContains:
      "Fiscal-year public CSVs of licensed-contractor discipline actions (complaint numbers, dispositions, and related fields as published).",
    contribution: "Regulatory research coverage — records collected, not a list of guilty contractors.",
    limitation:
      "A row may be a complaint, notice, costs line, or final order. Multiple rows can belong to one matter. Numeric license cores are not unique identity. Public profile findings still require the two-gate publication rules.",
    attributionStatus: "Collected as observations. Public adverse attribution remains CONFIRMED + PUBLIC only.",
    cadence: "Fiscal-year files. Not a rolling 12-month window unless that aggregation is built later.",
  },
  {
    id: "fl_dbpr_unlicensed_activity",
    agency: "Florida DBPR / CILB",
    label: "DBPR unlicensed activity records",
    whatItContains: "Fiscal-year ULA (unlicensed activity) public CSVs.",
    contribution: "Research coverage of unlicensed-activity filings as published.",
    limitation:
      "ULA rows typically have no board license number. They are not a count of licensed contractors with violations.",
    attributionStatus: "Usually UNRESOLVED to a credential until an official identifier exists.",
    cadence: "Fiscal-year files.",
  },
  {
    id: "fl_dbpr_recovery_fund",
    agency: "Florida Homeowners’ Construction Recovery Fund (via DBPR/CILB public reports)",
    label: "Recovery Fund records",
    whatItContains: "Fiscal-year Recovery Fund public CSVs.",
    contribution: "Research coverage of Recovery Fund public records.",
    limitation:
      "A Recovery Fund record is not automatically discipline on every similarly named business and is not a statewide “affected businesses” count.",
    attributionStatus: "Observations collected; public findings still require identity + disposition gates.",
    cadence: "Fiscal-year files.",
  },
  {
    id: "fl_dfs_stop_work",
    agency: "Florida Department of Financial Services — workers’ compensation / stop-work lists",
    label: "DFS workers’ compensation / stop-work records",
    whatItContains: "Public stop-work / employer list observations as ingested from DFS.",
    contribution: "Workers’ compensation enforcement research coverage.",
    limitation:
      "Name/location-only matching is not treated as confirmed contractor identity. A stop-work record is not a CILB license census.",
    attributionStatus: "Unresolved without an official identity identifier.",
    cadence: "Point-in-time public list at extract, not a live certificate check.",
  },
  {
    id: "fl_sunbiz",
    agency: "Florida Division of Corporations (Sunbiz)",
    label: "Sunbiz corporate research",
    whatItContains:
      "Corporate legal-name, document number, and address fields used for high-confidence name/address linking.",
    contribution: "Due-diligence context on individual research paths when match confidence is high enough.",
    limitation:
      "High-confidence name/address links are not CONFIRMED legal-entity identity and are not a statewide count of distinct contractor companies. City-only matches stay review-required.",
    attributionStatus: "Public legal-entity claims require CONFIRMED identity. Current links are HIGH CONFIDENCE at best.",
    cadence: "Sunbiz publishes bulk corporate files on DOS schedules.",
  },
];
