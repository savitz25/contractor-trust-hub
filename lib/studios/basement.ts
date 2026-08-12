import type { ScaleBand } from "@/lib/plan/types";
import type { StudioAnswers, StudioDefinition } from "./types";

function resolveScale(answers: StudioAnswers): ScaleBand {
  const work = answers.values.work_included;
  const use = answers.values.intended_use;
  const hasBath =
    Array.isArray(work) &&
    (work.includes("bathroom_add") || work.includes("wet_bar"));
  const hasEgress = Array.isArray(work) && work.includes("egress");
  if (hasBath && (use === "guest_suite" || hasEgress)) return "large";
  if (hasBath || use === "guest_suite") return "medium";
  if (answers.values.condition === "unfinished" && use === "family") return "medium";
  if (use === "office_gym" && !hasBath) return "small";
  return "medium";
}

export const basementStudio: StudioDefinition = {
  slug: "basement",
  projectType: "basement_finish",
  name: "Basement Finish Studio",
  shortName: "Basement",
  headline: "Scope lower-level finishing with code and moisture in mind",
  positioning:
    "Unfinished, partial, or rework — moisture control, egress, and wet areas drive cost more than square footage alone. (Less common in Florida; still useful for walkouts and lower levels.)",
  primaryOccupationCodes: ["CGC", "CBC", "CRC"],
  secondaryOccupationCodes: [],
  steps: [
    {
      id: "scope",
      title: "What are you starting with, and how will you use the space?",
      fields: [
        {
          id: "condition",
          type: "single",
          label: "Current condition",
          required: true,
          options: [
            { id: "unfinished", label: "Unfinished" },
            { id: "partial", label: "Partially finished" },
            {
              id: "rework",
              label: "Prior finish needing rework",
              hint: "Demo or major refresh of old work",
            },
          ],
        },
        {
          id: "intended_use",
          type: "single",
          label: "Intended use",
          required: true,
          options: [
            { id: "family", label: "Family / rec room" },
            { id: "guest_suite", label: "Guest suite / bedroom" },
            { id: "office_gym", label: "Office / gym" },
            { id: "mixed", label: "Mixed use" },
          ],
        },
      ],
    },
    {
      id: "work",
      title: "What work is included?",
      body: "Bathroom additions, egress, and moisture work are the biggest escalators.",
      fields: [
        {
          id: "work_included",
          type: "multi",
          label: "Work included",
          options: [
            { id: "framing", label: "Framing / insulation" },
            { id: "egress", label: "Egress window or code upgrades" },
            { id: "bathroom_add", label: "Bathroom addition" },
            { id: "wet_bar", label: "Wet bar / kitchenette" },
            { id: "flooring", label: "Flooring" },
            { id: "ceiling_light", label: "Ceiling / lighting" },
            { id: "moisture", label: "Moisture / waterproofing concerns" },
          ],
        },
      ],
    },
  ],
  baseCostDrivers: [
    "Moisture control and waterproofing",
    "Egress / code requirements",
    "Bathroom or plumbing add-ons",
    "Ceiling height and finishing complexity",
    "HVAC / electrical extension",
    "Intended-use finish level",
  ],
  resultFraming:
    "Lower-level ranges are conceptual Florida planning bands for the condition and use you selected — not a bid.",
  driverByAnswer: {
    unfinished: "Starting unfinished — full framing and finish path",
    partial: "Partial finish may reduce some framing but can leave uneven quality",
    rework: "Rework often includes selective demo before new finish",
    family: "Rec/family use — durable finishes, flexible lighting",
    guest_suite: "Guest suite often needs egress, privacy, and bath planning",
    office_gym: "Office/gym — focus on floors, power, and climate control",
    mixed: "Mixed use increases zoning of spaces and finish transitions",
    framing: "Framing and insulation define the finished envelope",
    egress: "Egress and code upgrades are required for sleeping rooms",
    bathroom_add: "Bathroom addition drives plumbing and waterproofing cost",
    wet_bar: "Wet bar / kitchenette adds plumbing and cabinetry",
    flooring: "Flooring package and substrate prep",
    ceiling_light: "Ceiling type and lighting layout affect labor",
    moisture: "Moisture control is essential before finish work proceeds",
  },
  resolveScale,
  resolveUnitNote: (a) => {
    const c = a.values.condition;
    const u = a.values.intended_use;
    const cond =
      c === "unfinished" ? "Unfinished" : c === "partial" ? "Partial" : "Rework";
    const use =
      u === "guest_suite"
        ? "guest suite"
        : u === "office_gym"
          ? "office/gym"
          : u === "mixed"
            ? "mixed use"
            : "family/rec";
    return `${cond} · ${use}`;
  },
};
