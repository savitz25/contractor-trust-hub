/** Phase 2 — Project planning context (plan → cost → match). */

export type ProjectTypeId =
  | "kitchen_remodel"
  | "bathroom_remodel"
  | "full_home_renovation"
  | "addition"
  | "basement_finish"
  | "roofing"
  | "siding_exterior"
  | "deck_outdoor"
  | "custom_home_rebuild"
  | "general_contracting";

export type ScaleBand = "small" | "medium" | "large";

export type BudgetBand =
  | "under_25k"
  | "25_75k"
  | "75_150k"
  | "150k_plus"
  | "not_sure";

export type ProjectTypeDef = {
  id: ProjectTypeId;
  label: string;
  shortLabel: string;
  description: string;
  /** DBPR occupation codes preferred for matching (order = preference). */
  occupationCodes: string[];
  /** How scale is described in the UI. */
  scaleMode: "rooms" | "sqft" | "scope";
  scaleLabels: Record<ScaleBand, string>;
  scaleHints: Record<ScaleBand, string>;
};

export type CostRangeRow = {
  projectType: ProjectTypeId;
  scale: ScaleBand;
  /** Installed conceptual ranges in USD. */
  low: number;
  mid: number;
  high: number;
  drivers: string[];
  unitNote?: string;
};

export type PlanInput = {
  projectType: ProjectTypeId;
  details?: string;
  state: string;
  zip?: string;
  city?: string;
  county?: string | null;
  scale: ScaleBand;
  /**
   * Budget comfort band id.
   * Plan defaults use BudgetBand; studios may use their own ids (e.g. under_10k, 50_100k).
   */
  budgetBand?: string | null;
};

export type CostBandHints = {
  low: string;
  mid: string;
  high: string;
};

export type CostRangeResult = {
  projectType: ProjectTypeId;
  projectLabel: string;
  scale: ScaleBand;
  scaleLabel: string;
  state: string;
  low: number;
  mid: number;
  high: number;
  /** Shared drivers that move cost overall */
  drivers: string[];
  /** Plain-language what typically sits at low / mid / high */
  bandHints: CostBandHints;
  unitNote: string;
  disclaimer: string;
  methodologyNote?: string;
};

/** Contractor card for plan results with honest match explanations. */
export type PlanMatchedContractor = import("@/lib/contractors/types").SearchResult & {
  matchReasons: string[];
  locationTier: "zip" | "city" | "county" | "state";
  /** Short chips for at-a-glance fit (license role, location tier, status). */
  matchChips?: string[];
  /** Preferred = primary occupation codes; related = secondary expansion. */
  matchFit?: "preferred" | "related";
};

export type PlanMatchResult = {
  contractors: PlanMatchedContractor[];
  matchNotes: string[];
  locationLabel: string;
  emptyReason?: string;
  /** How tightly results were scoped. */
  locationScope?: "local" | "regional" | "statewide" | "none";
  /** Count with ZIP/city/county tier (not statewide fallback). */
  localCount?: number;
  /** True when local specialty coverage is thin or empty. */
  thinResult?: boolean;
};

export type QuoteRequestPayload = {
  name: string;
  email: string;
  phone: string;
  projectType: ProjectTypeId;
  projectLabel: string;
  location: string;
  scale: ScaleBand;
  scaleLabel: string;
  /** Plan or studio-specific budget id. */
  budgetBand?: string | null;
  details?: string;
  costLow?: number;
  costMid?: number;
  costHigh?: number;
  contractorSlugs?: string[];
  notes?: string;
};

export const COST_DISCLAIMER =
  "Conceptual planning ranges only - not a formal bid or guarantee. Actual costs depend on site conditions, materials, labor, and scope.";
