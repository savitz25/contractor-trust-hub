import type { ProjectTypeId, ScaleBand } from "@/lib/plan/types";

/** Stage 1 Decision Engine shared types. */

export type ScopeItemStatus = "included" | "excluded" | "unknown" | "assumption";

export type ScopeLineItem = {
  id: string;
  label: string;
  status: ScopeItemStatus;
  note?: string;
};

export type ProjectScope = {
  id: string;
  title: string;
  projectType: ProjectTypeId;
  projectLabel: string;
  locationLabel: string;
  state: string;
  zip?: string;
  city?: string;
  scale: ScaleBand;
  scaleLabel: string;
  included: ScopeLineItem[];
  excluded: ScopeLineItem[];
  unknowns: ScopeLineItem[];
  assumptions: string[];
  bidderNotes: string;
  sourceNotes: string[];
  generatedAt: string;
  studioSlug?: string;
  budgetBand?: string | null;
  details?: string;
};

export type QuoteItemStatus =
  | "included"
  | "excluded"
  | "allowance"
  | "unclear"
  | "missing";

export type QuoteLineStatus = {
  id: string;
  label: string;
  status: QuoteItemStatus;
  evidence?: string;
};

export type QuoteRedFlag = {
  id: string;
  title: string;
  detail: string;
  severity: "info" | "caution" | "high";
};

export type QuotePriceContext = {
  total: number | null;
  planningLow: number | null;
  planningMid: number | null;
  planningHigh: number | null;
  position: "below" | "within" | "above" | "unknown";
  note: string;
};

export type QuoteAnalysis = {
  id: string;
  contractorName?: string;
  contractorSlug?: string;
  projectType: ProjectTypeId;
  scale: ScaleBand;
  zip?: string;
  city?: string;
  state: string;
  totalPrice: number | null;
  depositAmount: number | null;
  depositPercent: number | null;
  paymentTerms?: string;
  timelineLanguage?: string;
  warrantyLanguage?: string;
  permitLanguage?: string;
  rawText: string;
  parseConfidence: "low" | "medium" | "high";
  parseNotes: string[];
  priceContext: QuotePriceContext;
  scopeItems: QuoteLineStatus[];
  redFlags: QuoteRedFlag[];
  questions: string[];
  generatedAt: string;
};

export type BidSlot = {
  id: string;
  label: string;
  contractorName?: string;
  contractorSlug?: string;
  totalPrice: number | null;
  depositTerms?: string;
  timelineLanguage?: string;
  warrantyLanguage?: string;
  permitLanguage?: string;
  items: QuoteLineStatus[];
  rawNotes?: string;
};

export type CompareDiff = {
  id: string;
  title: string;
  detail: string;
};

export type BidComparison = {
  id: string;
  projectType: ProjectTypeId;
  scale: ScaleBand;
  locationLabel: string;
  bids: BidSlot[];
  matrixRows: Array<{
    id: string;
    label: string;
    cells: Array<{ status: QuoteItemStatus; note?: string }>;
  }>;
  differences: CompareDiff[];
  sharedQuestions: string[];
  generatedAt: string;
};

export type ChecklistItem = {
  id: string;
  title: string;
  why: string;
  hrefs?: Array<{ href: string; label: string }>;
};

export type ChecklistModule = {
  id: string;
  title: string;
  items: ChecklistItem[];
};

export type QuestionGroup = {
  id: string;
  title: string;
  questions: string[];
};
