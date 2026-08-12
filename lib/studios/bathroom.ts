import type { ScaleBand } from "@/lib/plan/types";
import type { StudioAnswers, StudioDefinition } from "./types";

function resolveScale(answers: StudioAnswers): ScaleBand {
  const scale = answers.values.bath_scale;
  const type = answers.values.bath_type;
  const wet = answers.values.wet_complexity;
  const work = answers.values.work_included;
  const hasMajorWet =
    wet === "major_waterproof" ||
    (Array.isArray(work) &&
      (work.includes("plumbing") ||
        work.includes("tub") ||
        (work.includes("shower") && wet === "shower_rebuild")));

  // Full gut or major waterproofing on primary → upper band
  if (scale === "full_gut") {
    if (type === "primary" || hasMajorWet || type !== "powder") return "large";
    return "medium";
  }
  if (wet === "major_waterproof" || (type === "primary" && hasMajorWet)) {
    return "large";
  }

  // Cosmetic refresh → lower band unless primary with heavy wet work
  if (scale === "cosmetic") {
    if (type === "primary" && Array.isArray(work) && work.length >= 5) return "medium";
    return "small";
  }

  // Powder rooms stay smaller unless full remodel depth
  if (type === "powder") {
    if (scale === "standard" && hasMajorWet) return "medium";
    return "small";
  }

  // Standard remodel is the default common path → medium
  if (scale === "standard" || scale === "not_sure") {
    if (type === "primary" && wet === "shower_rebuild") return "large";
    if (hasMajorWet) return "large";
    if (type === "guest" || type === "primary") return "medium";
    return "medium";
  }

  if (type === "primary") return "medium";
  return "medium";
}

export const bathroomStudio: StudioDefinition = {
  slug: "bathroom",
  projectType: "bathroom_remodel",
  name: "Bathroom Studio",
  shortName: "Bathroom",
  headline: "Plan a bathroom remodel — then verify licensed contractors",
  positioning:
    "Bathroom remodel planning — with licensed contractor verification. Clarify refresh vs standard remodel vs full gut, then match CFC/CRC/CBC licenses on evidence only.",
  primaryOccupationCodes: ["CFC", "CRC", "CBC"],
  secondaryOccupationCodes: ["CGC"],
  budgetOptions: [
    { id: "under_10k", label: "Under $10k" },
    { id: "10_25k", label: "$10k–$25k" },
    { id: "25_50k", label: "$25k–$50k" },
    { id: "50k_plus", label: "$50k+" },
    { id: "not_sure", label: "Not sure" },
  ],
  steps: [
    {
      id: "scope",
      title: "What kind of bathroom project is this?",
      body: "Most homeowners planning a real update choose a standard remodel or full gut. Cosmetic refresh stays available for lighter work.",
      fields: [
        {
          id: "bath_type",
          type: "single",
          label: "Bath type",
          required: true,
          options: [
            {
              id: "powder",
              label: "Powder room",
              hint: "Half bath — no tub or shower",
            },
            {
              id: "guest",
              label: "Guest bathroom",
              hint: "Full bath, secondary use",
            },
            {
              id: "primary",
              label: "Primary bathroom",
              hint: "Main suite — often higher finish expectations",
            },
            { id: "not_sure", label: "Not sure" },
          ],
        },
        {
          id: "bath_scale",
          type: "single",
          label: "Project scale",
          required: true,
          options: [
            {
              id: "cosmetic",
              label: "Cosmetic refresh",
              hint: "Fixtures, paint, limited tile — wet area mostly stays",
            },
            {
              id: "standard",
              label: "Standard remodel",
              hint: "Full update with layout mostly intact — the most common homeowner path",
              featured: true,
            },
            {
              id: "full_gut",
              label: "Full gut-rehab",
              hint: "Strip, new waterproofing, possible plumbing and layout moves",
              featured: true,
            },
            {
              id: "not_sure",
              label: "Not sure",
              hint: "Still deciding how deep the remodel should go",
            },
          ],
        },
      ],
    },
    {
      id: "work",
      title: "What work is included?",
      body: "Shower/tub rebuilds, tile/waterproofing, and plumbing moves usually raise cost and schedule complexity.",
      fields: [
        {
          id: "work_included",
          type: "multi",
          label: "Work included",
          options: [
            { id: "vanity", label: "Vanity / storage" },
            { id: "counter_sink", label: "Countertop / sink" },
            { id: "shower", label: "Shower replacement" },
            {
              id: "tub",
              label: "Tub replacement or tub-to-shower conversion",
            },
            { id: "tile", label: "Tile work" },
            { id: "flooring", label: "Flooring" },
            { id: "electrical", label: "Lighting / electrical" },
            { id: "ventilation", label: "Ventilation upgrades" },
            { id: "plumbing", label: "Plumbing relocation" },
          ],
        },
        {
          id: "wet_complexity",
          type: "single",
          label: "Wet-area complexity",
          required: true,
          options: [
            {
              id: "surface",
              label: "Mostly surface updates",
              hint: "Fixtures and finishes without full wet-area rebuild",
            },
            {
              id: "shower_rebuild",
              label: "Shower/tub rebuild",
              hint: "New pan, walls, and waterproofing in the wet area",
            },
            {
              id: "major_waterproof",
              label: "Major waterproofing / layout changes",
              hint: "Reconfigured wet wall, expanded shower, or major re-plumb",
            },
            { id: "not_sure", label: "Not sure" },
          ],
        },
        {
          id: "bath_constraints",
          type: "multi",
          label: "Optional constraints",
          options: [
            {
              id: "keep_plumbing",
              label: "Keeping existing plumbing locations",
            },
            {
              id: "permit_likely",
              label: "Permit likely needed",
            },
            {
              id: "accessibility",
              label: "Accessibility updates",
            },
            {
              id: "occupied",
              label: "Home will stay occupied during work",
            },
            {
              id: "moisture_leak",
              label: "Active leak or moisture concerns",
            },
          ],
        },
      ],
    },
  ],
  baseCostDrivers: [
    "Shower/tub rebuild vs surface refresh",
    "Tile extent and waterproofing",
    "Plumbing relocation",
    "Vanity / finish tier",
    "Ventilation and electrical updates",
    "Primary vs powder scope differences",
    "Occupied-home complexity",
    "Moisture / repair risk",
  ],
  resultFraming:
    "Conceptual Florida bathroom planning bands only — not a bid. Full shower rebuilds and waterproofing typically move a project beyond cosmetic range. Plumbing relocation increases both cost and schedule complexity. Primary bathrooms usually carry higher finish and layout expectations than powder rooms.",
  driverByAnswer: {
    powder: "Powder room — no wet area; typically lower complexity than full baths",
    guest: "Guest full bath — moderate wet-area work and finish expectations",
    primary:
      "Primary bathrooms usually carry higher finish and layout expectations than powder rooms",
    not_sure: "Bath type TBD — range may span powder through primary suite depth",
    cosmetic:
      "Cosmetic refresh — finishes and fixtures over structural or wet-area rebuild",
    standard:
      "Standard remodel — full update with layout mostly intact (most common path)",
    full_gut:
      "Full gut-rehab — new waterproofing, higher labor, possible reconfiguration",
    vanity: "Vanity / storage package and finish tier",
    counter_sink: "Countertop and sink package — material tier swings cost",
    shower:
      "Full shower rebuilds and waterproofing typically move a project beyond cosmetic range",
    tub: "Tub replacement or tub-to-shower conversion adds demo, waterproofing, and fixture cost",
    tile: "Tile extent and waterproofing strongly affect labor hours",
    flooring: "Flooring replacement or transitions into adjacent rooms",
    electrical: "Lighting and electrical updates for code and comfort",
    ventilation: "Ventilation upgrades reduce moisture risk and may be code-driven",
    plumbing: "Plumbing relocation increases both cost and schedule complexity",
    surface: "Mostly surface updates — lower wet-area rebuild cost",
    shower_rebuild:
      "Full shower rebuilds and waterproofing typically move a project beyond cosmetic range",
    major_waterproof:
      "Major waterproofing or layout changes raise cost, inspection, and schedule complexity",
    keep_plumbing: "Keeping plumbing locations can limit relocation cost",
    permit_likely: "Permits and inspections add soft cost and schedule steps",
    accessibility: "Accessibility updates may change layout, fixtures, and clearances",
    occupied:
      "Occupied-home remodels often require more phasing and protection work",
    moisture_leak:
      "Active leak or moisture concerns can add repair work before finish install",
  },
  resolveScale,
  resolveUnitNote: (a) => {
    const type = a.values.bath_type;
    const scale = a.values.bath_scale;
    const wet = a.values.wet_complexity;
    const typeLabel =
      type === "powder"
        ? "Powder room"
        : type === "primary"
          ? "Primary bath"
          : type === "guest"
            ? "Guest bath"
            : "Bath type TBD";
    const scaleLabel =
      scale === "full_gut"
        ? "full gut"
        : scale === "cosmetic"
          ? "cosmetic refresh"
          : scale === "not_sure"
            ? "depth TBD"
            : "standard remodel";
    const wetLabel =
      wet === "major_waterproof"
        ? "major wet-area work"
        : wet === "shower_rebuild"
          ? "shower/tub rebuild"
          : wet === "surface"
            ? "surface updates"
            : "wet area TBD";
    return `${typeLabel} · ${scaleLabel} · ${wetLabel}`;
  },
};
