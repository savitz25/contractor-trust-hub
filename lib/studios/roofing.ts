import type { ScaleBand } from "@/lib/plan/types";
import type { StudioAnswers, StudioDefinition } from "./types";

function resolveScale(answers: StudioAnswers): ScaleBand {
  const size = answers.values.roof_size;
  const action = answers.values.roof_action;
  const access = answers.values.access;
  const material = answers.values.roof_type;

  // Full replacement + large / tile / metal / complex access → upper band
  if (
    size === "large" ||
    access === "complex" ||
    material === "tile" ||
    material === "metal" ||
    (action === "full_replace" && size === "medium" && access === "complex")
  ) {
    return "large";
  }

  // Major repair or small size → lower band
  if (action === "repair" || action === "major_repair" || size === "small") {
    return "small";
  }

  // Full replacement default → at least medium (not repair-scale)
  if (action === "full_replace" || action === "not_sure") {
    if (size === "small") return "small";
    return "medium";
  }

  if (size === "medium") return "medium";
  return "medium";
}

export const roofingStudio: StudioDefinition = {
  slug: "roofing",
  projectType: "roofing",
  name: "Roofing Studio",
  shortName: "Roofing",
  headline: "Plan a roof replacement — then verify licensed roofing contractors",
  positioning:
    "Full replacement, re-roof, or major repair — understand size, material, tear-off, and access drivers. We match certified and registered roofing licenses first (CCC / RR), not rankings or reviews.",
  primaryOccupationCodes: ["CCC", "RR"],
  secondaryOccupationCodes: ["CGC"],
  strictMatching: true,
  steps: [
    {
      id: "scope",
      title: "What roof work are you considering?",
      body: "Most homeowners planning a new system choose full replacement (tear-off and new covering). Re-roof and repair remain available when that fits the situation.",
      fields: [
        {
          id: "roof_action",
          type: "single",
          label: "Roof action",
          required: true,
          options: [
            {
              id: "full_replace",
              label: "Full replacement",
              hint: "Tear-off existing roof, inspect/replace decking as needed, new underlayment and covering — the most common path for a complete new system",
              featured: true,
            },
            {
              id: "reroof",
              label: "Re-roof / overlay",
              hint: "New covering over existing layers where allowed — often limited by code and layer count",
            },
            {
              id: "major_repair",
              label: "Major repair",
              hint: "Significant leak or damage repair — not a full-system replacement",
            },
            {
              id: "not_sure",
              label: "Not sure",
              hint: "Still deciding between repair, overlay, or full replacement",
            },
          ],
        },
        {
          id: "roof_size",
          type: "single",
          label: "Approximate roof size",
          required: true,
          options: [
            {
              id: "small",
              label: "Small",
              hint: "Compact home, simple footprint, or partial roof area",
            },
            {
              id: "medium",
              label: "Medium",
              hint: "Typical single-family home",
            },
            {
              id: "large",
              label: "Large",
              hint: "Large footprint, multi-wing, or many planes",
            },
            {
              id: "not_sure",
              label: "Not sure",
              hint: "You can mention square count later in introduction notes if known",
            },
          ],
        },
      ],
    },
    {
      id: "details",
      title: "Material, access, and replacement factors",
      body: "For full replacement, material choice, stories/access, and decking condition usually move the planning range more than brand names.",
      fields: [
        {
          id: "roof_type",
          type: "single",
          label: "Roof material",
          required: true,
          options: [
            {
              id: "shingle",
              label: "Asphalt shingle",
              hint: "Most common Florida residential system",
            },
            {
              id: "tile",
              label: "Tile",
              hint: "Heavier system — structure and underlayment matter",
            },
            {
              id: "metal",
              label: "Metal",
              hint: "Product and complexity vary widely",
            },
            {
              id: "flat",
              label: "Flat / low-slope",
              hint: "Different systems and drainage details",
            },
            {
              id: "not_sure",
              label: "Not sure",
              hint: "Ranges span common Florida systems",
            },
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
              hint: "Straightforward staging, ladders, and disposal",
            },
            {
              id: "complex",
              label: "Multi-story or complex access",
              hint: "Steep pitch, multi-level, tight lot, or limited staging",
            },
          ],
        },
        {
          id: "replace_factors",
          type: "multi",
          label: "Known factors (optional — select any that apply)",
          options: [
            {
              id: "tear_off",
              label: "Full tear-off expected",
              hint: "Typical for complete replacement",
            },
            {
              id: "decking_concern",
              label: "Possible soft or damaged decking",
              hint: "Often discovered after tear-off",
            },
            {
              id: "multiple_layers",
              label: "Multiple existing roof layers",
              hint: "Can require full tear-off under code",
            },
            {
              id: "wind_mit",
              label: "Wind mitigation / code upgrade focus",
              hint: "Common Florida insurance and permit consideration",
            },
            {
              id: "skylights",
              label: "Skylights, chimneys, or complex penetrations",
              hint: "Adds detailing and flashings",
            },
          ],
        },
      ],
    },
  ],
  baseCostDrivers: [
    "Full tear-off vs limited overlay",
    "Roof size (squares) and number of planes",
    "Material system (shingle, tile, metal, low-slope)",
    "Underlayment and decking condition after tear-off",
    "Stories, pitch, and site access",
    "Florida wind code, permits, and disposal",
  ],
  resultFraming:
    "These are Florida conceptual planning bands for the roof action, size, material, and access you described — not a contractor bid. Full replacement often sits higher than repair because of tear-off, underlayment, disposal, and decking unknowns. Wind code and what is found under the old roof can move actual proposals.",
  driverByAnswer: {
    full_replace:
      "Full replacement — tear-off, underlayment, new covering, and disposal drive most of the range",
    reroof:
      "Re-roof / overlay — may cost less than full tear-off when code allows; layer limits still apply",
    major_repair:
      "Major repair — localized scope; still confirm whether damage warrants full replacement",
    repair: "Repair-scale work — smaller scope than a full system replacement",
    not_sure:
      "Action TBD — planning range spans repair through full replacement; clarify after inspection",
    small: "Smaller roof area reduces material squares and labor volume",
    medium: "Typical single-family roof size for Florida homes",
    large: "Large footprint or many planes increases squares, flashings, and disposal",
    shingle: "Asphalt shingle — common mid-range material path for full replacement",
    tile: "Tile systems are heavier and typically higher cost (structure and underlayment)",
    metal: "Metal systems vary widely by product, complexity, and detailing",
    flat: "Flat / low-slope systems use different materials and drainage details",
    easy: "Single-story easy access improves labor efficiency on replacement",
    complex: "Multi-story or complex access raises labor, safety, and staging cost",
    tear_off: "Full tear-off is standard for complete replacement and adds disposal cost",
    decking_concern: "Damaged decking found after tear-off is a common mid-to-high range driver",
    multiple_layers: "Multiple layers often force full tear-off under Florida practice/code",
    wind_mit: "Wind mitigation and code upgrades can add underlayment and fastening scope",
    skylights: "Penetrations (skylights, chimneys) add flashing labor and leak risk detailing",
  },
  resolveScale,
  resolveUnitNote: (a) => {
    const action =
      a.values.roof_action === "full_replace"
        ? "Full replacement"
        : a.values.roof_action === "reroof"
          ? "Re-roof / overlay"
          : a.values.roof_action === "major_repair" || a.values.roof_action === "repair"
            ? "Major repair"
            : "Roofing (scope TBD)";
    const size =
      a.values.roof_size === "not_sure"
        ? "size TBD"
        : a.values.roof_size
          ? String(a.values.roof_size)
          : "medium";
    const mat =
      !a.values.roof_type || a.values.roof_type === "not_sure"
        ? "material TBD"
        : a.values.roof_type === "shingle"
          ? "asphalt shingle"
          : a.values.roof_type === "flat"
            ? "flat/low-slope"
            : String(a.values.roof_type);
    const access =
      a.values.access === "complex" ? "complex access" : "single-story access";
    return `${action} · ${size} · ${mat} · ${access}`;
  },
};
