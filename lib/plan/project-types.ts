import type { BudgetBand, ProjectTypeDef, ProjectTypeId } from "./types";

export const PROJECT_TYPES: ProjectTypeDef[] = [
  {
    id: "kitchen_remodel",
    label: "Kitchen Remodel",
    shortLabel: "Kitchen",
    description: "Cabinets, counters, layout, and finishes for a kitchen renovation.",
    occupationCodes: ["CGC", "CBC", "CRC"],
    scaleMode: "rooms",
    scaleLabels: {
      small: "Compact / refresh",
      medium: "Full remodel",
      large: "Large or premium",
    },
    scaleHints: {
      small: "Galley or light cosmetic update",
      medium: "Full gut of a standard kitchen",
      large: "Custom island, structural moves, premium finishes",
    },
  },
  {
    id: "bathroom_remodel",
    label: "Bathroom Remodel",
    shortLabel: "Bath",
    description: "Vanity, tile, shower, and plumbing fixture upgrades.",
    occupationCodes: ["CGC", "CBC", "CRC", "CFC"],
    scaleMode: "rooms",
    scaleLabels: {
      small: "Guest bath refresh",
      medium: "Full bath remodel",
      large: "Luxury primary bath",
    },
    scaleHints: {
      small: "Fixtures and finishes, limited layout change",
      medium: "Full gut of one bathroom",
      large: "Layout change, premium tile and glass",
    },
  },
  {
    id: "full_home_renovation",
    label: "Full Home Renovation",
    shortLabel: "Whole home",
    description: "Multi-room or whole-house renovation under a general contractor.",
    occupationCodes: ["CGC", "CBC", "CRC"],
    scaleMode: "scope",
    scaleLabels: {
      small: "Selective rooms",
      medium: "Whole-home moderate",
      large: "Extensive / near-rebuild",
    },
    scaleHints: {
      small: "A few key areas only",
      medium: "Kitchen, baths, and finishes throughout",
      large: "Structural and high-end finishes",
    },
  },
  {
    id: "addition",
    label: "Addition / Extension",
    shortLabel: "Addition",
    description: "Room addition, second story, or expansion of living space.",
    occupationCodes: ["CGC", "CBC", "CRC"],
    scaleMode: "sqft",
    scaleLabels: {
      small: "~200–400 sq ft",
      medium: "~400–800 sq ft",
      large: "Large or second story",
    },
    scaleHints: {
      small: "Simple room addition",
      medium: "Multi-room addition",
      large: "Major wing or second story",
    },
  },
  {
    id: "basement_finish",
    label: "Basement / Lower-Level Finish",
    shortLabel: "Lower level",
    description: "Finish lower level or walkout living space (less common in FL).",
    occupationCodes: ["CGC", "CBC", "CRC"],
    scaleMode: "sqft",
    scaleLabels: {
      small: "Partial finish",
      medium: "Full lower level",
      large: "Premium entertainment level",
    },
    scaleHints: {
      small: "One zone or partial area",
      medium: "Full finish with basic wet area",
      large: "Theater / suite quality",
    },
  },
  {
    id: "roofing",
    label: "Roofing",
    shortLabel: "Roof",
    description: "Reroof, repair, or new roof system — Florida wind considerations apply.",
    occupationCodes: ["CCC", "RR", "CGC"],
    scaleMode: "scope",
    scaleLabels: {
      small: "Small / partial",
      medium: "Typical home reroof",
      large: "Large or premium system",
    },
    scaleHints: {
      small: "Partial slope or small home",
      medium: "Full single-family reroof",
      large: "Complex geometry or tile/metal",
    },
  },
  {
    id: "siding_exterior",
    label: "Siding / Exterior",
    shortLabel: "Exterior",
    description: "Siding, stucco, cladding, and exterior envelope work.",
    occupationCodes: ["CGC", "CBC", "CRC", "SCC"],
    scaleMode: "scope",
    scaleLabels: {
      small: "Partial elevation",
      medium: "Full re-clad",
      large: "Premium whole-house",
    },
    scaleHints: {
      small: "One elevation or repairs",
      medium: "Full exterior update",
      large: "Premium materials, multi-story",
    },
  },
  {
    id: "deck_outdoor",
    label: "Deck / Outdoor Living",
    shortLabel: "Outdoor",
    description: "Decks, covered patios, outdoor kitchens, and outdoor structures.",
    occupationCodes: ["CGC", "CBC", "CRC", "SCC"],
    scaleMode: "scope",
    scaleLabels: {
      small: "Small deck / patio",
      medium: "Covered outdoor living",
      large: "Full outdoor pavilion",
    },
    scaleHints: {
      small: "Simple deck or cover",
      medium: "Larger covered area",
      large: "Kitchen + structure package",
    },
  },
  {
    id: "custom_home_rebuild",
    label: "New Custom Home / Knockdown Rebuild",
    shortLabel: "Custom / rebuild",
    description: "New construction or knockdown rebuild on an existing lot.",
    occupationCodes: ["CGC", "CBC", "CRC"],
    scaleMode: "sqft",
    scaleLabels: {
      small: "Compact custom",
      medium: "Mid-size custom",
      large: "Estate / large custom",
    },
    scaleHints: {
      small: "Smaller footprint custom home",
      medium: "Typical 3,000–4,500 sq ft",
      large: "Estate-scale build",
    },
  },
  {
    id: "general_contracting",
    label: "Other / General Contracting",
    shortLabel: "General",
    description: "General contracting or multi-trade work that doesn’t fit a single specialty.",
    occupationCodes: ["CGC", "CBC", "CRC"],
    scaleMode: "scope",
    scaleLabels: {
      small: "Small job",
      medium: "Mid-size project",
      large: "Large multi-phase",
    },
    scaleHints: {
      small: "Limited scope GC work",
      medium: "Multi-trade coordination",
      large: "Complex multi-phase",
    },
  },
];

export const BUDGET_BANDS: { id: BudgetBand; label: string }[] = [
  { id: "under_25k", label: "Under $25k" },
  { id: "25_75k", label: "$25–75k" },
  { id: "75_150k", label: "$75–150k" },
  { id: "150k_plus", label: "$150k+" },
  { id: "not_sure", label: "Not sure" },
];

export function getProjectType(id: ProjectTypeId): ProjectTypeDef {
  const found = PROJECT_TYPES.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown project type: ${id}`);
  return found;
}

export function isProjectTypeId(v: string): v is ProjectTypeId {
  return PROJECT_TYPES.some((p) => p.id === v);
}
