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
      "Certified and registered general contractors (CGC, RG) licensed for broad construction and remodeling work.",
    occupationCodes: ["CGC", "RG"],
  },
  {
    slug: "building-contractors",
    label: "Building contractors",
    title: "Building Contractors",
    description:
      "Certified and registered building contractors (CBC, RB) for commercial and residential building construction.",
    occupationCodes: ["CBC", "RB"],
  },
  {
    slug: "residential-contractors",
    label: "Residential contractors",
    title: "Residential Contractors",
    description:
      "Certified and registered residential contractors (CRC, RR) focused on one- and two-family dwellings.",
    occupationCodes: ["CRC", "RR"],
  },
  {
    slug: "roofers",
    label: "Roofers",
    title: "Roofing Contractors",
    description:
      "Certified and registered roofing contractors (CCC, RC) for roof installation and repair. RR is registered residential, not roofing.",
    occupationCodes: ["CCC", "RC"],
  },
  {
    slug: "air-conditioning",
    label: "Air conditioning",
    title: "Air Conditioning Contractors",
    description:
      "Certified and registered air-conditioning contractors (CAC, RA) for HVAC installation and service.",
    occupationCodes: ["CAC", "RA"],
  },
  {
    slug: "plumbing",
    label: "Plumbing",
    title: "Plumbing Contractors",
    description:
      "Certified and registered plumbing contractors (CFC, RF) for plumbing installation and repair.",
    occupationCodes: ["CFC", "RF"],
  },
  {
    slug: "mechanical",
    label: "Mechanical",
    title: "Mechanical Contractors",
    description:
      "Certified and registered mechanical contractors (CMC, RM) for mechanical systems work.",
    occupationCodes: ["CMC", "RM"],
  },
  {
    slug: "pool-spa",
    label: "Pool & spa",
    title: "Pool & Spa Contractors",
    description:
      "Certified and registered pool and spa contractors (CPC, RP) for pool construction and remodeling.",
    occupationCodes: ["CPC", "RP"],
  },
  {
    slug: "underground-utility",
    label: "Underground utility",
    title: "Underground Utility Contractors",
    description:
      "Certified and registered underground utility contractors (CUC, RU) for underground utility and related work.",
    occupationCodes: ["CUC", "RU"],
  },
  {
    slug: "specialty-structures",
    label: "Specialty structures",
    title: "Specialty Structure Contractors",
    description:
      "Certified and registered specialty structure contractors (SCC, RX) for specialty structures such as certain enclosures.",
    occupationCodes: ["SCC", "RX"],
  },
  {
    slug: "solar",
    label: "Solar",
    title: "Solar Contractors",
    description:
      "Certified and registered solar contractors (CVC, RV). Sheet metal (CSC) is a different classification.",
    occupationCodes: ["CVC", "RV"],
  },
];
