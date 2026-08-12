/** Payment / waiver checklist source of truth (educational). */

export const PAYMENT_DOC_CHECKS = [
  {
    id: "invoice",
    label: "Invoice / draw request",
    why: "Creates a clear record of what the payment is for.",
  },
  {
    id: "lien_waiver",
    label: "Lien waiver / release documentation",
    why: "Helps document that the payee is not asserting lien rights for the amounts covered — still not legal advice.",
  },
  {
    id: "change_order",
    label: "Change-order reference (if applicable)",
    why: "Ties extra work to a written approval and price.",
  },
] as const;

export const FLORIDA_LIEN_EDUCATION = [
  {
    title: "Notice to Owner awareness",
    body: "On many Florida construction projects, suppliers and subcontractors may send formal notices. Understanding who is on the job and who is being paid reduces surprise claims. This is educational context only.",
  },
  {
    title: "Why waivers matter",
    body: "Requesting partial or final lien waivers with payments is a common homeowner documentation practice. Validity and form requirements depend on facts and statutes — confirm with qualified professionals when needed.",
  },
  {
    title: "Progress vs final payment caution",
    body: "Final payment is often when documentation gaps surface. Avoid large final payments without clear completion, inspection, and release documentation that matches your agreement.",
  },
  {
    title: "Not legal advice",
    body: "This tracker does not determine lien rights, notice deadlines, or payment obligations. Official records and qualified counsel control when stakes are high.",
  },
] as const;
