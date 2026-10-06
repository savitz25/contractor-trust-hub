export const ID_SNAPSHOT = {
  regulator: "Idaho Division of Occupational and Professional Licenses, Idaho Contractors Board",
  examinedAt: "2026-10-06",
  program: "contractor registration",
  reportWord:
    "The performance report line says Total Number of Licenses. The board's public program is registration. The report word is not relabeled.",
  namedRoster: "NOT_ACQUIRED",
  publicSearch: "The board public search is a search, not a bulk census.",
  publicSearchUrl: "https://edopl.idaho.gov/OnlineServices/?link=PubSearch",
  personVsBusiness: "NOT_SEPARATED",
  graphWrites: 0,
  newCanonicalEntities: 0,
  combinedContractorDenominator: null,
  complaintIsNotAFinding: "A complaint is not a finding.",
  divisionWideActiveLicenseesJune30Fy2025: 255119,
  divisionWideIsNotAContractorCount: true,
  biennialTransitionBegan: "2025-10-14",
  biennialAdjustsFy2025Count: false,
  feesPublished: false,
  source: {
    title: "Idaho Division of Occupational and Professional Licenses Performance Report",
    url: "https://dopl.idaho.gov/wp-content/uploads/2025/10/FY25-PMR-DOPL.pdf",
    retrievedAt: "2026-10-06",
    bytes: 415599,
    sha256: "5fbe075577e262d5d3c634b0cac7d87a4f301370014e99967257b6a9182a3a4a",
    columns: ["FY 2022", "FY 2023", "FY 2024", "FY 2025"],
    currentColumn: "FY 2025",
    boardRowAsOfDate: "NOT_PRINTED",
  },
  boardSite: {
    url: "https://dopl.idaho.gov/con/",
    retrievedAt: "2026-10-06",
    saysRegistration: true,
  },
  contractorsBoard: {
    name: "IDAHO CONTRACTORS BOARD",
    fy2025: {
      totalNumberOfLicenses: 20597,
      newApplicantsDeniedLicensure: 1,
      applicantsRefusedRenewal: 0,
      complaints: 485,
      finalDisciplinaryActions: 15,
    },
    earlierTotals: {
      fy2022: 20788,
      fy2023: 21775,
      fy2024: 22773,
    },
  },
  separateBoards: [
    {
      id: "electrical",
      name: "ELECTRICAL BOARD",
      fy2025TotalNumberOfLicenses: 19173,
      complaints: 47,
      finalDisciplinaryActions: 16,
    },
    {
      id: "hvac",
      name: "HVAC BOARD",
      fy2025TotalNumberOfLicenses: 6991,
      complaints: 53,
      finalDisciplinaryActions: 3,
    },
    {
      id: "plumbing",
      name: "PLUMBING BOARD",
      fy2025TotalNumberOfLicenses: 8970,
      complaints: 81,
      finalDisciplinaryActions: 14,
    },
    {
      id: "public-works",
      name: "PUBLIC WORKS CONTRACTORS LICENSE BOARD",
      fy2025TotalNumberOfLicenses: 3194,
      complaints: 8,
      finalDisciplinaryActions: 0,
    },
  ],
} as const;

export function idBoard(id: string) {
  const found = ID_SNAPSHOT.separateBoards.find((board) => board.id === id);
  if (!found) throw new Error(`Missing Idaho board ${id}`);
  return found;
}
