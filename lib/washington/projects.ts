import type { TradeDef } from "@/lib/discovery/types";

/**
 * Washington consumer project → L&I type / specialty map.
 * Primary matches first. Secondary only when a view is thin.
 * Also-needed are related published types — not a ranking or permit list.
 */

export type WaRelatedTrade = {
  slug: string;
  label: string;
  note: string;
};

export type WaMatchFilter = {
  occupationCodes: string[];
  classCodes?: string[];
  descriptionIncludes?: string[];
};

export type WaProjectDef = {
  slug: string;
  label: string;
  title: string;
  description: string;
  primary: WaMatchFilter;
  secondary: WaMatchFilter;
  matchHeadline: string;
  officialLabel: string;
  matchNote: string;
  extractCannotProve?: string;
  alsoNeeded: WaRelatedTrade[];
};

const CC_GENERAL: WaMatchFilter = {
  occupationCodes: ["CC"],
  classCodes: ["01"],
  descriptionIncludes: ["Construction Contractor · General"],
};

export const WASHINGTON_PROJECTS: WaProjectDef[] = [
  {
    slug: "kitchen-remodel",
    label: "Kitchen remodel",
    title: "Kitchen remodel",
    description:
      "Residential kitchen remodeling. Construction contractor registration with the published General specialty is the usual start; electrical and plumbing are separate L&I types.",
    primary: CC_GENERAL,
    secondary: {
      occupationCodes: ["CC"],
      classCodes: ["SB"],
      descriptionIncludes: ["Cabinets, Millwork"],
    },
    matchHeadline: "Construction contractors with the published General specialty",
    officialLabel: "CC · GENERAL (01)",
    matchNote:
      "Kitchen remodels are matched to published construction contractor rows whose specialty is General. Electrical and plumbing on the same job are separate L&I license types when that work is contracted.",
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
      "Residential bath remodeling. Construction contractor General specialty plus separately licensed plumbing and often electrical.",
    primary: CC_GENERAL,
    secondary: {
      occupationCodes: ["CC"],
      classCodes: ["RE"],
      descriptionIncludes: ["Tile, Ceramic"],
    },
    matchHeadline: "Construction contractors with the published General specialty",
    officialLabel: "CC · GENERAL (01)",
    matchNote:
      "Bathroom remodels are matched to published General construction-contractor rows. Wet-area plumbing and electrical are separate L&I types when that work is contracted.",
    alsoNeeded: [
      { slug: "plumbing", label: "Plumbing", note: "Fixtures, drain/waste/vent, water supply" },
      { slug: "electrical", label: "Electrical", note: "Fans, lighting, GFCI" },
    ],
  },
  {
    slug: "roofing",
    label: "Roofing",
    title: "Roofing",
    description: "Roof installation or repair. Primary published specialty is Roofing (CD).",
    primary: {
      occupationCodes: ["CC"],
      classCodes: ["CD"],
      descriptionIncludes: ["Roofing"],
    },
    secondary: {
      occupationCodes: ["CC"],
      classCodes: ["CV"],
      descriptionIncludes: ["Gutters"],
    },
    matchHeadline: "Construction contractors with the published Roofing specialty",
    officialLabel: "CC · Roofing (CD)",
    matchNote:
      "This list is the published L&I Roofing specialty only. A General construction registration is not treated as a roofing specialty here.",
    extractCannotProve:
      "A General (01) construction contractor row is not proof the firm does roofing.",
    alsoNeeded: [
      { slug: "electrical", label: "Electrical", note: "If the job includes powered vents or solar tie-in" },
    ],
  },
  {
    slug: "addition",
    label: "Addition / extension",
    title: "Addition or extension",
    description:
      "Room additions and structural extensions. Matched to published General construction contractor registration.",
    primary: CC_GENERAL,
    secondary: {
      occupationCodes: ["CC"],
      classCodes: ["SL"],
      descriptionIncludes: ["Framing and Rough Carpentry"],
    },
    matchHeadline: "Construction contractors with the published General specialty",
    officialLabel: "CC · GENERAL (01)",
    matchNote:
      "Additions are matched to published General construction-contractor rows. Electrical, plumbing, HVAC, and roofing on the same job are often separate credentials.",
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
      "Broad residential renovation. Matched to published General construction contractor registration — not a guarantee every specialty is included.",
    primary: CC_GENERAL,
    secondary: {
      occupationCodes: ["CC"],
      classCodes: ["SL"],
      descriptionIncludes: ["Framing and Rough Carpentry"],
    },
    matchHeadline: "Construction contractors with the published General specialty",
    officialLabel: "CC · GENERAL (01)",
    matchNote:
      "Whole-home renovation is matched to published General construction-contractor rows. Electrical, plumbing, HVAC, and roofing are often separately licensed.",
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
      "New residential construction. Matched to published General construction contractor registration.",
    primary: CC_GENERAL,
    secondary: {
      occupationCodes: ["CC"],
      classCodes: ["SL"],
      descriptionIncludes: ["Framing and Rough Carpentry"],
    },
    matchHeadline: "Construction contractors with the published General specialty",
    officialLabel: "CC · GENERAL (01)",
    matchNote:
      "New homes are matched to published General construction-contractor rows. Many trades on a new build are separately licensed.",
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
      "Pool construction or service. Published specialty is Swimming Pools, Spas and Hot Tubs (RB). Coverage on this extract is thin.",
    primary: {
      occupationCodes: ["CC"],
      classCodes: ["RB"],
      descriptionIncludes: ["Swimming Pools"],
    },
    secondary: { occupationCodes: [], classCodes: [], descriptionIncludes: [] },
    matchHeadline: "Construction contractors with the published pool specialty",
    officialLabel: "CC · Swimming Pools, Spas and Hot Tubs (RB)",
    matchNote:
      "This list is the published L&I swimming-pool specialty only. A General construction registration is not substituted here.",
    extractCannotProve:
      "Pool specialty coverage on this extract is thin. Absence from this list is not proof a firm cannot do pool work under another published credential — confirm on the official L&I verify site and the written contract.",
    alsoNeeded: [
      { slug: "electrical", label: "Electrical", note: "Pumps, bonding, lighting" },
      { slug: "plumbing", label: "Plumbing", note: "If water/gas connections are separate" },
    ],
  },
  {
    slug: "hvac",
    label: "HVAC",
    title: "Heating & air conditioning",
    description:
      "HVAC install or replacement. Published construction HVAC/R specialty and electrical HVAC/R rows.",
    primary: {
      occupationCodes: ["CC", "EC"],
      classCodes: ["SM", "6A"],
      descriptionIncludes: ["HVAC", "Hvac"],
    },
    secondary: { occupationCodes: [], classCodes: [], descriptionIncludes: [] },
    matchHeadline: "Published HVAC / refrigeration specialties",
    officialLabel: "CC · HVAC/R (SM) · EC · HVAC/R (6A)",
    matchNote:
      "This list is published L&I HVAC / refrigeration specialties. A General construction registration is not treated as an HVAC specialty here.",
    extractCannotProve:
      "A General (01) construction contractor row is not proof the firm does heating or air conditioning.",
    alsoNeeded: [
      { slug: "electrical", label: "Electrical", note: "Disconnects, new circuits, or panel work" },
    ],
  },
  {
    slug: "plumbing",
    label: "Plumbing",
    title: "Plumbing",
    description: "Plumbing install or repair. Published L&I plumbing contractor licenses (PC).",
    primary: { occupationCodes: ["PC"] },
    secondary: { occupationCodes: [], classCodes: [], descriptionIncludes: [] },
    matchHeadline: "Plumbing contractor licenses",
    officialLabel: "PC",
    matchNote:
      "This list is published L&I plumbing contractor licenses (PC). A construction contractor registration is not substituted for plumbing specialty work.",
    extractCannotProve:
      "A CC construction registration is not proof the firm is a plumber.",
    alsoNeeded: [],
  },
  {
    slug: "electrical",
    label: "Electrical",
    title: "Electrical",
    description: "Electrical install or repair. Published L&I electrical contractor licenses (EC).",
    primary: { occupationCodes: ["EC"] },
    secondary: { occupationCodes: [], classCodes: [], descriptionIncludes: [] },
    matchHeadline: "Electrical contractor licenses",
    officialLabel: "EC",
    matchNote:
      "This list is published L&I electrical contractor licenses (EC). A construction contractor registration is not substituted for electrical specialty work.",
    extractCannotProve:
      "A CC construction registration is not proof the firm is an electrician.",
    alsoNeeded: [],
  },
  {
    slug: "outdoor",
    label: "Outdoor / exterior",
    title: "Outdoor and exterior work",
    description:
      "Landscaping, fencing, siding, gutters, concrete, masonry, and tree-removal specialties as published.",
    primary: {
      occupationCodes: ["CC"],
      classCodes: ["BW", "BN", "SW", "CV", "BI", "BZ", "RF"],
      descriptionIncludes: [
        "Landscaping",
        "Fencing",
        "Siding",
        "Gutters",
        "Concrete",
        "Masonry",
        "Tree Removal",
      ],
    },
    secondary: CC_GENERAL,
    matchHeadline: "Published exterior construction specialties",
    officialLabel: "CC · Landscaping, Fencing, Siding, Gutters, Concrete, Masonry, Tree Removal",
    matchNote:
      "Primary matches are published exterior specialties. General construction-contractor rows are added only when this view is thin — they are not a substitute for a named specialty.",
    alsoNeeded: [
      { slug: "electrical", label: "Electrical", note: "Outdoor lighting or equipment" },
    ],
  },
  {
    slug: "general",
    label: "Not sure / general",
    title: "General contractor research",
    description:
      "Start with published construction contractor rows whose specialty is General when the project type is still unclear.",
    primary: CC_GENERAL,
    secondary: { occupationCodes: ["CC"] },
    matchHeadline: "Construction contractors with the published General specialty",
    officialLabel: "CC · GENERAL (01)",
    matchNote:
      "When the project type is still unclear, this list starts with published General construction-contractor rows. Use a more specific project or type page once the scope is known.",
    alsoNeeded: [
      { slug: "electrical", label: "Electrical", note: "If the job includes electrical work" },
      { slug: "plumbing", label: "Plumbing", note: "If the job includes plumbing" },
      { slug: "hvac", label: "HVAC", note: "If the job includes HVAC" },
    ],
  },
];

export function getWaProject(slug: string): WaProjectDef | null {
  return WASHINGTON_PROJECTS.find((p) => p.slug === slug.toLowerCase()) ?? null;
}

function uniq(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

export function waProjectAsTrade(project: WaProjectDef, includeSecondary: boolean): TradeDef {
  const filters = [project.primary];
  if (includeSecondary) filters.push(project.secondary);
  return {
    slug: project.slug,
    label: project.label,
    title: project.title,
    description: project.description,
    occupationCodes: uniq(filters.flatMap((f) => f.occupationCodes)),
    classCodes: uniq(filters.flatMap((f) => f.classCodes || [])),
    descriptionIncludes: uniq(filters.flatMap((f) => f.descriptionIncludes || [])),
  };
}
