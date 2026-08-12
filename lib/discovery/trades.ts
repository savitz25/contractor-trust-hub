import type { TradeDef } from "./types";

/**
 * Major consumer-facing Florida license categories.
 * Codes map to DBPR occupation_code; multiple codes can share one trade page.
 */
export const FLORIDA_TRADES: TradeDef[] = [
  {
    slug: "general-contractors",
    label: "General contractors",
    title: "General Contractors",
    description:
      "Certified general contractors (CGC) licensed for broad construction and remodeling work.",
    occupationCodes: ["CGC"],
  },
  {
    slug: "building-contractors",
    label: "Building contractors",
    title: "Building Contractors",
    description:
      "Certified building contractors (CBC) for commercial and residential building construction.",
    occupationCodes: ["CBC"],
  },
  {
    slug: "residential-contractors",
    label: "Residential contractors",
    title: "Residential Contractors",
    description:
      "Certified residential contractors (CRC) focused on one- and two-family dwellings.",
    occupationCodes: ["CRC"],
  },
  {
    slug: "roofers",
    label: "Roofers",
    title: "Roofing Contractors",
    description:
      "Certified and registered roofing contractors (CCC, RR) for roof installation and repair.",
    occupationCodes: ["CCC", "RR"],
  },
  {
    slug: "air-conditioning",
    label: "Air conditioning",
    title: "Air Conditioning Contractors",
    description:
      "Certified air-conditioning contractors (CAC) for HVAC installation and service.",
    occupationCodes: ["CAC"],
  },
  {
    slug: "plumbing",
    label: "Plumbing",
    title: "Plumbing Contractors",
    description: "Certified plumbing contractors (CFC) for plumbing installation and repair.",
    occupationCodes: ["CFC"],
  },
  {
    slug: "mechanical",
    label: "Mechanical",
    title: "Mechanical Contractors",
    description: "Certified mechanical contractors (CMC) for mechanical systems work.",
    occupationCodes: ["CMC"],
  },
  {
    slug: "pool-spa",
    label: "Pool & spa",
    title: "Pool & Spa Contractors",
    description: "Certified pool and spa contractors (CPC) for pool construction and remodeling.",
    occupationCodes: ["CPC"],
  },
  {
    slug: "underground-utility",
    label: "Underground utility",
    title: "Underground Utility Contractors",
    description:
      "Certified underground utility contractors (CUC) for underground utility and related work.",
    occupationCodes: ["CUC"],
  },
  {
    slug: "specialty-structures",
    label: "Specialty structures",
    title: "Specialty Structure Contractors",
    description:
      "Certified specialty structure contractors (SCC) for specialty structures such as certain enclosures.",
    occupationCodes: ["SCC"],
  },
];
