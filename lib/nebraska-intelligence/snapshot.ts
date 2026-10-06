export const NE_SNAPSHOT = {
  id: "NE-CON-001",
  regulator: "Nebraska Department of Labor",
  program: "Contractor Registration",
  examinedAt: "2026-10-06",
  sources: {
    registrationHome: "https://dol.nebraska.gov/conreg",
    whoMustRegister: "https://dol.nebraska.gov/LaborStandards/Contractors/Overview",
    search: "https://dol.nebraska.gov/conreg/Search",
    unpaidFines:
      "https://dol.nebraska.gov/webdocs/getfile/a757385b-fb35-4e5d-b37e-1e436bbee824",
  },
  requirement:
    "The Nebraska Contractor Registration Act requires contractors and subcontractors doing business in Nebraska to register. A contractor is any person or business, including subcontractors and general contractors, who engage in or arrange for work on real property other than their own property.",
  qualityEndorsement: false,
  qualityStatement:
    "While the registration is a requirement, it does not ensure quality of work or protect against fraud.",
  annualFeeUsd: 40,
  annualFeeEffective: "2026-08-01",
  feeIsCurrentCompliance: false,
  roster: "NOT_ACQUIRED",
  rosterReason:
    "The public contractor search is a lookup. It was not scraped into a bulk census.",
  workersCompRequirement:
    "A contractor with one or more employees must file a current workers' compensation certificate, ACORD 25, naming the Department of Labor as certificate holder. Expired coverage can remove the contractor from the registered list until an updated certificate arrives.",
  workersCompObservations: "NOT_ACQUIRED",
  electricalCensus: "NOT_ACQUIRED",
  plumbingCensus: "NOT_ACQUIRED",
  tradesCombinedIntoContractorCensus: false,
  ndotPrequalifiedListUsedAsCensus: false,
  unpaidFinesRows: "NOT_ACQUIRED",
  graphWrites: 0,
  newCanonicalEntities: 0,
} as const;
