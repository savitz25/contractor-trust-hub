import type { TradeDef } from "@/lib/discovery/types";

/**
 * Consumer type / specialty families → published L&I type + specialty signals.
 *
 * occupation_code is the license type (CC / EC / PC / LC).
 * Construction specialties live on specialtycode1 / occupation_description.
 * Do not invent a specialty that is not published on the extract.
 */
export const WASHINGTON_TRADES: TradeDef[] = [
  {
    slug: "construction",
    label: "Construction contractor",
    title: "Construction contractors",
    description:
      "Published L&I construction contractor registration (CC). This type is broad — specialty on the extract is a published classification, not a ranking.",
    occupationCodes: ["CC"],
  },
  {
    slug: "electrical",
    label: "Electrical",
    title: "Electrical contractors",
    description:
      "Published L&I electrical contractor license (EC). Scope is electrical work — not automatically all construction contracting.",
    occupationCodes: ["EC"],
  },
  {
    slug: "plumbing",
    label: "Plumbing",
    title: "Plumbing contractors",
    description:
      "Published L&I plumbing contractor license (PC). Scope is plumbing work — not a general construction registration by itself.",
    occupationCodes: ["PC"],
  },
  {
    slug: "elevator",
    label: "Elevator",
    title: "Elevator contractors",
    description:
      "Published L&I elevator contractor license (LC) — not a general construction registration.",
    occupationCodes: ["LC"],
  },
  {
    slug: "general-construction",
    label: "General specialty",
    title: "Construction contractors · General specialty",
    description:
      "Published L&I construction specialty GENERAL (class 01). Still a construction contractor registration — not proof of every trade on a job.",
    occupationCodes: ["CC"],
    classCodes: ["01"],
    descriptionIncludes: ["Construction Contractor · General"],
  },
  {
    slug: "roofing",
    label: "Roofing",
    title: "Roofing contractors",
    description:
      "Published L&I construction specialty Roofing (class CD) as listed on the extract.",
    occupationCodes: ["CC"],
    classCodes: ["CD"],
    descriptionIncludes: ["Roofing"],
  },
  {
    slug: "hvac",
    label: "HVAC",
    title: "HVAC contractors",
    description:
      "Published L&I HVAC / refrigeration specialty on construction (class SM) or electrical (HVAC/R) rows.",
    occupationCodes: ["CC", "EC"],
    classCodes: ["SM", "6A"],
    descriptionIncludes: ["HVAC", "Hvac"],
  },
  {
    slug: "painting",
    label: "Painting",
    title: "Painting contractors",
    description:
      "Published L&I construction specialty Painting/Wallcovering (class CB).",
    occupationCodes: ["CC"],
    classCodes: ["CB"],
    descriptionIncludes: ["Painting/Wallcovering"],
  },
  {
    slug: "outdoor",
    label: "Outdoor / exterior",
    title: "Outdoor and exterior contractors",
    description:
      "Published L&I exterior specialties: landscaping, fencing, siding, gutters, concrete, masonry, and tree removal.",
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
  {
    slug: "pool",
    label: "Pool",
    title: "Swimming pool contractors",
    description:
      "Published L&I construction specialty Swimming Pools, Spas and Hot Tubs (class RB). Coverage on this extract is thin.",
    occupationCodes: ["CC"],
    classCodes: ["RB"],
    descriptionIncludes: ["Swimming Pools"],
  },
];
