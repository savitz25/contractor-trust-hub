import type { ChecklistModule } from "./types";

/** Source of truth for Pre-Hire Checklist content. */

export const PRE_HIRE_CHECKLIST: ChecklistModule[] = [
  {
    id: "identity",
    title: "1. Verify identity & license",
    items: [
      {
        id: "active_license",
        title: "Confirm active/current license status on the Trust Report",
        why: "Inactive or expired licenses are a hard stop for most homeowners until resolved.",
        hrefs: [{ href: "/verify", label: "Verify a license" }],
      },
      {
        id: "correct_class",
        title: "Confirm license class fits the work (e.g. CCC/RR for roofing)",
        why: "A valid license of the wrong class may not authorize the work you need.",
        hrefs: [{ href: "/methodology", label: "How we map classes" }],
      },
      {
        id: "entity",
        title: "Review linked business entity (Sunbiz) when present",
        why: "Contracts and payments should typically match the licensed business entity.",
      },
    ],
  },
  {
    id: "discipline",
    title: "2. Review discipline / caution signals",
    items: [
      {
        id: "discipline_rows",
        title: "Read any board discipline entries on the Trust Report",
        why: "Discipline is evidence, not a score — understand what happened and when.",
      },
      {
        id: "thin_data",
        title: "Note thin data or unmatched entity fields",
        why: "Missing links are not proof of fraud, but they mean you should ask more questions.",
      },
    ],
  },
  {
    id: "insurance",
    title: "3. Request insurance evidence",
    items: [
      {
        id: "gli",
        title: "Request a current general liability certificate of insurance (COI)",
        why: "A COI is a starting point — verify coverage dates and limits for your project.",
      },
      {
        id: "wc",
        title: "Understand workers’ comp status or exemption claims",
        why: "Exemptions exist in Florida; still clarify who is on site and how injuries are covered.",
      },
      {
        id: "carrier",
        title: "Verify certificate details with the carrier when possible",
        why: "Altered certificates are rare but costly — confirmation reduces risk.",
      },
    ],
  },
  {
    id: "scope",
    title: "4. Confirm written scope matches your Scope Builder output",
    items: [
      {
        id: "same_scope",
        title: "Every bid prices the same included / excluded list",
        why: "Price gaps often come from silent exclusions, not craftsmanship.",
        hrefs: [{ href: "/tools/scope-builder", label: "Open Scope Builder" }],
      },
      {
        id: "allowances",
        title: "Allowances list dollar amounts and what is out of scope",
        why: "TBD allowances make low bids look cheaper than they are.",
      },
    ],
  },
  {
    id: "multiple_bids",
    title: "5. Get multiple written bids",
    items: [
      {
        id: "two_to_four",
        title: "Collect 2–4 written estimates on the same scope",
        why: "One bid has no baseline; apples-to-apples comparison needs a few proposals.",
        hrefs: [{ href: "/tools/compare-bids", label: "Compare bids" }],
      },
    ],
  },
  {
    id: "payments",
    title: "6. Clarify deposit and payment schedule",
    items: [
      {
        id: "deposit",
        title: "Deposit amount, timing, and refundability are written down",
        why: "Large deposits before permits/materials are a common caution pattern.",
        hrefs: [{ href: "/tools/quote-analyzer", label: "Analyze a quote" }],
      },
      {
        id: "draws",
        title: "Progress payments match completed work / inspections",
        why: "Paying far ahead of completed stages increases loss risk if work stalls.",
      },
    ],
  },
  {
    id: "permits",
    title: "7. Confirm permit responsibility",
    items: [
      {
        id: "who_pulls",
        title: "Who pulls permits and schedules inspections is explicit",
        why: "Ambiguity here causes delays and compliance gaps.",
      },
    ],
  },
  {
    id: "change_orders",
    title: "8. Confirm change-order process",
    items: [
      {
        id: "co_writing",
        title: "Changes require written approval with price and schedule impact",
        why: "Verbal extras are a frequent source of disputes.",
      },
    ],
  },
  {
    id: "warranty",
    title: "9. Confirm warranty terms",
    items: [
      {
        id: "warranty_terms",
        title: "Workmanship and manufacturer warranties are in writing",
        why: "Know what is covered, for how long, and who responds to callbacks.",
      },
    ],
  },
  {
    id: "red_flags",
    title: "10. Avoid common red-flag patterns",
    items: [
      {
        id: "pressure",
        title: "No pressure to sign immediately or “today only” pricing without review time",
        why: "Rush tactics reduce your ability to verify license, insurance, and scope.",
      },
      {
        id: "no_license",
        title: "Contractor will provide a license number and allow verification",
        why: "Refusal to share a license number is a serious caution pattern.",
      },
      {
        id: "written_contract",
        title: "There will be a written contract — not cash-only handshake terms",
        why: "Written terms protect both parties when something changes.",
      },
      {
        id: "pay_entity",
        title: "Payments go to the business entity — not personal name only (when applicable)",
        why: "Entity mismatch can complicate recourse and insurance claims.",
      },
      {
        id: "no_permit_deal",
        title: "No “cash discount if we skip the permit” offers",
        why: "Unpermitted work can affect insurance, resale, and safety.",
      },
    ],
  },
];

export const RED_FLAG_GUIDE: Array<{ title: string; detail: string }> = [
  {
    title: "Large deposit before permits or materials",
    detail:
      "Ask for a schedule of values and what the deposit covers. Large prepaid sums increase loss risk.",
  },
  {
    title: "Pressure to sign immediately",
    detail:
      "Legitimate contractors generally allow time to verify license, insurance, and compare written scope.",
  },
  {
    title: "Refusal to provide a license number",
    detail: "You should be able to verify status independently on official sources or Trust Hub.",
  },
  {
    title: "No written contract",
    detail: "Handshake deals leave scope, payment, and warranty undefined when problems arise.",
  },
  {
    title: "Payment to personal name only",
    detail:
      "Prefer payment to the licensed business entity named on the proposal and COI when possible.",
  },
  {
    title: "“Cash discount if no permit”",
    detail:
      "Skipping required permits can create code, insurance, and resale problems. Treat as a strong caution pattern.",
  },
];
