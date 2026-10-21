import { toPublicOshaRecord, type OshaPublicRecord, type OshaSourceMatch } from "@/lib/osha/public-record";

/**
 * Non-production look-and-feel fixtures. License-level totals only.
 * No names, addresses, phones, emails, activity numbers, or initial penalties.
 */
export type OshaPreviewSample = {
  fixtureId: string;
  state: "FL" | "NJ";
  licenseKey: string;
  matchTier: "exact" | "strong";
  scenario: string;
  source: OshaSourceMatch;
};

export const OSHA_PREVIEW_SAMPLES: OshaPreviewSample[] = [
  {
    fixtureId: "fl-exact-multi",
    state: "FL",
    licenseKey: "CGC011008",
    matchTier: "exact",
    scenario: "Florida exact match, two inspections, contest-date count, final-order-date count, current penalty",
    source: {
      licenseKey: "CGC011008",
      state: "FL",
      matchTier: "exact",
      nInspections: 2,
      firstOpen: "1995-08-10",
      lastOpen: "2002-03-22",
      nCitationItems: 5,
      nSerious: 3,
      currentPenalty: 11750,
      nWithFinalOrder: 5,
      nContested: 5,
    },
  },
  {
    fixtureId: "fl-strong-multi",
    state: "FL",
    licenseKey: "CUC056822",
    matchTier: "strong",
    scenario: "Florida strong match, three inspections, contest-date count, final-order-date count, current penalty",
    source: {
      licenseKey: "CUC056822",
      state: "FL",
      matchTier: "strong",
      nInspections: 3,
      firstOpen: "1985-12-13",
      lastOpen: "2009-09-04",
      nCitationItems: 4,
      nSerious: 3,
      currentPenalty: 1240,
      nWithFinalOrder: 1,
      nContested: 1,
    },
  },
  {
    fixtureId: "fl-exact-single-year",
    state: "FL",
    licenseKey: "CBC015628",
    matchTier: "exact",
    scenario: "Florida exact match, one inspection in a single year, current penalty zero",
    source: {
      licenseKey: "CBC015628",
      state: "FL",
      matchTier: "exact",
      nInspections: 1,
      firstOpen: "2024-09-03",
      lastOpen: "2024-09-03",
      nCitationItems: 0,
      nSerious: 0,
      currentPenalty: 0,
      nWithFinalOrder: 0,
      nContested: 0,
    },
  },
  {
    fixtureId: "nj-exact-multi",
    state: "NJ",
    licenseKey: "13VH05973500",
    matchTier: "exact",
    scenario: "New Jersey exact match, two inspections, contest-date count, final-order-date count, current penalty",
    source: {
      licenseKey: "13VH05973500",
      state: "NJ",
      matchTier: "exact",
      nInspections: 2,
      firstOpen: "2008-10-21",
      lastOpen: "2011-10-03",
      nCitationItems: 3,
      nSerious: 3,
      currentPenalty: 2400,
      nWithFinalOrder: 3,
      nContested: 3,
    },
  },
  {
    fixtureId: "nj-strong-multi",
    state: "NJ",
    licenseKey: "13VH05660500",
    matchTier: "strong",
    scenario: "New Jersey strong match, three inspections, final-order-date count, current penalty",
    source: {
      licenseKey: "13VH05660500",
      state: "NJ",
      matchTier: "strong",
      nInspections: 3,
      firstOpen: "2006-06-21",
      lastOpen: "2012-09-11",
      nCitationItems: 8,
      nSerious: 6,
      currentPenalty: 6410,
      nWithFinalOrder: 1,
      nContested: 0,
    },
  },
  {
    fixtureId: "nj-strong-contest-same-year",
    state: "NJ",
    licenseKey: "13VH07505600",
    matchTier: "strong",
    scenario: "New Jersey strong match, same-year inspections, contest-date count, no final-order-date count",
    source: {
      licenseKey: "13VH07505600",
      state: "NJ",
      matchTier: "strong",
      nInspections: 2,
      firstOpen: "1977-03-08",
      lastOpen: "1977-03-25",
      nCitationItems: 1,
      nSerious: 1,
      currentPenalty: 0,
      nWithFinalOrder: 0,
      nContested: 1,
    },
  },
];

export const OSHA_NO_MATCH_FIXTURE = {
  fixtureId: "no-match",
  state: "FL",
  scenario: "Existing profile shape with no eligible OSHA match. The section renders nothing.",
} as const;

export function previewRecord(fixtureId: string): OshaPublicRecord | null {
  const sample = OSHA_PREVIEW_SAMPLES.find((item) => item.fixtureId === fixtureId);
  if (!sample) return null;
  return toPublicOshaRecord(sample.source);
}

export function previewRecords(): OshaPublicRecord[] {
  return OSHA_PREVIEW_SAMPLES.map((sample) => toPublicOshaRecord(sample.source)).filter(
    (record): record is OshaPublicRecord => record != null,
  );
}
