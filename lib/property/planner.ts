import { getProjectType, isProjectTypeId } from "@/lib/plan/project-types";
import { coverageForCounty } from "./coverage";
import { countyFromFloridaZip, normalizeZip } from "@/lib/plan/location";
import type {
  PermitCategoryAdvice,
  PermitPlannerInput,
  PermitPlannerResult,
} from "./types";

const DISCLAIMER =
  "Educational planner only — not an official determination. Final permit and inspection requirements are set by the local authority having jurisdiction (AHJ). Confirm before work starts.";

/** Map project type + factors → likely permit categories to investigate. */
export function buildPermitPlan(input: PermitPlannerInput): PermitPlannerResult {
  const typeId = isProjectTypeId(input.projectType)
    ? input.projectType
    : "general_contracting";
  const def = getProjectType(typeId);
  const zip = normalizeZip(input.zip);
  const county =
    input.county?.trim() ||
    (zip ? countyFromFloridaZip(zip) : null) ||
    null;
  const city = input.city?.trim() || null;
  const factors = new Set(input.factors || []);
  const cov = coverageForCounty(county);

  const categories: PermitCategoryAdvice[] = [];
  const push = (c: PermitCategoryAdvice) => {
    if (!categories.some((x) => x.id === c.id)) categories.push(c);
  };

  // Base by project type
  if (typeId === "roofing") {
    push({
      id: "roofing",
      label: "Roofing / re-roof",
      likelihood: "commonly_required",
      detail:
        "Most Florida jurisdictions require a roofing permit for re-roof or full replacement. Confirm NOA products and wind-mitigation documentation when applicable.",
    });
  }
  if (typeId === "kitchen_remodel" || typeId === "bathroom_remodel") {
    push({
      id: "building",
      label: "Building",
      likelihood: "often_required",
      detail:
        "Interior remodels may need a building permit depending on structural work, wet-area rebuilds, and local thresholds.",
    });
  }
  if (typeId === "addition" || typeId === "full_home_renovation" || typeId === "custom_home_rebuild") {
    push({
      id: "building",
      label: "Building",
      likelihood: "commonly_required",
      detail: "Additions and major renovations almost always require building permits and inspections.",
    });
  }
  if (typeId === "deck_outdoor" || typeId === "siding_exterior") {
    push({
      id: "building",
      label: "Building / structural",
      likelihood: "often_required",
      detail: "Decks, covered structures, and major exterior work often require building permits.",
    });
  }

  // Factor-driven
  if (factors.has("electrical") || factors.has("electrical_changes")) {
    push({
      id: "electrical",
      label: "Electrical",
      likelihood: "commonly_required",
      detail: "New circuits, panel work, and substantial rewiring typically need electrical permits and inspections.",
    });
  }
  if (factors.has("plumbing") || factors.has("plumbing_changes")) {
    push({
      id: "plumbing",
      label: "Plumbing",
      likelihood: "commonly_required",
      detail: "Relocation of supply/drain lines and wet-area rough-ins commonly need plumbing permits.",
    });
  }
  if (factors.has("hvac") || factors.has("mechanical")) {
    push({
      id: "mechanical",
      label: "Mechanical / HVAC",
      likelihood: "often_required",
      detail: "Equipment change-outs and duct alterations often require mechanical permits.",
    });
  }
  if (factors.has("structural") || factors.has("wall_changes") || factors.has("layout")) {
    push({
      id: "building",
      label: "Building (structural / layout)",
      likelihood: "commonly_required",
      detail: "Load-bearing wall changes and major layout moves usually require building permits and possibly engineering.",
    });
  }
  if (factors.has("roofing")) {
    push({
      id: "roofing",
      label: "Roofing",
      likelihood: "commonly_required",
      detail: "Roof covering work is commonly permitted in Florida counties.",
    });
  }
  if (factors.has("windows") || factors.has("doors")) {
    push({
      id: "building",
      label: "Building (openings)",
      likelihood: "often_required",
      detail: "Impact window/door replacement is frequently permitted; product approvals may apply.",
    });
  }

  // Always include confirm-locally fallback
  if (categories.length === 0) {
    push({
      id: "confirm",
      label: "Confirm with local building department",
      likelihood: "confirm_locally",
      detail:
        "Scope is too general to list categories. Ask the AHJ which permits apply before work starts.",
    });
  } else {
    push({
      id: "confirm",
      label: "Local AHJ confirmation",
      likelihood: "confirm_locally",
      detail:
        "Category list is educational. Municipal vs county permitting, HOA rules, and flood/coastal overlays can change requirements.",
    });
  }

  const locationLabel = [city, county, zip, "FL"].filter(Boolean).join(", ") || "Florida";

  return {
    projectType: typeId,
    projectLabel: def.label,
    locationLabel,
    county,
    categories,
    contractorQuestions: [
      "Who pulls the permit — contractor or owner?",
      "Are permit fees included in the written bid?",
      "Which inspections are expected, and who schedules them?",
      "What happens to price and schedule if the AHJ requires additional work?",
      "Will you provide copies of issued permits and final approvals?",
    ],
    homeownerCautions: [
      "Unpermitted work can affect insurance claims, resale, and stop-work orders.",
      "Do not start regulated work before required approvals when the AHJ requires them.",
      "Cash discounts conditioned on skipping permits are a serious caution pattern.",
      "Occupied-home projects still need the same code and inspection compliance.",
      factors.has("occupied")
        ? "Home stays occupied — plan access, protection, and inspection windows with the contractor."
        : "Confirm site access for inspections even if the home is vacant.",
    ],
    officialNextStep: {
      label: cov?.buildingDeptNote || cov?.sourceLabel || "Local building department / permit portal",
      href: cov?.portalUrl || null,
      note: county
        ? `Start with the ${county} County (or municipal) building department. Local AHJ rules control.`
        : "Identify your city/county building department. Local AHJ rules control.",
    },
    disclaimer: DISCLAIMER,
  };
}

export const PLANNER_FACTORS: { id: string; label: string }[] = [
  { id: "electrical", label: "Electrical changes" },
  { id: "plumbing", label: "Plumbing changes" },
  { id: "structural", label: "Structural / wall changes" },
  { id: "hvac", label: "HVAC / mechanical" },
  { id: "roofing", label: "Roofing" },
  { id: "windows", label: "Window / door replacement" },
  { id: "occupied", label: "Home will stay occupied" },
];
