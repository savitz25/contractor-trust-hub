import type { ScaleBand } from "@/lib/plan/types";
import type { StudioAnswers, StudioDefinition } from "./types";

function resolveScale(answers: StudioAnswers): ScaleBand {
  const scale = answers.values.bath_scale;
  const type = answers.values.bath_type;
  if (scale === "full_gut" || type === "primary") {
    if (scale === "full_gut" && type === "primary") return "large";
    if (scale === "full_gut") return "large";
    if (type === "primary" && scale === "standard") return "medium";
  }
  if (scale === "cosmetic" || type === "powder") return "small";
  if (scale === "standard") return "medium";
  return "medium";
}

export const bathroomStudio: StudioDefinition = {
  slug: "bathroom",
  projectType: "bathroom_remodel",
  name: "Bathroom Remodel Studio",
  shortName: "Bathroom",
  headline: "Define bathroom complexity before you hire",
  positioning:
    "Powder room refresh or primary suite gut — waterproofing, tile, and plumbing moves drive cost more than square footage alone.",
  primaryOccupationCodes: ["CFC", "CRC", "CBC"],
  secondaryOccupationCodes: ["CGC"],
  steps: [
    {
      id: "scope",
      title: "Which bathroom, and how deep is the remodel?",
      fields: [
        {
          id: "bath_type",
          type: "single",
          label: "Bath type",
          required: true,
          options: [
            { id: "powder", label: "Powder", hint: "Half bath, no tub/shower" },
            { id: "guest", label: "Guest", hint: "Full bath, lighter use" },
            { id: "primary", label: "Primary", hint: "Main suite bathroom" },
          ],
        },
        {
          id: "bath_scale",
          type: "single",
          label: "Scale",
          required: true,
          options: [
            {
              id: "cosmetic",
              label: "Cosmetic refresh",
              hint: "Fixtures, paint, limited tile",
            },
            {
              id: "standard",
              label: "Standard remodel",
              hint: "Full update, layout mostly stays",
            },
            {
              id: "full_gut",
              label: "Full gut",
              hint: "Strip, re-plumb options, new waterproofing",
            },
          ],
        },
      ],
    },
    {
      id: "work",
      title: "What work is included?",
      body: "Plumbing relocation and full tile/waterproofing are the biggest cost escalators.",
      fields: [
        {
          id: "work_included",
          type: "multi",
          label: "Work included",
          options: [
            { id: "vanity", label: "Vanity / storage" },
            { id: "shower_tub", label: "Shower or tub replacement" },
            { id: "tile", label: "Tile work" },
            { id: "plumbing_move", label: "Plumbing relocation" },
            { id: "vent_electrical", label: "Ventilation / electrical" },
          ],
        },
      ],
    },
  ],
  baseCostDrivers: [
    "Shower/tub complexity",
    "Tile extent and waterproofing",
    "Plumbing relocation",
    "Ventilation requirements",
    "Finish tier",
  ],
  resultFraming:
    "Bathroom ranges reflect Florida planning bands for the bath type and depth you selected — conceptual only.",
  driverByAnswer: {
    powder: "Powder room — no wet area, typically lower complexity",
    guest: "Guest full bath — moderate wet-area work",
    primary: "Primary bath — larger footprint and higher finish expectations",
    cosmetic: "Cosmetic refresh — limited demo and waterproofing",
    standard: "Standard remodel — full update without major layout change",
    full_gut: "Full gut — new waterproofing, possible reconfiguration",
    vanity: "Vanity and storage package",
    shower_tub: "Shower/tub replacement drives waterproofing and labor",
    tile: "Tile extent strongly affects labor hours",
    plumbing_move: "Plumbing relocation increases cost and inspection scope",
    vent_electrical: "Ventilation and electrical updates for code and comfort",
  },
  resolveScale,
  resolveUnitNote: (a) => {
    const t = a.values.bath_type;
    const s = a.values.bath_scale;
    const typeLabel =
      t === "powder" ? "Powder" : t === "primary" ? "Primary" : "Guest";
    const scaleLabel =
      s === "full_gut" ? "full gut" : s === "cosmetic" ? "cosmetic" : "standard remodel";
    return `${typeLabel} bath · ${scaleLabel}`;
  },
};
