import type { ScaleBand } from "@/lib/plan/types";
import type { StudioAnswers, StudioDefinition } from "./types";

function resolveScale(answers: StudioAnswers): ScaleBand {
  const scale = answers.values.project_scale;
  const size = answers.values.kitchen_size;
  const layout = answers.values.layout_complexity;
  const work = answers.values.work_included;
  const hasMajorLayout =
    layout === "major" ||
    (Array.isArray(work) &&
      (work.includes("layout") || work.includes("plumbing")));

  // Full gut or major layout + large → upper band
  if (scale === "full_gut" || (hasMajorLayout && size === "large")) {
    return "large";
  }
  if (size === "large" && (scale === "mid" || scale === "not_sure")) {
    return "large";
  }

  // Cosmetic refresh → lower band unless large kitchen with many work items
  if (scale === "refresh") {
    if (size === "large" && Array.isArray(work) && work.length >= 4) return "medium";
    return "small";
  }

  // Mid-range remodel is the default common path → medium
  if (scale === "mid" || scale === "not_sure") {
    if (size === "small" && !hasMajorLayout) return "small";
    if (hasMajorLayout) return "large";
    return "medium";
  }

  if (size === "small") return "small";
  if (size === "large") return "large";
  return "medium";
}

export const kitchenStudio: StudioDefinition = {
  slug: "kitchen",
  projectType: "kitchen_remodel",
  name: "Kitchen Studio",
  shortName: "Kitchen",
  headline: "Plan a kitchen remodel — then verify licensed contractors",
  positioning:
    "Kitchen remodel planning — with licensed contractor verification. Clarify refresh vs mid-range remodel vs full gut, then match CGC/CBC/CRC licenses on evidence only.",
  primaryOccupationCodes: ["CGC", "CBC", "CRC"],
  secondaryOccupationCodes: ["CFC"],
  budgetOptions: [
    { id: "under_25k", label: "Under $25k" },
    { id: "25_50k", label: "$25k–$50k" },
    { id: "50_100k", label: "$50k–$100k" },
    { id: "100k_plus", label: "$100k+" },
    { id: "not_sure", label: "Not sure" },
  ],
  steps: [
    {
      id: "scope",
      title: "What kind of kitchen project is this?",
      body: "Most homeowners planning a real update choose a mid-range remodel or full gut. Cosmetic refresh stays available for lighter work.",
      fields: [
        {
          id: "project_scale",
          type: "single",
          label: "Project scale",
          required: true,
          options: [
            {
              id: "refresh",
              label: "Cosmetic refresh",
              hint: "Paint, hardware, limited counter or fixture updates — layout stays",
            },
            {
              id: "mid",
              label: "Mid-range remodel",
              hint: "Cabinets and finishes with limited layout change — the most common homeowner path",
              featured: true,
            },
            {
              id: "full_gut",
              label: "Full gut-rehab",
              hint: "Strip to studs, possible layout and mechanical moves",
              featured: true,
            },
            {
              id: "not_sure",
              label: "Not sure",
              hint: "Still deciding how deep the remodel should go",
            },
          ],
        },
        {
          id: "kitchen_size",
          type: "single",
          label: "Kitchen size",
          required: true,
          options: [
            { id: "small", label: "Small", hint: "Galley or compact" },
            { id: "average", label: "Average", hint: "Typical family kitchen" },
            { id: "large", label: "Large", hint: "Open plan or large island" },
            { id: "not_sure", label: "Not sure" },
          ],
        },
      ],
    },
    {
      id: "work",
      title: "What work is included?",
      body: "Select all that apply. Layout, plumbing, or electrical moves usually raise cost and schedule complexity.",
      fields: [
        {
          id: "work_included",
          type: "multi",
          label: "Work included",
          options: [
            { id: "cabinets", label: "Cabinets" },
            { id: "countertops", label: "Countertops" },
            { id: "backsplash", label: "Backsplash" },
            { id: "appliances", label: "Appliances" },
            { id: "flooring", label: "Flooring" },
            { id: "electrical", label: "Lighting / electrical updates" },
            { id: "layout", label: "Layout changes" },
            { id: "plumbing", label: "Plumbing relocation" },
          ],
        },
        {
          id: "layout_complexity",
          type: "single",
          label: "Layout complexity",
          required: true,
          options: [
            {
              id: "same",
              label: "Same layout",
              hint: "Keep existing footprint and appliance locations",
            },
            {
              id: "minor",
              label: "Minor layout changes",
              hint: "Small shifts without major plumbing moves",
            },
            {
              id: "major",
              label: "Major layout changes",
              hint: "Islands, wall moves, or relocated wet wall",
            },
            { id: "not_sure", label: "Not sure" },
          ],
        },
        {
          id: "kitchen_constraints",
          type: "multi",
          label: "Optional constraints",
          options: [
            {
              id: "keep_appliance_loc",
              label: "Keeping existing appliance locations",
            },
            {
              id: "structural",
              label: "Structural wall concerns",
            },
            {
              id: "permit_likely",
              label: "Permit likely needed",
            },
            {
              id: "occupied",
              label: "Home will stay occupied during work",
            },
            {
              id: "design_open",
              label: "Design not finalized",
            },
          ],
        },
      ],
    },
  ],
  baseCostDrivers: [
    "Cabinet scope and quality tier",
    "Countertop material tier",
    "Layout / plumbing / electrical changes",
    "Appliance package level",
    "Flooring and finish extent",
    "Occupied-home jobsite complexity",
    "Permit / structural complexity",
  ],
  resultFraming:
    "Conceptual Florida kitchen planning bands only — not a bid. Full cabinet replacement and layout changes typically move a project out of refresh range. Plumbing or electrical relocation increases both cost and schedule complexity. Occupied-home remodels often require more phasing and protection work.",
  driverByAnswer: {
    refresh:
      "Cosmetic refresh — finishes and fixtures over structural or layout change",
    mid: "Mid-range remodel — cabinet and finish package with limited layout moves (most common path)",
    full_gut:
      "Full gut-rehab — higher labor, possible mechanical moves, and permit complexity",
    not_sure:
      "Depth TBD — range spans refresh through full gut until scope is clarified",
    small: "Compact kitchen can limit some material volume but may constrain layout options",
    average: "Average family kitchen footprint for Florida homes",
    large: "Larger footprint increases cabinet and counter linear feet",
    cabinets:
      "Full cabinet replacement and layout changes typically move a project out of refresh range",
    countertops: "Countertop material tier swings cost significantly",
    backsplash: "Backsplash material and labor extent",
    appliances: "Appliance package level and installation requirements",
    flooring: "Flooring replacement or transitions into adjacent rooms",
    electrical:
      "Plumbing or electrical relocation increases both cost and schedule complexity",
    layout:
      "Full cabinet replacement and layout changes typically move a project out of refresh range",
    plumbing:
      "Plumbing or electrical relocation increases both cost and schedule complexity",
    same: "Same layout — lower mechanical complexity when appliances stay put",
    minor: "Minor layout changes — limited plumbing/electrical impact",
    major:
      "Major layout changes — wet wall or island moves raise cost and schedule risk",
    keep_appliance_loc: "Keeping appliance locations can limit plumbing/electrical moves",
    structural: "Structural wall concerns add engineering and permit complexity",
    permit_likely: "Permits and inspections add soft cost and schedule steps",
    occupied:
      "Occupied-home remodels often require more phasing and protection work",
    design_open: "Design not finalized — allow contingency in budget and schedule",
  },
  resolveScale,
  resolveUnitNote: (a) => {
    const scale = a.values.project_scale;
    const size = a.values.kitchen_size;
    const layout = a.values.layout_complexity;
    const scaleLabel =
      scale === "full_gut"
        ? "Full gut"
        : scale === "refresh"
          ? "Cosmetic refresh"
          : scale === "not_sure"
            ? "Depth TBD"
            : "Mid-range remodel";
    const sizeLabel =
      size === "large"
        ? "large"
        : size === "small"
          ? "small"
          : size === "not_sure"
            ? "size TBD"
            : "average";
    const layoutLabel =
      layout === "major"
        ? "major layout change"
        : layout === "minor"
          ? "minor layout change"
          : layout === "same"
            ? "same layout"
            : "layout TBD";
    return `${scaleLabel} · ${sizeLabel} kitchen · ${layoutLabel}`;
  },
};
