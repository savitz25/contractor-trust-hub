/**
 * Official Florida CILB occupation codes (board 06).
 * Do not silently merge these into consumer buckets without documenting the map.
 * Source: https://www2.myfloridalicense.com/about-us/understanding-dbpr-codes/
 */

export type OccupationKind =
  | "certified_trade"
  | "registered_trade"
  | "qualifying_business"
  | "financially_responsible_officer"
  | "education_non_credential"
  | "other";

export type FloridaOccupationDef = {
  code: string;
  officialName: string;
  kind: OccupationKind;
  /** Consumer intelligence bucket — documented mapping, not a board class. */
  intelligenceBucket:
    | "general"
    | "building"
    | "residential"
    | "roofing"
    | "hvac_air_conditioning"
    | "plumbing"
    | "mechanical"
    | "pool_spa"
    | "underground_utility"
    | "specialty_structure"
    | "sheet_metal"
    | "solar"
    | "pollutant_storage"
    | "qualifier_related"
    | "education"
    | "other";
};

export const FLORIDA_CILB_OCCUPATIONS: Record<string, FloridaOccupationDef> = {
  CAC: {
    code: "CAC",
    officialName: "Certified Air Conditioning Contractor",
    kind: "certified_trade",
    intelligenceBucket: "hvac_air_conditioning",
  },
  CBC: {
    code: "CBC",
    officialName: "Certified Building Contractor",
    kind: "certified_trade",
    intelligenceBucket: "building",
  },
  CCC: {
    code: "CCC",
    officialName: "Certified Roofing Contractor",
    kind: "certified_trade",
    intelligenceBucket: "roofing",
  },
  CFC: {
    code: "CFC",
    officialName: "Certified Plumbing Contractor",
    kind: "certified_trade",
    intelligenceBucket: "plumbing",
  },
  CGC: {
    code: "CGC",
    officialName: "Certified General Contractor",
    kind: "certified_trade",
    intelligenceBucket: "general",
  },
  CMC: {
    code: "CMC",
    officialName: "Certified Mechanical Contractor",
    kind: "certified_trade",
    intelligenceBucket: "mechanical",
  },
  CPC: {
    code: "CPC",
    officialName: "Certified Pool/Spa Contractor",
    kind: "certified_trade",
    intelligenceBucket: "pool_spa",
  },
  CRC: {
    code: "CRC",
    officialName: "Certified Residential Contractor",
    kind: "certified_trade",
    intelligenceBucket: "residential",
  },
  CSC: {
    code: "CSC",
    officialName: "Certified Sheet Metal Contractor",
    kind: "certified_trade",
    intelligenceBucket: "sheet_metal",
  },
  CUC: {
    code: "CUC",
    officialName: "Certified Utility & Excavation Contractor",
    kind: "certified_trade",
    intelligenceBucket: "underground_utility",
  },
  CVC: {
    code: "CVC",
    officialName: "Certified Solar Contractor",
    kind: "certified_trade",
    intelligenceBucket: "solar",
  },
  SCC: {
    code: "SCC",
    officialName: "Certified Specialty Contractor",
    kind: "certified_trade",
    intelligenceBucket: "specialty_structure",
  },
  PCC: {
    code: "PCC",
    officialName: "Certified Pollutant Storage Contractor",
    kind: "certified_trade",
    intelligenceBucket: "pollutant_storage",
  },
  RA: {
    code: "RA",
    officialName: "Registered Air Conditioning Contractor",
    kind: "registered_trade",
    intelligenceBucket: "hvac_air_conditioning",
  },
  RB: {
    code: "RB",
    officialName: "Registered Building Contractor",
    kind: "registered_trade",
    intelligenceBucket: "building",
  },
  RC: {
    code: "RC",
    officialName: "Registered Roofing Contractor",
    kind: "registered_trade",
    intelligenceBucket: "roofing",
  },
  RF: {
    code: "RF",
    officialName: "Registered Plumbing Contractor",
    kind: "registered_trade",
    intelligenceBucket: "plumbing",
  },
  RG: {
    code: "RG",
    officialName: "Registered General Contractor",
    kind: "registered_trade",
    intelligenceBucket: "general",
  },
  RM: {
    code: "RM",
    officialName: "Registered Mechanical Contractor",
    kind: "registered_trade",
    intelligenceBucket: "mechanical",
  },
  RP: {
    code: "RP",
    officialName: "Registered Pool/Spa Contractor",
    kind: "registered_trade",
    intelligenceBucket: "pool_spa",
  },
  RQ: {
    code: "RQ",
    officialName: "Registered Precision Tank Tester",
    kind: "registered_trade",
    intelligenceBucket: "pollutant_storage",
  },
  RR: {
    code: "RR",
    officialName: "Registered Residential Contractor",
    kind: "registered_trade",
    intelligenceBucket: "residential",
  },
  RS: {
    code: "RS",
    officialName: "Registered Sheet Metal Contractor",
    kind: "registered_trade",
    intelligenceBucket: "sheet_metal",
  },
  RU: {
    code: "RU",
    officialName: "Registered Underground Utility Excavator",
    kind: "registered_trade",
    intelligenceBucket: "underground_utility",
  },
  RV: {
    code: "RV",
    officialName: "Registered Solar Contractor",
    kind: "registered_trade",
    intelligenceBucket: "solar",
  },
  RX: {
    code: "RX",
    officialName: "Registered Specialty Contractor",
    kind: "registered_trade",
    intelligenceBucket: "specialty_structure",
  },
  QB: {
    code: "QB",
    officialName: "Construction Business Information",
    kind: "qualifying_business",
    intelligenceBucket: "qualifier_related",
  },
  FRO: {
    code: "FRO",
    officialName: "Financial Responsible Officer",
    kind: "financially_responsible_officer",
    intelligenceBucket: "qualifier_related",
  },
  PVDR: {
    code: "PVDR",
    officialName: "Course Provider",
    kind: "education_non_credential",
    intelligenceBucket: "education",
  },
  CRS1: {
    code: "CRS1",
    officialName: "CILB Course",
    kind: "education_non_credential",
    intelligenceBucket: "education",
  },
};

/** Occupations that must not be unlabeled as contractor trade credentials. */
export const NON_TRADE_OCCUPATION_CODES = ["FRO", "CRS1", "PVDR", "QB"] as const;

/** Trade credentials that may be counted as contractor licenses. Excludes QB/FRO/education. */
export function isContractorTradeOccupation(code: string | null | undefined): boolean {
  const def = FLORIDA_CILB_OCCUPATIONS[(code || "").toUpperCase()];
  return Boolean(def && (def.kind === "certified_trade" || def.kind === "registered_trade"));
}

export const INTELLIGENCE_TRADE_BUCKETS: Record<string, string[]> = {
  general: ["CGC", "RG"],
  building: ["CBC", "RB"],
  residential: ["CRC", "RR"],
  roofing: ["CCC", "RC"],
  hvac_air_conditioning: ["CAC", "RA"],
  plumbing: ["CFC", "RF"],
  mechanical: ["CMC", "RM"],
  pool_spa: ["CPC", "RP"],
  underground_utility: ["CUC", "RU"],
  specialty_structure: ["SCC", "RX"],
  sheet_metal: ["CSC", "RS"],
  solar: ["CVC", "RV"],
  pollutant_storage: ["PCC", "RQ"],
};

/** Common mislabels that must never be treated as equivalent. */
export const OCCUPATION_NON_EQUIVALENCE = {
  RR_is_not_roofing: {
    code: "RR",
    officialName: "Registered Residential Contractor",
    not: "Registered Roofing Contractor",
    roofingCode: "RC",
  },
  CSC_is_not_solar: {
    code: "CSC",
    officialName: "Certified Sheet Metal Contractor",
    not: "Certified Solar Contractor",
    solarCode: "CVC",
  },
  FRO_is_not_a_trade_license: {
    code: "FRO",
    officialName: "Financial Responsible Officer",
  },
  QB_is_not_a_credential: {
    code: "QB",
    officialName: "Construction Business Information",
  },
} as const;
