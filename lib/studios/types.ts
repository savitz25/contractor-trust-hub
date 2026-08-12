import type { BudgetBand, ProjectTypeId, ScaleBand } from "@/lib/plan/types";

/** Config-driven Project Studio definition. */

export type StudioFieldOption = {
  id: string;
  label: string;
  hint?: string;
  /** Visually emphasize primary homeowner path (e.g. full roof replacement). */
  featured?: boolean;
};

/** Show field only when another answer matches one of these values. */
export type StudioFieldShowWhen = {
  fieldId: string;
  values: string[];
};

export type StudioField =
  | {
      id: string;
      type: "single";
      label: string;
      required?: boolean;
      options: StudioFieldOption[];
      showWhen?: StudioFieldShowWhen;
    }
  | {
      id: string;
      type: "multi";
      label: string;
      required?: boolean;
      options: StudioFieldOption[];
      showWhen?: StudioFieldShowWhen;
    };

/** Optional studio-specific budget chips (defaults to plan BUDGET_BANDS). */
export type StudioBudgetOption = {
  id: string;
  label: string;
};

export type StudioStep = {
  id: string;
  title: string;
  body?: string;
  fields: StudioField[];
};

export type StudioDefinition = {
  slug: string;
  projectType: ProjectTypeId;
  /**
   * Additional plan project types that deep-link here from /plan
   * (e.g. exterior covers deck_outdoor + siding_exterior).
   */
  relatedProjectTypes?: ProjectTypeId[];
  name: string;
  shortName: string;
  headline: string;
  positioning: string;
  /** Primary DBPR codes for matching. */
  primaryOccupationCodes: string[];
  /** Used only when primary local coverage is thin. */
  secondaryOccupationCodes: string[];
  /** Strict: do not over-broaden (e.g. roofing). */
  strictMatching?: boolean;
  steps: StudioStep[];
  /** Base cost drivers shown; refined by answers. */
  baseCostDrivers: string[];
  resultFraming: string;
  /** Map field answer ids → cost driver lines when selected. */
  driverByAnswer: Record<string, string>;
  /** How answers map to plan scale band for cost lookup. */
  resolveScale: (answers: StudioAnswers) => ScaleBand;
  /** Optional unit note override from answers. */
  resolveUnitNote?: (answers: StudioAnswers) => string;
  /** Override cost/matching project type from answers (exterior → siding vs deck). */
  resolveProjectType?: (answers: StudioAnswers) => ProjectTypeId;
  /** Studio-specific budget bands (e.g. roofing dollar ranges). */
  budgetOptions?: StudioBudgetOption[];
};

export type StudioAnswers = {
  studioSlug: string;
  projectType: ProjectTypeId;
  /** fieldId → single option id or multi option ids */
  values: Record<string, string | string[]>;
  /** Plan BudgetBand id or studio-specific budget id (e.g. under_10k). */
  budgetBand?: BudgetBand | string | null;
  zip?: string;
  city?: string;
  state?: string;
  details?: string;
};

export type StudioContext = {
  studioSlug: string;
  studioName: string;
  projectType: ProjectTypeId;
  projectLabel: string;
  answers: StudioAnswers;
  answerSummary: string[];
  scale: ScaleBand;
  scaleLabel: string;
  budgetBand?: BudgetBand | string | null;
  location: {
    state: string;
    zip?: string;
    city?: string;
    county?: string | null;
  };
};
