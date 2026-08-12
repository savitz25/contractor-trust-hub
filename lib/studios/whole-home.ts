import type { ScaleBand } from "@/lib/plan/types";
import type { StudioAnswers, StudioDefinition } from "./types";

function resolveScale(answers: StudioAnswers): ScaleBand {
  const scale = answers.values.reno_scale;
  const areas = answers.values.major_areas;
  const areaCount = Array.isArray(areas) ? areas.length : 0;
  if (scale === "near_full" || areaCount >= 5) return "large";
  if (scale === "targeted" && areaCount <= 2) return "small";
  if (scale === "major") return "medium";
  if (scale === "targeted") return "small";
  return "medium";
}

export const wholeHomeStudio: StudioDefinition = {
  slug: "whole-home",
  projectType: "full_home_renovation",
  name: "Whole-Home Renovation Studio",
  shortName: "Whole-Home",
  headline: "Frame a multi-room renovation without false precision",
  positioning:
    "Targeted updates or near full-home remodel — how much of the house is affected, systems work, and whether you stay in place drive cost and sequencing.",
  primaryOccupationCodes: ["CGC", "CBC", "CRC"],
  secondaryOccupationCodes: [],
  steps: [
    {
      id: "scope",
      title: "How large is this renovation?",
      body: "Occupied homes and layout changes usually increase duration and soft costs.",
      fields: [
        {
          id: "reno_scale",
          type: "single",
          label: "Renovation scale",
          required: true,
          options: [
            {
              id: "targeted",
              label: "Targeted multi-room update",
              hint: "Several rooms, limited systems work",
            },
            {
              id: "major",
              label: "Major renovation",
              hint: "Significant finish and systems updates",
            },
            {
              id: "near_full",
              label: "Near full-home remodel",
              hint: "Most of the home, heavy coordination",
            },
          ],
        },
        {
          id: "occupied",
          type: "single",
          label: "Occupied during work?",
          required: true,
          options: [
            { id: "yes", label: "Yes", hint: "Phasing and dust control matter" },
            { id: "no", label: "No", hint: "Empty home can simplify sequencing" },
            { id: "not_sure", label: "Not sure" },
          ],
        },
      ],
    },
    {
      id: "areas",
      title: "Which major areas are involved?",
      body: "Select all that apply — more systems and layout change increase complexity.",
      fields: [
        {
          id: "major_areas",
          type: "multi",
          label: "Major areas involved",
          options: [
            { id: "kitchen", label: "Kitchen" },
            { id: "bathrooms", label: "Bathrooms" },
            { id: "flooring", label: "Flooring throughout" },
            { id: "windows_ext", label: "Windows / exterior" },
            { id: "systems", label: "Systems (electrical / plumbing / HVAC)" },
            { id: "layout", label: "Layout changes" },
          ],
        },
      ],
    },
  ],
  baseCostDrivers: [
    "Percentage of home affected",
    "Layout / structural changes",
    "Systems upgrades",
    "Finish level across multiple rooms",
    "Phasing / occupied-home complexity",
    "Permit and project-management intensity",
  ],
  resultFraming:
    "Whole-home ranges are broad Florida planning bands for the scale and areas you selected — not a formal bid or schedule.",
  driverByAnswer: {
    targeted: "Targeted multi-room work — narrower scope than full-home remodel",
    major: "Major renovation — multi-trade coordination across the house",
    near_full: "Near full-home remodel — high project-management intensity",
    yes: "Occupied home — phasing, protection, and temporary living add complexity",
    no: "Vacant home can improve efficiency but still depends on scope",
    not_sure: "Occupancy TBD — plan for contingency in schedule and logistics",
    kitchen: "Kitchen is often the largest single finish investment",
    bathrooms: "Multiple baths multiply waterproofing and fixture cost",
    flooring: "Whole-home flooring drives material volume and transitions",
    windows_ext: "Windows and exterior work add envelope and permit complexity",
    systems: "Electrical, plumbing, or HVAC upgrades are major cost drivers",
    layout: "Layout changes often require structural and mechanical redesign",
  },
  resolveScale,
  resolveUnitNote: (a) => {
    const s = a.values.reno_scale;
    const scaleLabel =
      s === "near_full"
        ? "Near full-home"
        : s === "major"
          ? "Major renovation"
          : "Targeted multi-room";
    const occ =
      a.values.occupied === "yes"
        ? "occupied"
        : a.values.occupied === "no"
          ? "vacant"
          : "occupancy TBD";
    return `${scaleLabel} · ${occ}`;
  },
};
