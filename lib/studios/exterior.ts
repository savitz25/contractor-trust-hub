import type { ProjectTypeId, ScaleBand } from "@/lib/plan/types";
import type { StudioAnswers, StudioDefinition } from "./types";

function resolveScale(answers: StudioAnswers): ScaleBand {
  const scale = answers.values.ext_scale;
  if (scale === "large") return "large";
  if (scale === "small") return "small";
  return "medium";
}

function resolveProjectType(answers: StudioAnswers): ProjectTypeId {
  const t = answers.values.ext_project;
  if (t === "siding") return "siding_exterior";
  if (t === "deck" || t === "patio" || t === "combined") return "deck_outdoor";
  return "deck_outdoor";
}

export const exteriorStudio: StudioDefinition = {
  slug: "exterior",
  projectType: "deck_outdoor",
  relatedProjectTypes: ["siding_exterior", "deck_outdoor"],
  name: "Exterior & Deck Studio",
  shortName: "Exterior & Deck",
  headline: "Scope outdoor and exterior work with clear cost drivers",
  positioning:
    "Deck, patio, siding refresh, or a combined outdoor package — structure, materials, and access drive cost more than wish lists.",
  primaryOccupationCodes: ["CBC", "CRC", "CGC"],
  secondaryOccupationCodes: ["SCC"],
  steps: [
    {
      id: "scope",
      title: "What exterior or outdoor project is this?",
      fields: [
        {
          id: "ext_project",
          type: "single",
          label: "Project type",
          required: true,
          options: [
            { id: "deck", label: "Deck only" },
            { id: "patio", label: "Patio / outdoor living" },
            { id: "siding", label: "Siding / exterior refresh" },
            {
              id: "combined",
              label: "Combined outdoor package",
              hint: "Deck + cover, outdoor kitchen, or multi-element",
            },
          ],
        },
        {
          id: "ext_scale",
          type: "single",
          label: "Scale",
          required: true,
          options: [
            { id: "small", label: "Small" },
            { id: "medium", label: "Medium" },
            { id: "large", label: "Large" },
          ],
        },
      ],
    },
    {
      id: "work",
      title: "What work is included?",
      body: "Covered structures and outdoor kitchens raise both cost and permit complexity.",
      fields: [
        {
          id: "work_included",
          type: "multi",
          label: "Work included",
          options: [
            { id: "deck_structure", label: "Deck structure" },
            { id: "railings", label: "Railings / stairs" },
            { id: "covered", label: "Covered area / roof structure" },
            { id: "outdoor_kitchen", label: "Outdoor kitchen" },
            { id: "siding_work", label: "Siding replacement" },
            { id: "lighting", label: "Lighting / electrical" },
          ],
        },
      ],
    },
  ],
  baseCostDrivers: [
    "Structure size and complexity",
    "Material tier (decking, railings, siding)",
    "Coverage / roof elements",
    "Site access and grading",
    "Electrical or outdoor kitchen add-ons",
    "Permit requirements",
  ],
  resultFraming:
    "Exterior and outdoor ranges use Florida planning bands for the package you described — conceptual only.",
  driverByAnswer: {
    deck: "Deck-focused scope — structure and railing systems dominate",
    patio: "Patio / outdoor living — hardscape and cover options vary widely",
    siding: "Siding refresh — envelope materials and moisture barrier matter",
    combined: "Combined package — multi-trade coordination increases cost",
    small: "Smaller scale limits material volume",
    medium: "Mid-size outdoor or exterior package",
    large: "Large scale increases structure, material, and labor",
    deck_structure: "Deck structure sizing and fastening systems",
    railings: "Railings and stairs are labor-intensive details",
    covered: "Covered / roof structure adds engineering and waterproofing",
    outdoor_kitchen: "Outdoor kitchen packages drive plumbing, gas, and finishes",
    siding_work: "Siding replacement includes substrate and flashing details",
    lighting: "Outdoor lighting and electrical runs",
  },
  resolveScale,
  resolveProjectType,
  resolveUnitNote: (a) => {
    const t = a.values.ext_project;
    const typeLabel =
      t === "siding"
        ? "Siding / exterior"
        : t === "patio"
          ? "Patio / outdoor living"
          : t === "combined"
            ? "Combined outdoor package"
            : "Deck";
    return `${typeLabel} · ${a.values.ext_scale || "medium"} scale`;
  },
};
