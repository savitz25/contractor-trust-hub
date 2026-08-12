import type { ScaleBand } from "@/lib/plan/types";
import type { StudioAnswers, StudioDefinition } from "./types";

function resolveScale(answers: StudioAnswers): ScaleBand {
  const size = answers.values.roof_size;
  const action = answers.values.roof_action;
  const access = answers.values.access;
  if (size === "large" || access === "complex" || answers.values.roof_type === "tile") {
    return "large";
  }
  if (action === "repair" || size === "small") return "small";
  if (size === "medium") return "medium";
  return "medium";
}

export const roofingStudio: StudioDefinition = {
  slug: "roofing",
  projectType: "roofing",
  name: "Roofing Studio",
  shortName: "Roofing",
  headline: "Scope a roof project with Florida realities in mind",
  positioning:
    "Repair, re-roof, or full replacement — material, size, access, and tear-off drive cost. We match certified roofing licenses first.",
  primaryOccupationCodes: ["CCC", "RR"],
  secondaryOccupationCodes: ["CGC"],
  strictMatching: true,
  steps: [
    {
      id: "scope",
      title: "What roof work do you need?",
      fields: [
        {
          id: "roof_action",
          type: "single",
          label: "Roof action",
          required: true,
          options: [
            { id: "repair", label: "Repair", hint: "Localized leaks or damage" },
            { id: "reroof", label: "Re-roof", hint: "New covering on existing structure" },
            {
              id: "full_replace",
              label: "Full replacement",
              hint: "Tear-off, decking as needed, full system",
            },
          ],
        },
        {
          id: "roof_size",
          type: "single",
          label: "Roof size band",
          required: true,
          options: [
            { id: "small", label: "Small", hint: "Compact home or partial roof" },
            { id: "medium", label: "Medium", hint: "Typical single-family" },
            { id: "large", label: "Large", hint: "Large footprint or multi-wing" },
          ],
        },
      ],
    },
    {
      id: "details",
      title: "Material and access",
      body: "Tile and multi-story access often require specialized crews and higher disposal costs.",
      fields: [
        {
          id: "roof_type",
          type: "single",
          label: "Roof type (if known)",
          options: [
            { id: "shingle", label: "Shingle" },
            { id: "tile", label: "Tile" },
            { id: "metal", label: "Metal" },
            { id: "not_sure", label: "Not sure" },
          ],
        },
        {
          id: "access",
          type: "single",
          label: "Stories / access complexity",
          required: true,
          options: [
            {
              id: "easy",
              label: "Single-story, easy access",
              hint: "Straightforward staging and disposal",
            },
            {
              id: "complex",
              label: "Multi-story or complex access",
              hint: "Steep, multi-level, or limited staging",
            },
          ],
        },
      ],
    },
  ],
  baseCostDrivers: [
    "Material type",
    "Roof size and pitch/complexity",
    "Tear-off vs overlay",
    "Underlayment / decking condition",
    "Access and stories",
    "Permit and disposal",
  ],
  resultFraming:
    "Roofing ranges are Florida planning bands for the action, size, and access you described. Wind code and decking condition can move actual bids.",
  driverByAnswer: {
    repair: "Localized repair — smaller scope, still confirm leak source",
    reroof: "Re-roof — new covering; decking condition still matters",
    full_replace: "Full replacement with tear-off and disposal",
    small: "Smaller roof area reduces material and labor volume",
    medium: "Typical single-family roof size",
    large: "Large roof area increases squares and disposal",
    shingle: "Asphalt shingle systems are common mid-range material",
    tile: "Tile systems are heavier and typically higher cost",
    metal: "Metal systems vary widely by product and complexity",
    not_sure: "Material TBD — ranges span common Florida systems",
    easy: "Single-story easy access improves labor efficiency",
    complex: "Multi-story or complex access raises labor and safety cost",
  },
  resolveScale,
  resolveUnitNote: (a) => {
    const action =
      a.values.roof_action === "repair"
        ? "Repair"
        : a.values.roof_action === "full_replace"
          ? "Full replacement"
          : "Re-roof";
    const mat =
      a.values.roof_type === "not_sure" || !a.values.roof_type
        ? "material TBD"
        : String(a.values.roof_type);
    return `${action} · ${a.values.roof_size || "medium"} · ${mat}`;
  },
};
