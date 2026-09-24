export type CapabilityState = "KNOWN" | "UNKNOWN" | "PARTIAL" | "NOT_ACQUIRED" | "REQUEST_ONLY" | "UNSUPPORTED";

export type GaCredentialClass = {
  id: string;
  board: string;
  label: string;
  grain: string;
  coverage: CapabilityState;
  note: string;
};

export type GaCeaseAndDesist = {
  id: string;
  respondent: string;
  dba: string | null;
  location: string;
  practiceCategory: string;
  actionType: "unlicensed_practice_cease_and_desist";
  orderDate: null;
  licenseNumber: null;
  attribution: "name_and_place_only_not_joined";
};

export const GA_RETRIEVED_AT = "2026-09-23";
export const GA_GENERATED_AT = "2026-09-23T00:00:00.000Z";

export const GA_CREDENTIAL_CLASSES: GaCredentialClass[] = [
  {
    id: "rgc-residential-basic",
    board: "State Licensing Board for Residential and Commercial General Contractors — Residential division",
    label: "Residential Basic",
    grain: "individual qualifying credential; business work is through a qualifying agent, not a second contractor count",
    coverage: "NOT_ACQUIRED",
    note: "Regulated statewide in GOALS. Bulk roster is a paid SOS text file. This hub has not purchased it. Verify one license at the GOALS lookup.",
  },
  {
    id: "rgc-residential-light-commercial",
    board: "State Licensing Board for Residential and Commercial General Contractors — Residential division",
    label: "Residential Light Commercial",
    grain: "individual qualifying credential",
    coverage: "NOT_ACQUIRED",
    note: "Distinct from Residential Basic and from Commercial General. Not included in any count on this page.",
  },
  {
    id: "rgc-commercial-general",
    board: "State Licensing Board for Residential and Commercial General Contractors — Commercial division",
    label: "Commercial General Contractor",
    grain: "individual qualifying credential",
    coverage: "NOT_ACQUIRED",
    note: "Statewide commercial/general credential. Paid roster not purchased.",
  },
  {
    id: "cilb-electrical",
    board: "Construction Industry Licensing Board — Electrical",
    label: "Electrical contractor (restricted and non-restricted)",
    grain: "trade credential class; restricted is not the same license as non-restricted",
    coverage: "NOT_ACQUIRED",
    note: "Board exists and licenses through GOALS. No free statewide roster was found. Older SOS fee schedule listed roster prices; the 2025 form sells GOALS professions inside the all-rosters package.",
  },
  {
    id: "cilb-plumbing",
    board: "Construction Industry Licensing Board — Plumbing",
    label: "Plumbing (restricted, non-restricted, journeyman)",
    grain: "trade credential class",
    coverage: "NOT_ACQUIRED",
    note: "Journeyman is not a contractor company. Classes stay separate. Roster not purchased.",
  },
  {
    id: "cilb-conditioned-air",
    board: "Construction Industry Licensing Board — Conditioned Air",
    label: "Conditioned Air / HVAC (Class I restricted and Class II non-restricted)",
    grain: "trade credential class",
    coverage: "NOT_ACQUIRED",
    note: "Class I is not Class II. No current compliance extract for insurance or EPA cards.",
  },
  {
    id: "cilb-low-voltage",
    board: "Construction Industry Licensing Board — Low Voltage",
    label: "Low Voltage",
    grain: "trade credential class",
    coverage: "NOT_ACQUIRED",
    note: "Regulated. Not acquired.",
  },
  {
    id: "cilb-utility",
    board: "Construction Industry Licensing Board — Utility",
    label: "Utility contractor / manager / foreman",
    grain: "trade credential class",
    coverage: "NOT_ACQUIRED",
    note: "Foreman is not a utility contractor. Not acquired.",
  },
];

/** Parsed from the public SOS HTML list. No order date is printed on that page. Not joined to licensees. */
export const GA_CEASE_AND_DESIST: GaCeaseAndDesist[] = [
  ["ga-cnd-001", "Clifford Merritt", null, "Americus", "Residential/General Contractor"],
  ["ga-cnd-002", "Richard Deloach", null, "Claxton", "Residential/General Contractor"],
  ["ga-cnd-003", "Leland McCall", null, "Reidsville", "Residential/General Contractor"],
  ["ga-cnd-004", "Alex McCullum", null, "Warner Robins", "Residential/General Contractor"],
  ["ga-cnd-005", "Samuel Stockton", null, "Houston County", "Residential/General Contractor"],
  ["ga-cnd-006", "Fred Bush", null, "Decatur", "Residential Contractor"],
  ["ga-cnd-007", "Donald James Chancey, Jr.", null, "Winder", "Residential/General Contractor"],
  ["ga-cnd-008", "March Hoefert", null, "Pine Mountain Valley", "Residential/General Contractor"],
  ["ga-cnd-009", "James L. Kerby, Jr.", null, "Savannah", "Residential/General Contractor"],
  ["ga-cnd-010", "Dale Fish", null, "Gray", "Residential/General Contractor"],
  ["ga-cnd-011", "Rodney Sessions", null, "Young Harris", "Residential/General Contractor"],
  ["ga-cnd-012", "David Kehren, Jr.", null, "Leesburg", "Residential/General Contractor"],
  ["ga-cnd-013", "Michael Oliver", null, "Helena", "Residential/General Contractor"],
  ["ga-cnd-014", "Walter Conway", "Sawhaven Renovations", "Alpharetta", "Residential/General Contractor"],
  ["ga-cnd-015", "Tera Gore", null, "Cartersville", "Residential/General Contractor"],
  ["ga-cnd-016", "James Hardin", "Black River Construction", "Macon", "Residential/General Contractor"],
  ["ga-cnd-017", "Brian Holden", null, "Ellabell", "Residential/General Contractor"],
  ["ga-cnd-018", "Chris S. Harris", "Chris S. Harris Construction", "Perry", "Residential/General Contractor"],
  ["ga-cnd-019", "Clyde Sawyer", null, "Jonesboro", "Residential/General Contractor"],
  ["ga-cnd-020", "Summerville Renovations", null, "Augusta", "Residential/General Contractor"],
  ["ga-cnd-021", "Robert Gary Dave, Sr.", null, "Lake Park", "Residential/General Contractor"],
  ["ga-cnd-022", "Metro Power, Inc.", null, "Albany", "Residential/General Contractor"],
  ["ga-cnd-023", "Gregory J. Roesch", null, "Toccoa", "Residential/General Contractor"],
  ["ga-cnd-024", "Edward Sabarian", "Blue Ridge Stone Co., Inc.", "Griffin", "Residential/General Contractor"],
  ["ga-cnd-025", "Judith Smith", "Affordable Basement Visions", "Roswell", "Residential/General Contractor"],
  ["ga-cnd-026", "Stephen Taylor", null, "Georgetown", "Residential/General Contractor"],
  ["ga-cnd-027", "Michael Sullivan", "Sullivan Home Repair", "Peachtree City", "Residential/General Contractor"],
  ["ga-cnd-028", "James L Wilson", "Wilson Construction & Home Maintenance", "Stone Mountain", "Residential/General Contractor"],
  ["ga-cnd-029", "South Newport Baptist Church", null, "Townsend", "Residential/General Contractor"],
  ["ga-cnd-030", "Bubba Morgan", null, "Franklin", "Residential/General Contractor"],
  ["ga-cnd-031", "Bradley Dean", null, "Stockbridge", "Residential/General Contractor"],
  ["ga-cnd-032", "Vladislav Velecky", "VV Contracting", "Marietta", "Residential/General Contractor"],
  ["ga-cnd-033", "Michael Borchert", null, "Cleveland", "Residential/General Contractor"],
  ["ga-cnd-034", "Buba Bojang", null, "Smyrna", "Residential/General Contractor"],
  ["ga-cnd-035", "Terry Roberts", "Roberts Rehab Consulting", "Clermont", "Residential/General Contractor"],
  ["ga-cnd-036", "John Wesley Turner", null, "College Park", "Residential/General Contractor"],
].map(([id, respondent, dba, location, practiceCategory]) => ({
  id,
  respondent,
  dba,
  location,
  practiceCategory,
  actionType: "unlicensed_practice_cease_and_desist" as const,
  orderDate: null,
  licenseNumber: null,
  attribution: "name_and_place_only_not_joined" as const,
}));
