/**
 * Oregon consumer project → CCB license-type map.
 * CCB does not publish a separate roofing / HVAC / plumbing / electrical
 * type code on the Active Licenses extract — those project pages start with
 * RGC and say so plainly.
 */

export type OrRelatedTrade = {
  slug: string;
  label: string;
  note: string;
};

export type OrProjectDef = {
  slug: string;
  label: string;
  title: string;
  description: string;
  primaryCodes: string[];
  secondaryCodes: string[];
  matchHeadline: string;
  officialLabel: string;
  matchNote: string;
  /** What this extract cannot prove — shown on specialty-style project pages */
  extractCannotProve?: string;
  alsoNeeded: OrRelatedTrade[];
};

export const OREGON_PROJECTS: OrProjectDef[] = [
  {
    slug: "kitchen-remodel",
    label: "Kitchen remodel",
    title: "Kitchen remodel",
    description:
      "Residential kitchen remodeling. Oregon CCB usually contracts this under Residential General (RGC).",
    primaryCodes: ["RGC"],
    secondaryCodes: ["RLC", "RSC"],
    matchHeadline: "Residential general contractor licenses",
    officialLabel: "RGC",
    matchNote:
      "Kitchen remodels are matched to published Residential General Contractor (RGC). This extract has no kitchen or cabinet type code.",
    extractCannotProve:
      "RSC, if added when a view is thin, is an unnamed specialty — not proof of cabinets, electrical, or plumbing.",
    alsoNeeded: [
      { slug: "residential-specialty", label: "Residential specialty", note: "If a specialty firm holds the contract" },
    ],
  },
  {
    slug: "bathroom-remodel",
    label: "Bathroom remodel",
    title: "Bathroom remodel",
    description: "Residential bath remodeling. Matched to published RGC first.",
    primaryCodes: ["RGC"],
    secondaryCodes: ["RLC", "RSC"],
    matchHeadline: "Residential general contractor licenses",
    officialLabel: "RGC",
    matchNote:
      "Bathroom remodels are matched to published RGC. This extract does not isolate a plumbing-only CCB type.",
    extractCannotProve:
      "RSC, if added when a view is thin, is an unnamed specialty — not proof of plumbing or tile work.",
    alsoNeeded: [
      { slug: "residential-specialty", label: "Residential specialty", note: "If the contract is specialty-only" },
    ],
  },
  {
    slug: "roofing",
    label: "Roofing",
    title: "Roofing",
    description:
      "Roof work in Oregon. This extract has no separate roofing type code — RGC is the honest primary match.",
    primaryCodes: ["RGC"],
    secondaryCodes: ["RSC"],
    matchHeadline: "Residential general licenses — not a roofing-specialty list",
    officialLabel: "RGC",
    matchNote:
      "This extract has no roofing endorsement code, so the list starts with Residential General Contractor (RGC). That is the published type we can filter on.",
    extractCannotProve:
      "A row here is not proof the firm is a roofer. RSC, if added when a county is thin, does not name the specialty.",
    alsoNeeded: [],
  },
  {
    slug: "addition",
    label: "Addition",
    title: "Addition or extension",
    description: "Residential additions. Published RGC is the usual contracting credential.",
    primaryCodes: ["RGC"],
    secondaryCodes: ["RLC"],
    matchHeadline: "Residential general contractor licenses",
    officialLabel: "RGC",
    matchNote:
      "Additions are matched to published RGC. RLC (residential limited) is secondary only when a view is thin — its scope is narrower than RGC.",
    alsoNeeded: [
      { slug: "residential-specialty", label: "Residential specialty", note: "If specialty work is separately contracted" },
    ],
  },
  {
    slug: "whole-home",
    label: "Whole-home renovation",
    title: "Whole-home renovation",
    description: "Broad residential renovation. Matched to published RGC.",
    primaryCodes: ["RGC"],
    secondaryCodes: ["RLC"],
    matchHeadline: "Residential general contractor licenses",
    officialLabel: "RGC",
    matchNote:
      "Whole-home work is matched to published RGC. This is not a claim that one license covers every trade on the job.",
    alsoNeeded: [
      { slug: "residential-specialty", label: "Residential specialty", note: "If parts of the job are specialty contracts" },
    ],
  },
  {
    slug: "new-build",
    label: "New build",
    title: "New build or custom home",
    description: "New residential construction. Published RGC first; commercial GC only as a disclosed secondary.",
    primaryCodes: ["RGC"],
    secondaryCodes: ["CGC2", "CGC1"],
    matchHeadline: "Residential general contractor licenses",
    officialLabel: "RGC",
    matchNote:
      "New homes are matched to published RGC. Commercial GC (CGC1 / CGC2) is added only when a view is thin and is not a residential-home endorsement by itself.",
    alsoNeeded: [],
  },
  {
    slug: "pool",
    label: "Pool",
    title: "Pool",
    description:
      "Pool work. CCB does not publish a pool type on this extract — RGC / RSC is the honest start.",
    primaryCodes: ["RGC"],
    secondaryCodes: ["RSC"],
    matchHeadline: "Residential general licenses — not a pool-specialty list",
    officialLabel: "RGC",
    matchNote:
      "This extract has no swimming-pool endorsement code, so the list starts with RGC.",
    extractCannotProve:
      "A row here is not proof the firm builds or services pools. RSC does not name the specialty.",
    alsoNeeded: [],
  },
  {
    slug: "hvac",
    label: "HVAC",
    title: "Heating & air conditioning",
    description:
      "HVAC work. No separate HVAC type on this CCB extract — RGC is primary; RSC is unnamed specialty.",
    primaryCodes: ["RGC"],
    secondaryCodes: ["RSC"],
    matchHeadline: "Residential general licenses — not an HVAC-specialty list",
    officialLabel: "RGC",
    matchNote:
      "This extract has no HVAC endorsement code, so the list starts with RGC.",
    extractCannotProve:
      "A row here is not proof the firm does heating or air conditioning. RSC does not name the specialty.",
    alsoNeeded: [],
  },
  {
    slug: "plumbing",
    label: "Plumbing",
    title: "Plumbing",
    description:
      "Plumbing work. No separate plumbing type on this CCB extract.",
    primaryCodes: ["RGC"],
    secondaryCodes: ["RSC"],
    matchHeadline: "Residential general licenses — not a plumbing-specialty list",
    officialLabel: "RGC",
    matchNote:
      "This extract has no plumbing endorsement code, so the list starts with RGC.",
    extractCannotProve:
      "A row here is not proof the firm is a plumber. Confirm the trade on the official CCB search and the written contract.",
    alsoNeeded: [],
  },
  {
    slug: "electrical",
    label: "Electrical",
    title: "Electrical",
    description:
      "Electrical work. No separate electrical type on this CCB extract.",
    primaryCodes: ["RGC"],
    secondaryCodes: ["RSC"],
    matchHeadline: "Residential general licenses — not an electrical-specialty list",
    officialLabel: "RGC",
    matchNote:
      "This extract has no electrical endorsement code, so the list starts with RGC.",
    extractCannotProve:
      "A row here is not proof the firm is an electrician. Confirm electrical licensing on the official CCB search.",
    alsoNeeded: [],
  },
  {
    slug: "outdoor",
    label: "Outdoor / exterior",
    title: "Outdoor and exterior work",
    description: "Exterior residential work. Matched to published RGC; RSC is unnamed specialty.",
    primaryCodes: ["RGC"],
    secondaryCodes: ["RSC", "RLC"],
    matchHeadline: "Residential general licenses — outdoor specialty is not named here",
    officialLabel: "RGC",
    matchNote:
      "Exterior work is matched to published RGC because this extract does not name an outdoor specialty type.",
    extractCannotProve:
      "RSC / RLC, if shown, do not identify fencing, hardscape, or another outdoor trade.",
    alsoNeeded: [],
  },
  {
    slug: "general",
    label: "General / not sure",
    title: "General contractor research",
    description: "Start with published Residential General Contractor (RGC) when the project type is unclear.",
    primaryCodes: ["RGC"],
    secondaryCodes: ["RLC"],
    matchHeadline: "Residential general contractor licenses",
    officialLabel: "RGC",
    matchNote:
      "When the project is still unclear, this list starts with published RGC. Use a more specific project or endorsement family once the scope is known.",
    alsoNeeded: [
      { slug: "residential-specialty", label: "Residential specialty", note: "If the work is specialty-only" },
      { slug: "commercial-general", label: "Commercial general", note: "If the job is commercial" },
    ],
  },
];

export function getOrProject(slug: string): OrProjectDef | null {
  return OREGON_PROJECTS.find((p) => p.slug === slug.toLowerCase()) ?? null;
}

export function orProjectCodes(project: OrProjectDef, includeSecondary: boolean): string[] {
  const codes = [...project.primaryCodes];
  if (includeSecondary) codes.push(...project.secondaryCodes);
  return [...new Set(codes.map((c) => c.toUpperCase()))];
}
