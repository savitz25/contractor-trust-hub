import type { ScaleBand } from "@/lib/plan/types";
import type { StudioAnswers, StudioDefinition } from "./types";

function resolveScale(answers: StudioAnswers): ScaleBand {
  const size = answers.values.addition_size;
  const type = answers.values.addition_type;
  if (type === "second_story" || size === "large") return "large";
  if (type === "bump_out" || size === "small") return "small";
  if (size === "medium") return "medium";
  return "medium";
}

export const additionStudio: StudioDefinition = {
  slug: "addition",
  projectType: "addition",
  name: "Addition / Extension Studio",
  shortName: "Addition",
  headline: "Clarify addition complexity before you hire",
  positioning:
    "Room addition, bump-out, or second story — foundation, roof tie-in, and structural work drive cost and which license class fits.",
  primaryOccupationCodes: ["CGC", "CBC"],
  secondaryOccupationCodes: ["CRC"],
  steps: [
    {
      id: "scope",
      title: "What kind of addition are you considering?",
      body: "Second-story work and foundation complexity usually move cost more than finish choices alone.",
      fields: [
        {
          id: "addition_type",
          type: "single",
          label: "Addition type",
          required: true,
          options: [
            { id: "room", label: "Room addition", hint: "New room at ground level" },
            {
              id: "second_story",
              label: "Second-story addition",
              hint: "Adding living space above",
            },
            {
              id: "bump_out",
              label: "Bump-out / small extension",
              hint: "Modest footprint expansion",
            },
            { id: "not_sure", label: "Not sure", hint: "Still exploring options" },
          ],
        },
        {
          id: "addition_size",
          type: "single",
          label: "Approximate size",
          required: true,
          options: [
            { id: "small", label: "Small", hint: "Under ~200 sq ft" },
            { id: "medium", label: "Medium", hint: "~200–400 sq ft" },
            { id: "large", label: "Large", hint: "400+ sq ft" },
          ],
        },
      ],
    },
    {
      id: "work",
      title: "What work is included?",
      body: "Select all that apply. Structural and roof tie-in items usually raise complexity.",
      fields: [
        {
          id: "work_included",
          type: "multi",
          label: "Work included",
          options: [
            { id: "foundation", label: "Foundation work" },
            { id: "roof_tie", label: "Roof tie-in" },
            { id: "kitchen_bath", label: "Kitchen or bath in addition" },
            { id: "structural", label: "Structural modifications" },
            { id: "exterior_match", label: "Exterior matching / siding" },
            { id: "mech_extend", label: "Electrical / HVAC extension" },
          ],
        },
      ],
    },
  ],
  baseCostDrivers: [
    "Foundation and structural complexity",
    "Roof tie-in and weatherproofing",
    "Second-story vs ground-level",
    "Interior finish level",
    "Mechanical extensions (HVAC, electrical, plumbing)",
    "Permitting and design complexity",
  ],
  resultFraming:
    "Addition ranges reflect Florida planning bands for the type and size you described — conceptual only, not a bid.",
  driverByAnswer: {
    room: "Ground-level room addition — foundation and roof tie-in still matter",
    second_story: "Second-story work adds structural engineering and access complexity",
    bump_out: "Small bump-out — smaller footprint but still requires proper tie-in",
    not_sure: "Scope TBD — ranges span typical ground-level to more complex additions",
    small: "Smaller footprint reduces some material and foundation volume",
    medium: "Mid-size addition — typical multi-trade coordination",
    large: "Larger footprint increases structure, finish, and mechanical extension cost",
    foundation: "Foundation work is a major cost driver on additions",
    roof_tie: "Roof tie-in and weatherproofing must integrate with existing structure",
    kitchen_bath: "Wet areas in the addition add plumbing and waterproofing cost",
    structural: "Structural modifications require engineering and careful sequencing",
    exterior_match: "Matching exterior materials affects labor and material tier",
    mech_extend: "HVAC and electrical extension into new space",
  },
  resolveScale,
  resolveUnitNote: (a) => {
    const t = a.values.addition_type;
    const typeLabel =
      t === "second_story"
        ? "Second story"
        : t === "bump_out"
          ? "Bump-out"
          : t === "room"
            ? "Room addition"
            : "Addition";
    const size = a.values.addition_size || "medium";
    return `${typeLabel} · ${size} footprint`;
  },
};
