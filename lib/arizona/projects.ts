/**
 * Arizona consumer project → ROC class map.
 * Primary classes first. Secondary only when noted. Also-needed are related
 * trades often required on the same job — not a ranking and not a permit list.
 */

export type AzRelatedTrade = {
  slug: string;
  label: string;
  note: string;
};

export type AzProjectDef = {
  slug: string;
  label: string;
  title: string;
  description: string;
  /** Primary ROC class codes (occupation_code) */
  primaryCodes: string[];
  /** Used only when a geo has few primary matches */
  secondaryCodes: string[];
  /** Plain-language first line on result pages */
  matchHeadline: string;
  /** Official class codes shown second */
  officialLabel: string;
  matchNote: string;
  alsoNeeded: AzRelatedTrade[];
};

export const ARIZONA_PROJECTS: AzProjectDef[] = [
  {
    slug: "kitchen-remodel",
    label: "Kitchen remodel",
    title: "Kitchen remodel",
    description:
      "Residential kitchen remodeling. General / dual-general classes are the usual contracting credential; electrical, plumbing, and sometimes HVAC are separate published specialties.",
    primaryCodes: ["B", "KB-2", "KB-1", "B-3", "R-62", "CR-61"],
    secondaryCodes: ["CR-60", "CR-8"],
    matchHeadline: "General residential and dual-general licenses",
    officialLabel: "B, KB-1, KB-2, B-3, R-62, CR-61",
    matchNote:
      "Kitchen remodels are usually contracted under a published general or dual-general class. Electrical, plumbing, and HVAC on the same job are separate specialties when that work is contracted.",
    alsoNeeded: [
      { slug: "electrical", label: "Electrical", note: "New circuits, lighting, appliances" },
      { slug: "plumbing", label: "Plumbing", note: "Sink, dishwasher, gas, supply lines" },
      { slug: "hvac", label: "HVAC", note: "Only if the scope moves or replaces equipment" },
    ],
  },
  {
    slug: "bathroom-remodel",
    label: "Bathroom remodel",
    title: "Bathroom remodel",
    description:
      "Residential bath remodeling. General / dual-general plus published plumbing (and often electrical) classes.",
    primaryCodes: ["B", "KB-2", "KB-1", "B-3", "R-62", "CR-61"],
    secondaryCodes: ["CR-37", "R-37R", "CR-48"],
    matchHeadline: "General residential and dual-general licenses",
    officialLabel: "B, KB-1, KB-2, B-3, R-62, CR-61",
    matchNote:
      "Bathroom remodels are usually contracted under a published general or dual-general class. Wet-area plumbing and electrical are separate ROC specialties when that work is contracted.",
    alsoNeeded: [
      { slug: "plumbing", label: "Plumbing", note: "Fixtures, drain/waste/vent, water supply" },
      { slug: "electrical", label: "Electrical", note: "Fans, lighting, GFCI" },
      { slug: "hvac", label: "HVAC", note: "Only if exhaust or equipment is in scope" },
    ],
  },
  {
    slug: "roofing",
    label: "Roofing",
    title: "Roofing",
    description: "Roof installation or repair. Primary published class is CR-42 Roofing.",
    primaryCodes: ["CR-42"],
    secondaryCodes: [],
    matchHeadline: "Roofing specialty licenses",
    officialLabel: "CR-42",
    matchNote:
      "This list is the published ROC roofing class only. A general contractor class is not treated as a roofing specialty here.",
    alsoNeeded: [
      { slug: "electrical", label: "Electrical", note: "If the job includes powered vents or solar tie-in" },
    ],
  },
  {
    slug: "addition",
    label: "Addition / extension",
    title: "Addition or extension",
    description:
      "Room additions and structural extensions. Dual-general and general residential/commercial classes as published.",
    primaryCodes: ["KB-1", "KB-2", "B", "B-1", "B-3"],
    secondaryCodes: ["A", "KA"],
    matchHeadline: "General and dual-general licenses",
    officialLabel: "KB-1, KB-2, B, B-1, B-3",
    matchNote:
      "Additions are matched to published general and dual-general classes. Electrical, plumbing, HVAC, and roofing on the same job are often separate contracts.",
    alsoNeeded: [
      { slug: "electrical", label: "Electrical", note: "New service or branch circuits" },
      { slug: "plumbing", label: "Plumbing", note: "If the addition includes wet rooms" },
      { slug: "hvac", label: "HVAC", note: "If the addition needs conditioned air" },
      { slug: "roofing", label: "Roofing", note: "If roof work is separately contracted" },
    ],
  },
  {
    slug: "whole-home",
    label: "Whole-home renovation",
    title: "Whole-home renovation",
    description:
      "Broad residential renovation. Dual-general and general residential classes as published — not a guarantee every specialty is included.",
    primaryCodes: ["KB-1", "KB-2", "B", "B-3"],
    secondaryCodes: ["R-62", "CR-61"],
    matchHeadline: "Dual-general and general residential licenses",
    officialLabel: "KB-1, KB-2, B, B-3",
    matchNote:
      "Whole-home renovation is matched to published dual-general and general residential classes. Electrical, plumbing, HVAC, and roofing are often separately licensed.",
    alsoNeeded: [
      { slug: "electrical", label: "Electrical", note: "Panel, rewire, devices" },
      { slug: "plumbing", label: "Plumbing", note: "Repipe or fixture replacement" },
      { slug: "hvac", label: "HVAC", note: "System replacement or relocation" },
      { slug: "roofing", label: "Roofing", note: "If the roof is in the renovation" },
    ],
  },
  {
    slug: "new-build",
    label: "New build / custom home",
    title: "New build or custom home",
    description:
      "New residential construction. Dual-general and general residential classes as published.",
    primaryCodes: ["KB-1", "KB-2", "B"],
    secondaryCodes: ["B-1", "KA"],
    matchHeadline: "Dual-general and general residential licenses",
    officialLabel: "KB-1, KB-2, B",
    matchNote:
      "New homes are matched to published dual-general and general residential classes. Many trades on a new build are separately licensed.",
    alsoNeeded: [
      { slug: "electrical", label: "Electrical", note: "Service and rough-in" },
      { slug: "plumbing", label: "Plumbing", note: "Rough-in and trim" },
      { slug: "hvac", label: "HVAC", note: "System design and install" },
      { slug: "roofing", label: "Roofing", note: "If not under the general contract" },
    ],
  },
  {
    slug: "pool",
    label: "Pool",
    title: "Swimming pool",
    description:
      "Pool construction or service. Published classes KA-5 (dual swimming pool) and CR-6 (service and repair).",
    primaryCodes: ["KA-5", "CR-6"],
    secondaryCodes: [],
    matchHeadline: "Swimming-pool specialty licenses",
    officialLabel: "KA-5, CR-6",
    matchNote:
      "This list is published ROC swimming-pool classes only. Electrical and sometimes plumbing for pool equipment are separate specialties.",
    alsoNeeded: [
      { slug: "electrical", label: "Electrical", note: "Pumps, bonding, lighting" },
      { slug: "plumbing", label: "Plumbing", note: "If water/gas connections are separate" },
    ],
  },
  {
    slug: "hvac",
    label: "HVAC",
    title: "Heating & air conditioning",
    description: "HVAC install or replacement. Published air-conditioning / refrigeration classes.",
    primaryCodes: ["CR-39", "C-39", "R-39R"],
    secondaryCodes: [],
    matchHeadline: "Air-conditioning and refrigeration licenses",
    officialLabel: "CR-39, C-39, R-39R",
    matchNote:
      "This list is published ROC HVAC / refrigeration classes. A general contractor class is not treated as an HVAC specialty here.",
    alsoNeeded: [
      { slug: "electrical", label: "Electrical", note: "Disconnects, new circuits, or panel work" },
    ],
  },
  {
    slug: "plumbing",
    label: "Plumbing",
    title: "Plumbing",
    description: "Plumbing install or repair. Published plumbing classes CR-37, C-37, R-37R.",
    primaryCodes: ["CR-37", "C-37", "R-37R"],
    secondaryCodes: [],
    matchHeadline: "Plumbing specialty licenses",
    officialLabel: "CR-37, C-37, R-37R",
    matchNote:
      "This list is published ROC plumbing classes. A general contractor class is not substituted for plumbing specialty work.",
    alsoNeeded: [],
  },
  {
    slug: "electrical",
    label: "Electrical",
    title: "Electrical",
    description: "Electrical install or repair. Published electrical classes CR-11, C-11, R-11.",
    primaryCodes: ["CR-11", "C-11", "R-11"],
    secondaryCodes: ["CR-67"],
    matchHeadline: "Electrical specialty licenses",
    officialLabel: "CR-11, C-11, R-11",
    matchNote:
      "This list is published ROC electrical classes. Low-voltage CR-67 is added only when primary coverage in a view is thin.",
    alsoNeeded: [],
  },
  {
    slug: "outdoor",
    label: "Outdoor / exterior",
    title: "Outdoor and exterior work",
    description:
      "Hardscape, fence, masonry, and painting specialties as published — plus dual-general when the job is a broader exterior remodel.",
    primaryCodes: ["CR-21", "CR-14", "CR-31", "CR-34"],
    secondaryCodes: ["KB-2", "B", "B-3"],
    matchHeadline: "Exterior specialty licenses",
    officialLabel: "CR-21, CR-14, CR-31, CR-34",
    matchNote:
      "Primary matches are published hardscape, fence, masonry, and painting classes. General / dual-general classes are added only when this view is thin — they are not a substitute for a specialty.",
    alsoNeeded: [
      { slug: "electrical", label: "Electrical", note: "Outdoor lighting or equipment" },
    ],
  },
  {
    slug: "general",
    label: "Not sure / general",
    title: "General contractor research",
    description:
      "Start with published dual-general and general residential/commercial classes when the project type is still unclear.",
    primaryCodes: ["KB-1", "KB-2", "B", "B-1", "B-3"],
    secondaryCodes: ["R-62"],
    matchHeadline: "General and dual-general licenses",
    officialLabel: "KB-1, KB-2, B, B-1, B-3",
    matchNote:
      "When the project type is still unclear, this list starts with published general and dual-general classes. Use a more specific project or trade page once the scope is known.",
    alsoNeeded: [
      { slug: "electrical", label: "Electrical", note: "If the job includes electrical work" },
      { slug: "plumbing", label: "Plumbing", note: "If the job includes plumbing" },
      { slug: "hvac", label: "HVAC", note: "If the job includes HVAC" },
    ],
  },
];

export function getAzProject(slug: string): AzProjectDef | null {
  return ARIZONA_PROJECTS.find((p) => p.slug === slug.toLowerCase()) ?? null;
}

export function azProjectCodes(project: AzProjectDef, includeSecondary: boolean): string[] {
  const codes = [...project.primaryCodes];
  if (includeSecondary) codes.push(...project.secondaryCodes);
  return [...new Set(codes.map((c) => c.toUpperCase()))];
}
