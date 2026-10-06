/** Counts transcribed from DOPL's active-license count page; not entity totals. */
export const UTAH_DOPL_SNAPSHOT = {
  source: "https://db.dopl.utah.gov/licensee_count.html/1000",
  lookup:
    "https://secure.utah.gov/llv/search/search.html?currentPage=1&descending=true&orderBy=license_status",
  cbr: "https://db.dopl.utah.gov/cbr/",
  asOf: "2026-09-26 01:42 America/Denver",
  retrievedAt: "2026-10-06",
  activeLicenseeCounts: {
    contractor: 34341,
    electrician: {
      apprentice: 12844,
      journeyman: 6782,
      master: 3404,
      residentialJourneyman: 609,
      residentialMaster: 370,
    },
    plumber: {
      apprentice: 4589,
      journeyman: 1761,
      master: 2367,
      residentialJourneyman: 135,
      residentialMaster: 95,
    },
  },
  licenseRowsAcquired: 0,
  personBusinessSplit: "NOT_ACQUIRED",
  expirationRows: "NOT_ACQUIRED",
  classificationRoster: "NOT_ACQUIRED",
  existingMatches: "NOT_ACQUIRED",
  netNewEntities: 0,
  evidenceAttachments: 0,
  graphWrites: 0,
} as const;
