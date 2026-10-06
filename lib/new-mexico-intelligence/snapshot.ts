export const NM_SNAPSHOT = {
  regulator: "New Mexico Regulation and Licensing Department, Construction Industries Division",
  examinedAt: "2026-10-06",
  namedRoster: "NOT_ACQUIRED",
  publicSearch: "PSI and RLD public search are searches, not a bulk census.",
  observedBondOrInsurance: "NOT_ACQUIRED",
  enforcementCorpus: "NOT_ACQUIRED",
  complaintIsNotAFinding: "A complaint is not a finding.",
  graphWrites: 0,
  newCanonicalEntities: 0,
  combinedContractorDenominator: null,
  cities: ["Albuquerque", "Santa Fe"],
  current: {
    role: "current-printed-table",
    sourceTitle: "NMRLD 2026 Strategic Plan",
    sourceUrl: "https://www.rld.nm.gov/wp-content/uploads/2025/12/NMRLD-2026-StrategicPlan-Final.pdf",
    retrievedAt: "2026-10-06",
    bytes: 4412742,
    sha256: "f9c46a8c7933ebcda106de2059cddf6c40c76d8c7310d0ed4293f969d33242b1",
    filePathMonth: "December 2025",
    adjacentPages: "Adjacent pages print FY25 actuals.",
    bureaus: ["Electrical", "Elevator", "General Construction", "LP Gas", "Mechanical Plumbing"],
    elevatorBureauEstablished: "FY25",
    elevatorLicenseeCount: "NOT_ACQUIRED",
    statedClassifications: 78,
    classificationCounts: "NOT_SEPARATED",
    proseContractingBusinessesRoughly: 17433,
    proseCertificateHolders: 44495,
    // Sum of the six lines below. Not a contractor-company count.
    printedTotal: 61986,
    lines: [
      { id: "qualifying-parties", label: "Qualifying Parties", count: 24854, kind: "certificate-holder" },
      { id: "qualifying-parties-lp", label: "Qualifying Parties LP", count: 2617, kind: "certificate-holder" },
      { id: "journeyman", label: "Journeyman Licenses", count: 17024, kind: "certificate-holder" },
      { id: "companies", label: "Licensee - Companies", count: 16769, kind: "contracting-business" },
      { id: "lp", label: "Licensee - LP", count: 664, kind: "contracting-business" },
      { id: "secondhand-metal", label: "Secondhand Metal Dealers", count: 58, kind: "outside-prose-groups" },
    ],
    permitsIssued: 33377,
    inspections: 88016,
  },
  earlier: {
    role: "earlier-document",
    sourceTitle: "Regulation and Licensing Department budget form",
    sourceUrl: "https://www.nmdfa.state.nm.us/wp-content/uploads/2026/05/Regulation-and-Licensing-Department-1.pdf",
    retrievedAt: "2026-10-06",
    bytes: 4283569,
    sha256: "8e6eae2985660db48102ab74273121de7d4a3b7706a76f3877241cf53addae66",
    runDate: "Tuesday, September 3, 2024",
    bureauCount: 4,
    includesElevator: false,
    proseContractingBusinessesRoughly: 16055,
    proseCertificateHoldersMoreThan: 16839,
    // The six lines do not equal this total. The gap is unlabeled.
    printedTotal: 59894,
    lines: [
      { id: "qualifying-parties", label: "Qualifying Parties", count: 22702, kind: "certificate-holder" },
      { id: "qualifying-parties-lp", label: "Qualifying Parties LP", count: 2436, kind: "certificate-holder" },
      { id: "journeyman", label: "Journeyman Licenses", count: 16132, kind: "certificate-holder" },
      { id: "companies", label: "Licensee - Companies", count: 15375, kind: "contracting-business" },
      { id: "lp", label: "Licensee - LP", count: 646, kind: "contracting-business" },
      { id: "secondhand-metal", label: "Secondhand Metal Dealers", count: 62, kind: "outside-prose-groups" },
    ],
    recycledMetalsDealersHighlight: 63,
    craneOperators: 360,
    permitsIssued: 33872,
    inspections: 97076,
  },
  manufacturedHousing: {
    separateFromCid: true,
    current: {
      narrativeActiveContractors: 1447,
      narrativeSalespersons: 179,
      tableTotal: 1880,
      lines: [
        { id: "crossover", label: "Crossover", count: 1447 },
        { id: "dealers", label: "Dealers", count: 96 },
        { id: "installers", label: "Installers", count: 122 },
        { id: "manufacturers", label: "Manufacturers", count: 36 },
        { id: "salespersons", label: "Salespersons", count: 179 },
      ],
      permits: 7196,
      inspections: 9199,
    },
    earlier: {
      narrativeActiveContractors: 1519,
      narrativeSalespersons: 169,
      tableTotal: 1949,
      lines: [
        { id: "crossover", label: "Crossover", count: 1519 },
        { id: "dealers", label: "Dealers", count: 90 },
        { id: "installers", label: "Installers", count: 141 },
        { id: "manufacturers", label: "Manufacturers", count: 30 },
        { id: "salespersons", label: "Salespersons", count: 169 },
      ],
      permits: 6925,
      inspections: 8252,
    },
  },
} as const;

export function nmCount<T extends { id: string; count: number }>(lines: readonly T[], id: string): number {
  const found = lines.find((line) => line.id === id);
  if (!found) throw new Error(`Missing New Mexico line ${id}`);
  return found.count;
}

export function sumLineCounts(lines: readonly { count: number }[]): number {
  return lines.reduce((sum, line) => sum + line.count, 0);
}
