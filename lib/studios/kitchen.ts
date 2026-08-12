import type { ScaleBand } from "@/lib/plan/types";
import type { StudioAnswers, StudioDefinition } from "./types";

function resolveScale(answers: StudioAnswers): ScaleBand {
  const scale = answers.values.project_scale;
  const size = answers.values.kitchen_size;
  if (scale === "full_gut" || size === "large") return "large";
  if (scale === "refresh" && size === "small") return "small";
  if (scale === "refresh") return "small";
  if (scale === "mid") return "medium";
  if (size === "small") return "small";
  if (size === "large") return "large";
  return "medium";
}

export const kitchenStudio: StudioDefinition = {
  slug: "kitchen",
  projectType: "kitchen_remodel",
  name: "Kitchen Remodel Studio",
  shortName: "Kitchen",
  headline: "Clarify kitchen scope before you hire",
  positioning:
    "Surface refresh, mid-range remodel, or full gut — understand cost drivers and match licensed contractors to your Florida project.",
  primaryOccupationCodes: ["CGC", "CBC", "CRC"],
  secondaryOccupationCodes: ["CFC"],
  steps: [
    {
      id: "scope",
      title: "What kind of kitchen project is this?",
      body: "Be honest about whether this is cosmetic or a full gut — it changes the range more than almost anything else.",
      fields: [
        {
          id: "project_scale",
          type: "single",
          label: "Project scale",
          required: true,
          options: [
            {
              id: "refresh",
              label: "Refresh",
              hint: "Paint, hardware, counters, limited updates",
            },
            {
              id: "mid",
              label: "Mid-range remodel",
              hint: "Cabinets and finishes, layout mostly stays",
            },
            {
              id: "full_gut",
              label: "Full gut-rehab",
              hint: "Strip to studs, possible layout moves",
            },
          ],
        },
        {
          id: "kitchen_size",
          type: "single",
          label: "Approximate kitchen size",
          required: true,
          options: [
            { id: "small", label: "Small", hint: "Galley or compact" },
            { id: "average", label: "Average", hint: "Typical family kitchen" },
            { id: "large", label: "Large", hint: "Open plan or large island" },
          ],
        },
      ],
    },
    {
      id: "work",
      title: "What work is included?",
      body: "Select all that apply. Layout or plumbing moves usually raise cost and complexity.",
      fields: [
        {
          id: "work_included",
          type: "multi",
          label: "Work included",
          options: [
            { id: "cabinets", label: "Cabinets" },
            { id: "countertops", label: "Countertops" },
            { id: "appliances", label: "Appliances" },
            { id: "layout", label: "Layout changes" },
            { id: "electrical", label: "Electrical / lighting updates" },
            { id: "flooring", label: "Flooring" },
          ],
        },
      ],
    },
  ],
  baseCostDrivers: [
    "Cabinet quality and quantity",
    "Countertop material tier",
    "Layout changes / plumbing-electrical moves",
    "Structural or permit complexity",
    "Finish level",
  ],
  resultFraming:
    "These ranges reflect Florida kitchen remodel planning bands adjusted for the scope you described — not a contractor bid.",
  driverByAnswer: {
    refresh: "Refresh-level scope — finishes over structural change",
    mid: "Mid-range remodel — new cabinets/finishes with limited layout moves",
    full_gut: "Full gut — higher labor, possible mechanical and permit complexity",
    cabinets: "Cabinet package is often the largest material line item",
    countertops: "Countertop material tier swings cost significantly",
    appliances: "Appliance package tier and installation requirements",
    layout: "Layout changes usually mean plumbing/electrical relocation",
    electrical: "Electrical and lighting updates add labor and inspection steps",
    flooring: "Flooring replacement or transitions across adjacent rooms",
    large: "Larger kitchen footprint increases cabinet and counter linear feet",
    small: "Compact kitchen can limit some costs but may constrain layout options",
  },
  resolveScale,
  resolveUnitNote: (a) => {
    const scale = a.values.project_scale;
    const size = a.values.kitchen_size;
    const parts = [
      scale === "full_gut"
        ? "Full gut"
        : scale === "refresh"
          ? "Refresh"
          : "Mid-range remodel",
      size === "large" ? "large kitchen" : size === "small" ? "small kitchen" : "average kitchen",
    ];
    return parts.join(" · ");
  },
};
