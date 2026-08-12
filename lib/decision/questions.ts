import { getProjectType } from "@/lib/plan/project-types";
import type { ProjectTypeId, ScaleBand } from "@/lib/plan/types";
import type {
  BidComparison,
  ProjectScope,
  QuestionGroup,
  QuoteAnalysis,
} from "./types";

export type QuestionContext = {
  projectType?: ProjectTypeId;
  scale?: ScaleBand;
  studioSlug?: string;
  scope?: ProjectScope | null;
  analysis?: QuoteAnalysis | null;
  comparison?: BidComparison | null;
  trustSignals?: {
    hasDiscipline?: boolean;
    secondaryMatch?: boolean;
    thinData?: boolean;
    contractorName?: string;
  };
};

/** Context-aware questions — not generic boilerplate when signals exist. */
export function generateQuestionGroups(ctx: QuestionContext): QuestionGroup[] {
  const def = ctx.projectType ? getProjectType(ctx.projectType) : null;
  const groups: QuestionGroup[] = [];

  const scopeQs: string[] = [
    "Please confirm in writing what is included and excluded from this price.",
    "Which items are allowances, and what exact dollar amount is each allowance?",
    "Who supplies materials — contractor, owner, or split by category?",
  ];
  if (ctx.scope?.unknowns?.length) {
    for (const u of ctx.scope.unknowns.slice(0, 5)) {
      scopeQs.push(`Is “${u.label}” included, excluded, or an allowance in your bid?`);
    }
  }
  if (ctx.analysis?.scopeItems) {
    for (const item of ctx.analysis.scopeItems.filter((s) => s.status === "missing").slice(0, 4)) {
      scopeQs.push(`Your estimate does not clearly state “${item.label}” — is it included?`);
    }
    for (const item of ctx.analysis.scopeItems.filter((s) => s.status === "allowance").slice(0, 3)) {
      scopeQs.push(`What is the dollar amount and selection process for the “${item.label}” allowance?`);
    }
  }
  if (def) {
    scopeQs.push(
      `For this ${def.label.toLowerCase()}, what site conditions would change the price after work starts?`
    );
  }
  groups.push({
    id: "scope",
    title: "Scope & materials",
    questions: unique(scopeQs),
  });

  const payQs = [
    "What is the deposit amount, when is it due, and is any portion refundable?",
    "What is the full payment schedule tied to milestones or inspections?",
    "What payment methods do you accept, and to which legal name should checks be written?",
  ];
  if (
    ctx.analysis?.depositPercent != null &&
    ctx.analysis.depositPercent >= 25
  ) {
    payQs.unshift(
      `Your deposit appears to be about ${ctx.analysis.depositPercent}% — what work or materials does that cover before the next draw?`
    );
  }
  groups.push({ id: "schedule_pay", title: "Schedule & payments", questions: unique(payQs) });

  groups.push({
    id: "permits",
    title: "Permits & inspections",
    questions: unique([
      "Who is responsible for pulling required permits?",
      "Who schedules inspections, and what happens if an inspection fails?",
      ctx.analysis && !ctx.analysis.permitLanguage
        ? "Permit responsibility is not clearly stated on the estimate — please confirm in writing."
        : "Are any portions of this project intended as owner-pulled permits?",
    ]),
  });

  const insuranceQs = [
    "Can you provide a current certificate of insurance for general liability naming this project address?",
    "What is your workers’ compensation status, and who will be on site?",
    "Is the contracting party the same legal entity named on the license and insurance?",
  ];
  if (ctx.trustSignals?.hasDiscipline) {
    insuranceQs.push(
      "Your Trust Report shows board discipline history — can you explain the context and what has changed since?"
    );
  }
  if (ctx.trustSignals?.thinData) {
    insuranceQs.push(
      "Some business-entity fields are thin or unmatched on file — can you provide Sunbiz / FEIN details for the contracting entity?"
    );
  }
  if (ctx.trustSignals?.secondaryMatch) {
    insuranceQs.push(
      "The license class on file may be a secondary fit for parts of this scope — which portions will you self-perform vs. subcontract, and under which licenses?"
    );
  }
  groups.push({
    id: "insurance",
    title: "Insurance & business entity",
    questions: unique(insuranceQs),
  });

  groups.push({
    id: "co_warranty",
    title: "Change orders & warranty",
    questions: unique([
      "How are change orders priced and approved in writing?",
      "What is the workmanship warranty period, and what does it cover?",
      "Which manufacturer warranties apply, and who handles claims?",
    ]),
  });

  const riskQs: string[] = [];
  if (ctx.projectType === "roofing") {
    riskQs.push(
      "How do you handle hidden decking damage discovered after tear-off?",
      "What wind-mitigation or HOA documentation will you provide?"
    );
  }
  if (ctx.projectType === "kitchen_remodel" || ctx.projectType === "bathroom_remodel") {
    riskQs.push(
      "If moisture damage is found behind walls or under the pan, how is that priced?",
      "Will the home remain occupied, and how do you phase protection and cleanup?"
    );
  }
  if (ctx.projectType === "bathroom_remodel") {
    riskQs.push("What waterproofing system do you use, and is it in the written scope?");
  }
  if (ctx.comparison?.differences?.length) {
    riskQs.push(
      "Other bids treat some line items differently — can you restate your inclusions so we can compare fairly?"
    );
  }
  if (ctx.studioSlug === "kitchen" || ctx.studioSlug === "bathroom") {
    riskQs.push("Are layout or plumbing relocations included, or priced only if discovered needed?");
  }
  if (riskQs.length === 0) {
    riskQs.push(
      "What are the top three risks that typically change price or schedule on projects like mine?",
      "What do you need from me before you can lock a start date?"
    );
  }
  groups.push({
    id: "risks",
    title: "Project-specific risks",
    questions: unique(riskQs),
  });

  return groups;
}

export function generateQuestionsFromAnalysis(analysis: QuoteAnalysis): string[] {
  const groups = generateQuestionGroups({
    projectType: analysis.projectType,
    scale: analysis.scale,
    analysis,
  });
  return groups.flatMap((g) => g.questions).slice(0, 12);
}

export function generateQuestionsFromComparison(comparison: BidComparison): string[] {
  const groups = generateQuestionGroups({
    projectType: comparison.projectType,
    scale: comparison.scale,
    comparison,
  });
  const shared = [
    "Please restate inclusions and exclusions on a single scope list so bids are comparable.",
    "List every allowance with a dollar amount.",
    "Confirm permit responsibility and inspection attendance in writing.",
  ];
  return unique([...shared, ...groups.flatMap((g) => g.questions)]).slice(0, 14);
}

export function flattenQuestions(groups: QuestionGroup[]): string[] {
  return groups.flatMap((g) => g.questions);
}

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const i of items) {
    const k = i.trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}
