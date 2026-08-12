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
  budgetBand?: BudgetBand | null;
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
  drivers: string[];
  unitNote: string;
  disclaimer: string;
};

export type PlanMatchResult = {
  contractors: import("@/lib/contractors/types").SearchResult[];
  matchNotes: string[];
  locationLabel: string;
  emptyReason?: string;
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
  budgetBand?: BudgetBand | null;
  details?: string;
  costLow?: number;
  costMid?: number;
  costHigh?: number;
  contractorSlugs?: string[];
  notes?: string;
};

export const COST_DISCLAIMER =
  "Conceptual planning ranges only — not a formal bid or guarantee. Actual costs depend on site conditions, materials, labor, and scope.";
