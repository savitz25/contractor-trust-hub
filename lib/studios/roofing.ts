import type { ScaleBand } from "@/lib/plan/types";
import type { StudioAnswers, StudioDefinition } from "./types";

function resolveScale(answers: StudioAnswers): ScaleBand {
  const size = answers.values.roof_size;
  const action = answers.values.roof_action;
  const access = answers.values.access;
  const material = answers.values.roof_type;

  const complexAccess =
    access === "multi_story" ||
    access === "steep" ||
    access === "limited" ||
    access === "complex";

  // Full replacement + large / premium material / hard access → upper band
  if (
    size === "large" ||
    complexAccess ||
    material === "tile" ||
    material === "metal" ||
    (action === "full_replace" && size !== "small" && complexAccess)
  ) {
    return "large";
  }

  // Major repair or small size → lower band
  if (action === "major_repair" || action === "repair" || size === "small") {
    return "small";
  }

  // Full replacement / not sure → medium default (not repair-scale)
  if (action === "full_replace" || action === "not_sure") {
    if (size === "small") return "small";
    return "medium";
  }

  if (size === "medium" || size === "not_sure") return "medium";
  return "medium";
}

export const roofingStudio: StudioDefinition = {
  slug: "roofing",
  projectType: "roofing",
  name: "Roofing Studio",
  shortName: "Roofing",
  headline: "Plan a roof replacement — then verify licensed roofing contractors",
  positioning:
    "Roof replacement, re-roof, or major repair — with licensed contractor verification. Clarify size, material, tear-off, and access, then match CCC/RR licenses on evidence only.",
  primaryOccupationCodes: ["CCC", "RR"],
  secondaryOccupationCodes: ["CGC"],
  strictMatching: true,
  budgetOptions: [
    { id: "under_10k", label: "Under $10k" },
    { id: "10_20k", label: "$10k–$20k" },
    { id: "20_35k", label: "$20k–$35k" },
    { id: "35k_plus", label: "$35k+" },
    { id: "not_sure", label: "Not sure" },
  ],
  steps: [
    {
      id: "scope",
      title: "What roof work are you considering?",
      body: "Full replacement is the most common path when you want a complete new system. Re-roof and major repair stay available when they fit.",
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
              hint: "Tear-off, decking as needed, new underlayment and covering — most common complete-system path",
              featured: true,
            },
            {
              id: "reroof",
              label: "Re-roof / overlay",
              hint: "New covering over existing layers where allowed",
            },
            {
              id: "major_repair",
              label: "Major repair",
              hint: "Significant leak or damage — not a full-system replacement",
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
              hint: "Compact home, simple footprint, or partial area",
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
              hint: "Square count can be added later in introduction notes if known",
            },
          ],
        },
      ],
    },
    {
      id: "details",
      title: "Material, access, and replacement details",
      body: "For full replacement, material, access, and tear-off/decking risk usually move the planning range more than brand names.",
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
              label: "Flat / other",
              hint: "Low-slope or other systems and drainage details",
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
          label: "Access / complexity",
          required: true,
          options: [
            {
              id: "easy",
              label: "Single-story, easy access",
              hint: "Straightforward staging and disposal",
            },
            {
              id: "multi_story",
              label: "Multi-story",
              hint: "Two or more stories increases labor and safety cost",
            },
            {
              id: "steep",
              label: "Steep or complex roof",
              hint: "Pitch, many planes, or intricate geometry",
            },
            {
              id: "limited",
              label: "Limited access / difficult site",
              hint: "Tight lot, HOA staging limits, or hard material access",
            },
            {
              id: "not_sure",
              label: "Not sure",
              hint: "You can refine after a site look",
            },
          ],
        },
        {
          id: "replace_factors",
          type: "multi",
          label: "Replacement-specific details",
          showWhen: {
            fieldId: "roof_action",
            values: ["full_replace", "not_sure"],
          },
          options: [
            {
              id: "tear_off",
              label: "Full tear-off expected",
              hint: "Typical for complete replacement",
            },
            {
              id: "decking_concern",
              label: "Possible decking repairs",
              hint: "Soft or damaged decking often found after tear-off",
            },
            {
              id: "ventilation",
              label: "Ventilation upgrades",
              hint: "Ridge, soffit, or intake/exhaust improvements",
            },
            {
              id: "skylights",
              label: "Skylights / penetrations",
              hint: "Flashings around skylights, pipes, chimneys",
            },
            {
              id: "hoa_permit",
              label: "HOA or permit constraints",
              hint: "Association rules, historic, or permit complexity",
            },
            {
              id: "active_leak",
              label: "Active leak concerns",
              hint: "Ongoing water intrusion — prioritize inspection",
            },
          ],
        },
      ],
    },
  ],
  baseCostDrivers: [
    "Material type",
    "Roof size",
    "Tear-off vs overlay",
    "Pitch / stories / access complexity",
    "Decking condition risk",
    "Ventilation and flashing details",
    "Disposal / permit requirements",
  ],
  resultFraming:
    "Conceptual Florida planning bands only — not a bid. Full tear-off and potential decking repairs usually push costs higher than overlay. Tile or metal systems typically price above standard asphalt shingle replacements. Multi-story or steep roofs increase labor and safety complexity. What is found under the old roof can still move actual proposals.",
  driverByAnswer: {
    full_replace:
      "Full tear-off and a complete new system usually sit above repair or limited overlay ranges",
    reroof:
      "Overlay may cost less than full tear-off when code allows — layer limits still apply",
    major_repair:
      "Major repair is smaller than full replacement; confirm damage does not warrant a full system",
    not_sure:
      "Action TBD — range spans repair through full replacement until inspection clarifies",
    small: "Smaller roof area reduces material squares and labor volume",
    medium: "Typical single-family roof size for Florida homes",
    large: "Larger size increases squares, flashings, and disposal",
    shingle: "Asphalt shingle replacements are the most common mid-range material path",
    tile: "Tile or metal systems typically price above standard asphalt shingle replacements",
    metal: "Tile or metal systems typically price above standard asphalt shingle replacements",
    flat: "Flat / other systems use different membranes and drainage details",
    easy: "Single-story easy access improves labor efficiency on replacement",
    multi_story: "Multi-story or steep roofs increase labor and safety complexity",
    steep: "Multi-story or steep roofs increase labor and safety complexity",
    limited: "Limited access or difficult sites raise staging and labor cost",
    tear_off:
      "Full tear-off and potential decking repairs usually push costs higher than overlay",
    decking_concern:
      "Full tear-off and potential decking repairs usually push costs higher than overlay",
    ventilation: "Ventilation upgrades add materials and detailing beyond basic covering",
    skylights: "Skylights and penetrations add flashing labor and leak-risk detailing",
    hoa_permit: "HOA or permit constraints can extend schedule and soft cost",
    active_leak: "Active leaks raise urgency — still verify license class before hiring",
  },
  resolveScale,
  resolveUnitNote: (a) => {
    const action =
      a.values.roof_action === "full_replace"
        ? "Full replacement"
        : a.values.roof_action === "reroof"
          ? "Re-roof / overlay"
          : a.values.roof_action === "major_repair"
            ? "Major repair"
            : "Roofing (scope TBD)";
    const size =
      a.values.roof_size === "not_sure" || !a.values.roof_size
        ? "size TBD"
        : String(a.values.roof_size);
    const mat =
      !a.values.roof_type || a.values.roof_type === "not_sure"
        ? "material TBD"
        : a.values.roof_type === "shingle"
          ? "asphalt shingle"
          : a.values.roof_type === "flat"
            ? "flat/other"
            : String(a.values.roof_type);
    const accessMap: Record<string, string> = {
      easy: "single-story access",
      multi_story: "multi-story",
      steep: "steep/complex",
      limited: "limited access",
      complex: "complex access",
      not_sure: "access TBD",
    };
    const access =
      accessMap[String(a.values.access || "not_sure")] || "access TBD";
    return `${action} · ${size} · ${mat} · ${access}`;
  },
};
