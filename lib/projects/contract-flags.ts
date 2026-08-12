/** Contract Analyzer flag taxonomy — maintainable source of truth. */

export type ContractFlagDef = {
  id: string;
  category: "core" | "protection" | "florida";
  label: string;
  /** Keywords suggesting present */
  presentKeywords: string[];
  missingHint: string;
  unclearHint: string;
  question: string;
};

export const CONTRACT_FLAGS: ContractFlagDef[] = [
  // Core
  {
    id: "parties",
    category: "core",
    label: "Parties / legal business name",
    presentKeywords: ["hereinafter", "contractor:", "owner:", "between", "llc", "inc.", "party"],
    missingHint: "Contracting parties / legal business name not clearly identified.",
    unclearHint: "Party language is thin — confirm legal entity name matches license and COI.",
    question: "Is the contractor’s full legal business name on the contract the same as on the license and COI?",
  },
  {
    id: "license_number",
    category: "core",
    label: "License number on contract",
    presentKeywords: ["license no", "license number", "license #", "cgc", "cbc", "crc", "ccc", "license:"],
    missingHint: "License number not clearly stated on the contract text.",
    unclearHint: "License reference may be incomplete — confirm number and class.",
    question: "Please add the Florida license number and class that authorizes this work.",
  },
  {
    id: "scope",
    category: "core",
    label: "Scope of work reference",
    presentKeywords: ["scope of work", "work includes", "specifications", "exhibit a", "plans and specs"],
    missingHint: "Scope of work is not clearly referenced.",
    unclearHint: "Scope language is vague — attach written scope list.",
    question: "Can we attach a written scope list of inclusions and exclusions as an exhibit?",
  },
  {
    id: "total_price",
    category: "core",
    label: "Total price",
    presentKeywords: ["total contract price", "contract sum", "total price", "lump sum", "contract amount"],
    missingHint: "Total price not clearly stated.",
    unclearHint: "Price language may be incomplete or allowance-heavy.",
    question: "What is the total contract price, and which items are allowances?",
  },
  {
    id: "payment_schedule",
    category: "core",
    label: "Payment schedule",
    presentKeywords: ["payment schedule", "progress payment", "draw", "deposit", "retainage", "upon completion"],
    missingHint: "Payment schedule not clearly stated.",
    unclearHint: "Payment timing is partially stated — request a written schedule of values.",
    question: "Please provide a written payment schedule tied to milestones or inspections.",
  },
  {
    id: "timeline",
    category: "core",
    label: "Start / completion expectations",
    presentKeywords: ["commence", "completion date", "substantial completion", "start date", "time for completion", "calendar days"],
    missingHint: "Start/completion expectations not clearly stated.",
    unclearHint: "Timeline language is soft — confirm estimated dates and contingencies.",
    question: "What are the estimated start and substantial completion dates, and what delays are excluded?",
  },
  // Protection
  {
    id: "permits",
    category: "protection",
    label: "Permit responsibility",
    presentKeywords: ["permit", "permits", "building department", "inspections"],
    missingHint: "Permit responsibility not clearly stated.",
    unclearHint: "Permits mentioned vaguely — clarify who pulls and pays.",
    question: "Who is responsible for pulling permits and scheduling inspections?",
  },
  {
    id: "change_orders",
    category: "protection",
    label: "Change-order process",
    presentKeywords: ["change order", "change-order", "extra work", "additional work", "written approval"],
    missingHint: "Change-order process not clearly stated.",
    unclearHint: "Change process is incomplete — require written priced approvals.",
    question: "How are change orders documented, priced, and approved in writing?",
  },
  {
    id: "allowances",
    category: "protection",
    label: "Allowances and reconciliation",
    presentKeywords: ["allowance", "allowances", "selection", "reconcile", "overage"],
    missingHint: "Allowances / reconciliation not clearly addressed.",
    unclearHint: "Allowances may lack amounts — request a schedule.",
    question: "List every allowance with a dollar amount and how overages are billed.",
  },
  {
    id: "warranty",
    category: "protection",
    label: "Warranty terms",
    presentKeywords: ["warranty", "guarantee", "workmanship", "manufacturer warranty"],
    missingHint: "Warranty terms not clearly stated.",
    unclearHint: "Warranty language is thin — confirm period and coverage.",
    question: "What is the workmanship warranty period, and what manufacturer warranties apply?",
  },
  {
    id: "cleanup",
    category: "protection",
    label: "Cleanup / debris",
    presentKeywords: ["cleanup", "clean-up", "debris", "dumpster", "broom clean", "haul"],
    missingHint: "Cleanup / debris responsibility not clearly stated.",
    unclearHint: "Cleanup may be incomplete in scope language.",
    question: "Is debris haul-away and final cleanup included in the price?",
  },
  {
    id: "subs",
    category: "protection",
    label: "Subcontractor disclosure",
    presentKeywords: ["subcontractor", "sub-contractor", "subs", "assign"],
    missingHint: "Subcontractor use not clearly disclosed.",
    unclearHint: "Subcontractor language is limited.",
    question: "Which portions will be subcontracted, and under whose licenses?",
  },
  {
    id: "insurance",
    category: "protection",
    label: "Insurance references",
    presentKeywords: ["insurance", "certificate of insurance", "general liability", "workers compensation", "workers' compensation"],
    missingHint: "Insurance requirements not clearly referenced.",
    unclearHint: "Insurance language may not require COI delivery.",
    question: "Will you provide a current COI naming this project before work starts?",
  },
  {
    id: "dispute",
    category: "protection",
    label: "Dispute / termination language",
    presentKeywords: ["termination", "dispute", "arbitration", "mediation", "default", "breach"],
    missingHint: "Dispute / termination process not clearly stated.",
    unclearHint: "Dispute language is partial.",
    question: "How are disputes handled, and under what conditions can either party terminate?",
  },
  // Florida attention
  {
    id: "florida_notices",
    category: "florida",
    label: "Florida notices / consumer disclosures",
    presentKeywords: ["notice to owner", "construction lien", "florida statute", "chapter 713", "consumer"],
    missingHint: "Florida lien/consumer notice language not clearly present in the text reviewed.",
    unclearHint: "Some notice language appears incomplete — worth clarifying with qualified help if needed.",
    question: "Which Florida-required notices or disclosures are part of this agreement?",
  },
  {
    id: "deposit_timing",
    category: "florida",
    label: "Deposit / payment timing",
    presentKeywords: ["deposit", "down payment", "retainer", "initial payment"],
    missingHint: "Deposit amount/timing not clearly stated.",
    unclearHint: "Deposit terms may be aggressive or incomplete — clarify schedule.",
    question: "What deposit is due, when, and what work or materials does it cover?",
  },
  {
    id: "lien_waiver",
    category: "florida",
    label: "Lien-related documentation language",
    presentKeywords: ["lien waiver", "lien release", "waiver of lien", "partial release", "final release"],
    missingHint: "Lien waiver / release process not clearly stated.",
    unclearHint: "Lien documentation language is limited.",
    question: "Will partial and final lien waivers be provided with each payment draw?",
  },
];
