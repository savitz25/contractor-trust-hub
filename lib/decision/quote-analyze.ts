import { getCostRange } from "@/lib/plan/cost-model";
import type { ProjectTypeId, ScaleBand } from "@/lib/plan/types";
import { parseQuoteText } from "./quote-parse";
import { scopeTemplateFor } from "./scope-templates";
import type {
  QuoteAnalysis,
  QuoteLineStatus,
  QuotePriceContext,
  QuoteRedFlag,
} from "./types";
import { generateQuestionsFromAnalysis } from "./questions";

export type AnalyzeQuoteInput = {
  rawText: string;
  projectType: ProjectTypeId;
  scale?: ScaleBand;
  state?: string;
  zip?: string;
  city?: string;
  contractorName?: string;
  contractorSlug?: string;
  /** Manual overrides after parse */
  totalPrice?: number | null;
  depositAmount?: number | null;
  depositPercent?: number | null;
  paymentTerms?: string;
  timelineLanguage?: string;
  warrantyLanguage?: string;
  permitLanguage?: string;
};

function uid(): string {
  return `qa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function priceContext(
  total: number | null,
  projectType: ProjectTypeId,
  scale: ScaleBand,
  state: string
): QuotePriceContext {
  const range = getCostRange(projectType, scale, state);
  if (total == null) {
    return {
      total: null,
      planningLow: range.low,
      planningMid: range.mid,
      planningHigh: range.high,
      position: "unknown",
      note: "No total price available yet. Conceptual Florida planning range shown for context only — not a bid validation.",
    };
  }
  let position: QuotePriceContext["position"] = "within";
  if (total < range.low * 0.9) position = "below";
  else if (total > range.high * 1.1) position = "above";
  const note =
    position === "below"
      ? "Quoted total is below the conceptual planning low band. That can be valid (lighter scope) or a sign of missing items — compare written scope carefully."
      : position === "above"
        ? "Quoted total is above the conceptual planning high band. Higher finish, complex site, or broader scope can explain this — confirm what is included."
        : "Quoted total sits near the conceptual planning range for this project type and scale. Range is educational only — not an appraisal.";
  return {
    total,
    planningLow: range.low,
    planningMid: range.mid,
    planningHigh: range.high,
    position,
    note,
  };
}

function analyzeScopeItems(
  raw: string,
  projectType: ProjectTypeId
): QuoteLineStatus[] {
  const lower = raw.toLowerCase();
  const template = scopeTemplateFor(projectType);
  return template.map((t) => {
    const hit = t.keywords.some((k) => lower.includes(k.toLowerCase()));
    const excluded =
      hit &&
      (lower.includes(`not include ${t.keywords[0]}`) ||
        lower.includes(`exclude ${t.keywords[0]}`) ||
        lower.includes(`${t.keywords[0]} not included`) ||
        (lower.includes("owner furnish") &&
          t.keywords.some((k) => lower.includes(k))));
    const allowance =
      hit &&
      (lower.includes("allowance") || lower.includes("allowances")) &&
      t.keywords.some((k) => {
        const idx = lower.indexOf(k);
        if (idx < 0) return false;
        const window = lower.slice(Math.max(0, idx - 40), idx + 60);
        return (
          window.includes("allowance") ||
          window.includes("tbd") ||
          window.includes("as needed")
        );
      });

    if (excluded) {
      return {
        id: t.id,
        label: t.label,
        status: "excluded",
        evidence: "Language near this item suggests exclusion or owner-furnished",
      };
    }
    if (allowance) {
      return {
        id: t.id,
        label: t.label,
        status: "allowance",
        evidence: "Appears near allowance / TBD language",
      };
    }
    if (hit) {
      return {
        id: t.id,
        label: t.label,
        status: "included",
        evidence: "Keywords found in estimate text",
      };
    }
    return {
      id: t.id,
      label: t.label,
      status: lower.trim() ? "missing" : "unclear",
      evidence: lower.trim()
        ? "Not clearly stated in the provided text"
        : "No text to evaluate — mark manually",
    };
  });
}

function buildRedFlags(input: {
  raw: string;
  total: number | null;
  depositAmount: number | null;
  depositPercent: number | null;
  paymentTerms?: string;
  timelineLanguage?: string;
  warrantyLanguage?: string;
  permitLanguage?: string;
  scopeItems: QuoteLineStatus[];
}): QuoteRedFlag[] {
  const flags: QuoteRedFlag[] = [];
  const lower = input.raw.toLowerCase();

  if (
    (input.depositPercent != null && input.depositPercent >= 40) ||
    (input.total && input.depositAmount && input.depositAmount / input.total >= 0.4)
  ) {
    flags.push({
      id: "large_deposit",
      title: "Large upfront deposit relative to total",
      detail:
        "Deposit appears at or above ~40% of total. Worth confirming schedule of values, when materials are ordered, and what is refundable.",
      severity: "high",
    });
  } else if (
    (input.depositPercent != null && input.depositPercent >= 25) ||
    (input.total && input.depositAmount && input.depositAmount / input.total >= 0.25)
  ) {
    flags.push({
      id: "notable_deposit",
      title: "Notable deposit share",
      detail:
        "Deposit is a significant share of the total. Clarify milestones before additional draws.",
      severity: "caution",
    });
  }

  if (/as needed|tbd|to be determined|allowance\s*\$?\s*tbd/i.test(input.raw)) {
    flags.push({
      id: "vague_allowances",
      title: "Vague allowances or TBD language",
      detail:
        "“As needed” / TBD wording can hide price risk. Ask for dollar allowances and what is excluded from each.",
      severity: "caution",
    });
  }

  if (!input.permitLanguage && !/permit/i.test(input.raw)) {
    flags.push({
      id: "permits_unclear",
      title: "Permit responsibility not clearly stated",
      detail:
        "Who pulls permits and attends inspections is a common gap. Confirm in writing before signing.",
      severity: "caution",
    });
  }

  if (!input.timelineLanguage && !/week|schedule|duration|start date/i.test(input.raw)) {
    flags.push({
      id: "timeline_unclear",
      title: "Timeline language not clearly stated",
      detail: "Ask for estimated start, duration, and weather or lead-time contingencies.",
      severity: "info",
    });
  }

  if (!input.warrantyLanguage && !/warranty|guarantee/i.test(input.raw)) {
    flags.push({
      id: "warranty_unclear",
      title: "Warranty terms not clearly stated",
      detail: "Confirm workmanship and manufacturer warranties in the written agreement.",
      severity: "info",
    });
  }

  if (/cash\s*only|cash\s*discount|pay\s*cash/i.test(input.raw)) {
    flags.push({
      id: "cash_signals",
      title: "Cash-only or cash-discount language",
      detail:
        "Payment method preferences are not automatically improper, but cash-only plus no written contract is a caution pattern. Prefer traceable payments to the business entity.",
      severity: "high",
    });
  }

  if (/no permit|without a permit|skip permit/i.test(input.raw)) {
    flags.push({
      id: "no_permit_pressure",
      title: "Language suggesting work without permits",
      detail:
        "Skipping required permits is a serious risk for safety, insurance, and resale. Confirm code compliance expectations in writing.",
      severity: "high",
    });
  }

  const missingCount = input.scopeItems.filter((s) => s.status === "missing").length;
  if (missingCount >= 5) {
    flags.push({
      id: "scope_thin",
      title: "Scope too thin to compare fairly",
      detail:
        "Many typical line items are not clearly stated. Build a written scope and ask every bidder to price the same list.",
      severity: "caution",
    });
  }

  if (input.scopeItems.filter((s) => s.status === "allowance").length >= 2) {
    flags.push({
      id: "many_allowances",
      title: "Multiple allowance-style items",
      detail:
        "Allowances can make a bid look lower until selections are finalized. Compare allowance amounts across bids.",
      severity: "caution",
    });
  }

  if (lower.length < 80 && input.total) {
    flags.push({
      id: "too_vague",
      title: "Estimate text is very short",
      detail:
        "A total without itemization is hard to compare. Request a line-item proposal matched to your scope.",
      severity: "caution",
    });
  }

  return flags;
}

export function analyzeQuote(input: AnalyzeQuoteInput): QuoteAnalysis {
  const parsed = parseQuoteText(input.rawText || "");
  const scale = input.scale || "medium";
  const state = (input.state || "FL").toUpperCase();

  const totalPrice =
    input.totalPrice !== undefined ? input.totalPrice : parsed.totalPrice;
  const depositAmount =
    input.depositAmount !== undefined ? input.depositAmount : parsed.depositAmount;
  let depositPercent =
    input.depositPercent !== undefined ? input.depositPercent : parsed.depositPercent;
  if (depositPercent == null && depositAmount != null && totalPrice) {
    depositPercent = Math.round((depositAmount / totalPrice) * 1000) / 10;
  }

  const paymentTerms = input.paymentTerms ?? parsed.paymentTerms;
  const timelineLanguage = input.timelineLanguage ?? parsed.timelineLanguage;
  const warrantyLanguage = input.warrantyLanguage ?? parsed.warrantyLanguage;
  const permitLanguage = input.permitLanguage ?? parsed.permitLanguage;

  const scopeItems = analyzeScopeItems(input.rawText || "", input.projectType);
  const redFlags = buildRedFlags({
    raw: input.rawText || "",
    total: totalPrice,
    depositAmount,
    depositPercent,
    paymentTerms,
    timelineLanguage,
    warrantyLanguage,
    permitLanguage,
    scopeItems,
  });

  const priceCtx = priceContext(totalPrice, input.projectType, scale, state);

  const draft: QuoteAnalysis = {
    id: uid(),
    contractorName: input.contractorName || parsed.contractorName,
    contractorSlug: input.contractorSlug,
    projectType: input.projectType,
    scale,
    zip: input.zip,
    city: input.city,
    state,
    totalPrice,
    depositAmount,
    depositPercent,
    paymentTerms,
    timelineLanguage,
    warrantyLanguage,
    permitLanguage,
    rawText: input.rawText || "",
    parseConfidence: parsed.confidence,
    parseNotes: parsed.notes,
    priceContext: priceCtx,
    scopeItems,
    redFlags,
    questions: [],
    generatedAt: new Date().toISOString(),
  };

  draft.questions = generateQuestionsFromAnalysis(draft);
  return draft;
}
