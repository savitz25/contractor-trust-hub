import type { TradeDef } from "@/lib/discovery/types";

/**
 * Consumer endorsement families → published CCB license_type codes.
 */
export const OREGON_TRADES: TradeDef[] = [
  {
    slug: "residential-general",
    label: "Residential general",
    title: "Residential General Contractors",
    description:
      "Published CCB Residential General Contractor (RGC) endorsement — the usual statewide residential contracting credential.",
    occupationCodes: ["RGC"],
  },
  {
    slug: "residential-specialty",
    label: "Residential specialty",
    title: "Residential Specialty Contractors",
    description:
      "Published CCB Residential Specialty Contractor (RSC). The type code does not name the trade — RSC is not proof of roofing, HVAC, plumbing, or electrical.",
    occupationCodes: ["RSC"],
  },
  {
    slug: "residential-limited",
    label: "Residential limited",
    title: "Residential Limited Contractors",
    description: "Published CCB Residential Limited Contractor (RLC). Scope is narrower than RGC.",
    occupationCodes: ["RLC"],
  },
  {
    slug: "commercial-general",
    label: "Commercial general",
    title: "Commercial General Contractors",
    description: "Published CCB commercial general endorsements (CGC1 and CGC2).",
    occupationCodes: ["CGC1", "CGC2"],
  },
  {
    slug: "commercial-specialty",
    label: "Commercial specialty",
    title: "Commercial Specialty Contractors",
    description: "Published CCB commercial specialty endorsements (CSC1 and CSC2).",
    occupationCodes: ["CSC1", "CSC2"],
  },
  {
    slug: "restoration",
    label: "Restoration",
    title: "Residential restoration",
    description: "Published CCB Residential Restoration Contractor (RRC) endorsement.",
    occupationCodes: ["RRC"],
  },
  {
    slug: "lead-renovation",
    label: "Lead renovation",
    title: "Lead-based paint renovation",
    description:
      "Published CCB lead-based paint renovation credential (LBPR) — not a general contractor license by itself.",
    occupationCodes: ["LBPR"],
  },
];
