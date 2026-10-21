import { formatOshaSummary } from "@/lib/osha/public-record";
import type { OshaInspectionDetail } from "@/lib/osha/inspection-details";

export type OshaDetailPreviewId = "public-citations" | "public-zero" | "pagination-demo" | "load-failure";

export type OshaDetailPreviewFixture = {
  id: OshaDetailPreviewId;
  heading: string;
  note: string;
  identityLabel: string;
  summary: string | null;
  currentPenalty: number | null;
  aggregateCitationItems: number | null;
  inspections: readonly OshaInspectionDetail[];
};

/**
 * Sanitized, committed facts copied from official OSHA detail pages. Establishment
 * names, street addresses, narratives, employee details, and contact data are
 * deliberately omitted. These examples are not matched to a Contractor profile.
 */
const citedInspectionExamples: readonly OshaInspectionDetail[] = [
  {
    activityNumber: "311401533",
    openDate: "2008-10-24",
    city: "West Allis",
    state: "WI",
    inspectionType: "FollowUp",
    officialStatus: "Case closed: 03/01/2011",
    officialUrl: "https://www.osha.gov/ords/imis/establishment.inspection_detail?id=311401533",
    citations: [
      {
        citationId: "01001",
        standard: "19100023 C01",
        citationType: "Serious",
        currentPenalty: 1000,
        officialStatus: "I - Informal Settlement",
      },
      {
        citationId: "01002",
        standard: "19100147 D",
        citationType: "Serious",
        currentPenalty: 1000,
        officialStatus: "I - Informal Settlement",
      },
      {
        citationId: "02001A",
        standard: "19101000 C",
        citationType: "Repeat",
        currentPenalty: 2000,
        officialStatus: "P - Petition to Modify Abatement",
      },
      {
        citationId: "02001B",
        standard: "19101000 E",
        citationType: "Repeat",
        currentPenalty: 0,
        officialStatus: "P - Petition to Modify Abatement",
      },
    ],
  },
  {
    activityNumber: "1334666.015",
    openDate: "2018-08-01",
    city: "West Allis",
    state: "WI",
    inspectionType: "Referral",
    officialStatus: "CLOSED",
    officialUrl: "https://www.osha.gov/ords/imis/establishment.inspection_detail?id=1334666.015",
    citations: [
      {
        citationId: "01001",
        standard: "19100212 A01",
        citationType: "Repeat",
        currentPenalty: 14000,
        officialStatus: "I - Informal Settlement",
      },
    ],
  },
];

const zeroCitationExample: readonly OshaInspectionDetail[] = [
  {
    activityNumber: "119949998",
    openDate: "2000-08-08",
    city: "Chino Hills",
    state: "CA",
    inspectionType: "Accident",
    officialStatus: "Case closed: 03/13/2001",
    officialUrl: "https://www.osha.gov/ords/imis/establishment.inspection_detail?id=119949998",
    // OSHA's official page states that no violations were found and no citations were issued.
    citations: [],
  },
];

/**
 * Pagination-only fixture from one OSHA establishment-search result page.
 * These are independent establishments, explicitly not one matched business.
 * The search result provides activity/date/state/type only; citation detail is
 * null (unknown), never an empty array that would imply zero citations.
 */
const paginationExamples: readonly OshaInspectionDetail[] = [
  { activityNumber: "311397079", openDate: "2008-01-09", state: "WI", inspectionType: "Planned", citations: null },
  { activityNumber: "311397293", openDate: "2008-01-29", state: "WI", inspectionType: "Planned", citations: null },
  { activityNumber: "311396964", openDate: "2008-01-09", state: "WI", inspectionType: "Planned", citations: null },
  { activityNumber: "311397061", openDate: "2008-01-10", state: "WI", inspectionType: "Planned", citations: null },
  { activityNumber: "311397392", openDate: "2008-02-05", state: "WI", inspectionType: "Planned", citations: null },
  { activityNumber: "311397228", openDate: "2008-01-23", state: "WI", inspectionType: "Planned", citations: null },
  { activityNumber: "311397301", openDate: "2008-01-29", state: "WI", inspectionType: "Planned", citations: null },
  { activityNumber: "311397525", openDate: "2008-02-20", state: "WI", inspectionType: "Planned", citations: null },
  { activityNumber: "311397103", openDate: "2008-01-09", state: "WI", inspectionType: "Prog Related", citations: null },
  { activityNumber: "122394323", openDate: "2008-02-07", state: "WI", inspectionType: "Complaint", citations: null },
  { activityNumber: "122394554", openDate: "2008-02-05", state: "WI", inspectionType: "Complaint", citations: null },
];

export const OSHA_DETAIL_PREVIEW_FIXTURES: readonly OshaDetailPreviewFixture[] = [
  {
    id: "public-citations",
    heading: "Multiple cited items",
    note: "Public OSHA detail example for interaction review; this is not matched to a contractor profile.",
    identityLabel: "Public OSHA data example · not matched to a contractor",
    summary: formatOshaSummary(2, "2008-10-24", "2018-08-01", 5, 2),
    currentPenalty: 18000,
    aggregateCitationItems: 5,
    inspections: citedInspectionExamples,
  },
  {
    id: "public-zero",
    heading: "Verified zero-citation inspection",
    note: "Public OSHA detail example; the official inspection page states that no citations were issued.",
    identityLabel: "Public OSHA data example · not matched to a contractor",
    summary: formatOshaSummary(1, "2000-08-08", "2000-08-08", 0, 0),
    currentPenalty: 0,
    aggregateCitationItems: 0,
    inspections: zeroCitationExample,
  },
  {
    id: "pagination-demo",
    heading: "Show-more pagination example",
    note: "These are independent public OSHA search rows, not one business or a contractor match. Citation-level details are not part of this search-result fixture.",
    identityLabel: "Independent public inspection rows · pagination demo only",
    summary: null,
    currentPenalty: null,
    aggregateCitationItems: null,
    inspections: paginationExamples,
  },
  {
    id: "load-failure",
    heading: "Temporary detail-load failure",
    note: "Preview-only network failure simulation; aggregate content remains visible.",
    identityLabel: "Public OSHA data example · not matched to a contractor",
    summary: formatOshaSummary(2, "2008-10-24", "2018-08-01", 5, 2),
    currentPenalty: 18000,
    aggregateCitationItems: 5,
    inspections: citedInspectionExamples,
  },
];

export function getOshaDetailPreviewFixture(id: string): OshaDetailPreviewFixture | null {
  return OSHA_DETAIL_PREVIEW_FIXTURES.find((fixture) => fixture.id === id) ?? null;
}
