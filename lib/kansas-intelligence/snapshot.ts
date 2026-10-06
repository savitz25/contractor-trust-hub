export const KS_SNAPSHOT = {
  examinedAt: "2026-10-06",
  generalContractorStatewideLicense: "NOT_ESTABLISHED",
  generalContractorBoundary:
    "Kansas identifies city and county licensing requirements; no universal statewide general-contractor roster is claimed.",
  sources: {
    construction: "https://ksbiz.kansas.gov/business-starter-kit/construction/",
    roofing: "https://www.ag.ks.gov/divisions/civil/licensing-inspections/roofing-registration",
    roofingDirectory:
      "https://www.ag.ks.gov/divisions/public-protection/resources/roofing-registration-directory",
    elevator: "https://www.firemarshal.ks.gov/342/Elevator-Safety-Program",
    elevatorContractors:
      "https://www.firemarshal.ks.gov/DocumentCenter/View/2371/Contractors-Phone-List",
    elevatorInspectors:
      "https://www.firemarshal.ks.gov/DocumentCenter/View/2372/Inspectors-Phone-List",
    elevatorMechanics:
      "https://www.firemarshal.ks.gov/DocumentCenter/View/2370/Mechanics-Phone-List",
  },
  roofing: {
    population: "NOT_ACQUIRED",
    acquisition: "Interactive lookup; no bulk statewide extract acquired.",
    note: "Registration applies generally to fee-based commercial or residential roofing, subject to statutory exemptions. Directory status is not an endorsement.",
  },
  elevator: {
    sourceTitle: "Kansas State Fire Marshal licensed elevator directories",
    sourceClock: "Directory PDFs dated 2026-08-17",
    sourceHashes: {
      contractors:
        "f1835d913eee361e78419deb5cc1f62367d976d488a378bfecc2db21df88b1e0",
      inspectors:
        "f9192a61f4733ab657a599a9ed8d6e93242719cdc8109ec2b3f5e43ab47c5ca0",
      mechanics:
        "6114eb87bacea5af0556f86bd44dfbd54b23a6600cd7a6f5003389eb0b10c79a",
    },
    rows: [
      {
        id: "contractors",
        label: "Elevator contractor directory entries",
        rows: 33,
        sourceUrl:
          "https://www.firemarshal.ks.gov/DocumentCenter/View/2371/Contractors-Phone-List",
        sha256:
          "f1835d913eee361e78419deb5cc1f62367d976d488a378bfecc2db21df88b1e0",
        grain: "Company/contact directory entries; distinct printed company labels. Not a statewide general-contractor count.",
      },
      {
        id: "inspectors",
        label: "Elevator inspector directory entries",
        rows: 33,
        sourceUrl:
          "https://www.firemarshal.ks.gov/DocumentCenter/View/2372/Inspectors-Phone-List",
        sha256:
          "f9192a61f4733ab657a599a9ed8d6e93242719cdc8109ec2b3f5e43ab47c5ca0",
        grain: "Person/contact directory entries. No individual license number, status, or expiration published in this directory extract.",
      },
      {
        id: "mechanics",
        label: "Elevator mechanic directory entries",
        rows: 259,
        sourceUrl:
          "https://www.firemarshal.ks.gov/DocumentCenter/View/2370/Mechanics-Phone-List",
        sha256:
          "6114eb87bacea5af0556f86bd44dfbd54b23a6600cd7a6f5003389eb0b10c79a",
        grain: "Person/contact directory entries. No individual license number, status, or expiration published in this directory extract.",
      },
    ],
    exceptions:
      "Some municipalities with approved elevator programs are exempt from state licensing within their jurisdiction; state directory is not necessarily the complete statewide work population.",
  },
  additionalStatewideTradeCensuses: "NOT_ACQUIRED",
  enforcement: "NOT_ACQUIRED",
  existingMatches: "NOT_ACQUIRED",
  newCanonicalEntities: 0,
  evidenceAttachments: 0,
  graphWrites: 0,
} as const;
