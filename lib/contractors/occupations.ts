/**
 * Plain-language Florida construction license class guidance for homeowners.
 * Educational summary — not legal advice and not a substitute for board rules.
 */

export type OccupationInfo = {
  code: string;
  label: string;
  /** What this class typically authorizes (plain language). */
  allows: string;
  /** Common homeowner caveats. */
  notes: string;
};

const INFO: Record<string, OccupationInfo> = {
  CGC: {
    code: "CGC",
    label: "Certified General Contractor",
    allows:
      "Typically may contract for a wide range of building construction and remodeling work that requires a licensed contractor under Florida law, including commercial and residential projects within the scope of a general contractor license.",
    notes:
      "Scope still depends on the specific project and local permitting. Specialty trades (electrical, plumbing, HVAC, roofing, etc.) often require a separately licensed specialty contractor or a properly qualified subcontractor.",
  },
  CBC: {
    code: "CBC",
    label: "Certified Building Contractor",
    allows:
      "Typically may contract for construction, remodeling, and repair of commercial and residential buildings and structures within the certified building contractor classification.",
    notes:
      "Does not automatically authorize every specialty trade. Confirm the trade work on your project is within this license class or will be performed by appropriately licensed specialists.",
  },
  CRC: {
    code: "CRC",
    label: "Certified Residential Contractor",
    allows:
      "Typically limited to residential construction and remodeling (one- and two-family dwellings and related residential structures), not unrestricted commercial general contracting.",
    notes:
      "If your project is commercial or multi-unit beyond residential scope, ask whether a different license class is required.",
  },
  CCC: {
    code: "CCC",
    label: "Certified Roofing Contractor",
    allows:
      "Typically may contract for roof installation, repair, and related roofing work within the certified roofing classification.",
    notes:
      "Roofing projects often require local permits and wind-mitigation compliance. Confirm the exact system (shingle, tile, metal, flat) and warranty terms with the contractor.",
  },
  CFC: {
    code: "CFC",
    label: "Certified Plumbing Contractor",
    allows:
      "Typically may contract for plumbing installation, repair, and related systems work within the certified plumbing classification.",
    notes:
      "Major plumbing changes usually require permits and inspections. Confirm who holds the permit and whether work will be performed by licensed employees.",
  },
  CAC: {
    code: "CAC",
    label: "Certified Air Conditioning Contractor",
    allows:
      "Typically may contract for air-conditioning installation, service, and related HVAC work within the certified air-conditioning classification (class A/B distinctions may apply on the board record).",
    notes:
      "Confirm equipment sizing, permits, and whether refrigerant handling is performed by qualified personnel.",
  },
  CMC: {
    code: "CMC",
    label: "Certified Mechanical Contractor",
    allows:
      "Typically may contract for mechanical systems work (such as HVAC and related mechanical installations) within the certified mechanical classification.",
    notes:
      "Verify the project’s mechanical scope matches this license and that permits are pulled where required.",
  },
  CPC: {
    code: "CPC",
    label: "Certified Pool / Spa Contractor",
    allows:
      "Typically may contract for swimming pool and spa construction, remodeling, and related work within the certified pool/spa classification.",
    notes:
      "Pool projects often involve electrical, plumbing, and structural components — confirm those trades are properly licensed on the job.",
  },
  CUC: {
    code: "CUC",
    label: "Certified Underground Utility Contractor",
    allows:
      "Typically may contract for underground utility and related infrastructure work within the certified underground utility classification.",
    notes:
      "Homeowners hiring for utility laterals or site work should confirm local utility company requirements and permits.",
  },
  SCC: {
    code: "SCC",
    label: "Certified Specialty Structure Contractor",
    allows:
      "Typically covers specialty structures (such as certain aluminum structures, screen enclosures, and related specialty construction) within that classification.",
    notes:
      "Ask how the board classification maps to your exact project (enclosure, carport, specialty structure, etc.).",
  },
  FRO: {
    code: "FRO",
    label: "Financially Responsible Officer",
    allows:
      "An FRO designation relates to financial responsibility for a qualifying business, not a standalone authorization to perform every construction trade personally.",
    notes:
      "Review the associated business and trade licenses on the profile — the FRO alone is not a substitute for the correct contractor classification for the work.",
  },
  QB: {
    code: "QB",
    label: "Qualifying Business",
    allows:
      "A qualifying business record ties a business entity to one or more licensed contractors who qualify the company.",
    notes:
      "Confirm the individual qualifier’s license status and that the business on your contract matches the licensed qualifying business.",
  },
  RR: {
    code: "RR",
    label: "Registered Residential Contractor",
    allows:
      "A registered residential contractor is limited compared with a certified residential or general contractor, often with local jurisdiction conditions under Florida’s registered vs certified framework.",
    notes:
      "RR is not a roofing license. Registered roofing is RC. Confirm where the registration is valid.",
  },
  RC: {
    code: "RC",
    label: "Registered Roofing Contractor",
    allows:
      "A registered (as opposed to certified) roofing contractor may have more limited geographic or scope conditions under Florida’s registered vs certified framework.",
    notes:
      "Confirm where the registration is valid and whether your project location and work type are covered. Certified roofing is CCC.",
  },
  RF: {
    code: "RF",
    label: "Registered Plumbing Contractor",
    allows:
      "A registered plumbing contractor covers plumbing work under Florida’s registered contractor framework, often with local jurisdiction considerations.",
    notes:
      "Verify that the registration applies where the work will be performed. Certified plumbing is CFC.",
  },
  CVC: {
    code: "CVC",
    label: "Certified Solar Contractor",
    allows:
      "Typically may contract for solar installation work within the certified solar contractor classification.",
    notes:
      "CVC is solar, not sheet metal (CSC). Confirm system type, permits, and whether electrical work is performed by a licensed electrical contractor.",
  },
  CSC: {
    code: "CSC",
    label: "Certified Sheet Metal Contractor",
    allows:
      "Typically may contract for sheet metal work within the certified sheet metal classification.",
    notes: "CSC is not a solar license. Certified solar is CVC.",
  },
};

export function getOccupationInfo(code: string | null | undefined): OccupationInfo {
  if (!code) {
    return {
      code: "",
      label: "Construction license",
      allows:
        "This profile lists a Florida construction-related license. Exact work authorized depends on the occupation code and board rules for that class.",
      notes:
        "Ask the contractor which license class covers your project and confirm it on the official DBPR record.",
    };
  }
  const upper = code.toUpperCase();
  if (INFO[upper]) return INFO[upper];
  return {
    code: upper,
    label: `${upper} license`,
    allows: `Florida DBPR occupation code ${upper}. Exact contract authority depends on the Construction Industry Licensing Board definition for this class.`,
    notes:
      "We show the board occupation code as published. Confirm scope for your project type on the official board site before hiring.",
  };
}
