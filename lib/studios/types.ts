import type { BudgetBand, ProjectTypeId, ScaleBand } from "@/lib/plan/types";

/** Config-driven Project Studio definition. */

export type StudioFieldOption = {
  id: string;
  label: string;
  hint?: string;
};

export type StudioField =
  | {
      id: string;
      type: "single";
      label: string;
      required?: boolean;
      options: StudioFieldOption[];
    }
  | {
      id: string;
      type: "multi";
      label: string;
      required?: boolean;
      options: StudioFieldOption[];
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
};

export type StudioAnswers = {
  studioSlug: string;
  projectType: ProjectTypeId;
  /** fieldId → single option id or multi option ids */
  values: Record<string, string | string[]>;
  budgetBand?: BudgetBand | null;
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
  budgetBand?: BudgetBand | null;
  location: {
    state: string;
    zip?: string;
    city?: string;
    county?: string | null;
  };
};
