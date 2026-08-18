/** Ask Trust Hub network destinations for chrome (bar + Switch Hub). */

export const ASK_TRUST_HUB = {
  name: "Ask Trust Hub",
  url: "https://www.asktrusthub.com",
  methodologyUrl: "https://www.asktrusthub.com/methodology",
  standardsUrl: "https://www.asktrusthub.com/methodology",
} as const;

/** Specialist hubs shown in the top network bar (current hub highlighted). */
export const NETWORK_BAR_HUBS = [
  {
    id: "move" as const,
    shortLabel: "Move",
    proseName: "Move Trust Hub",
    href: "https://www.movetrusthub.com",
  },
  {
    id: "insurance" as const,
    shortLabel: "Insurance",
    proseName: "Insurance Trust Hub",
    href: "https://www.insurancetrusthub.com",
  },
  {
    id: "lender" as const,
    shortLabel: "Lending",
    proseName: "Lender Trust Hub",
    href: "https://www.lendertrusthub.com",
  },
  {
    id: "contractor" as const,
    shortLabel: "Contractor",
    proseName: "Contractor Trust Hub",
    href: "https://www.contractortrusthub.com",
  },
  {
    id: "senior" as const,
    shortLabel: "Senior",
    proseName: "SeniorTrustHub",
    href: "https://www.seniortrusthub.com",
  },
  {
    id: "investor" as const,
    shortLabel: "Investor",
    proseName: "InvestorTrustHub",
    href: "https://www.investortrusthub.com",
  },
] as const;

export type NetworkBarHubId = (typeof NETWORK_BAR_HUBS)[number]["id"];

export const CURRENT_HUB_ID: NetworkBarHubId = "contractor";

/**
 * Switch Hub dropdown — full network including Ask + all specialists.
 * Contractor is listed as current.
 */
export const SWITCH_HUB_LINKS = [
  {
    id: "ask" as const,
    label: "Ask Trust Hub",
    shortLabel: "Ask",
    href: "https://www.asktrusthub.com",
    blurb: "Parent research & standards layer",
    current: false,
  },
  {
    id: "move" as const,
    label: "Move Trust Hub",
    shortLabel: "Move",
    href: "https://www.movetrusthub.com",
    blurb: "FMCSA movers & local guides",
    current: false,
  },
  {
    id: "lender" as const,
    label: "Lender Trust Hub",
    shortLabel: "Lender",
    href: "https://www.lendertrusthub.com",
    blurb: "NMLS lenders & financing tools",
    current: false,
  },
  {
    id: "insurance" as const,
    label: "Insurance Trust Hub",
    shortLabel: "Insurance",
    href: "https://www.insurancetrusthub.com",
    blurb: "Licensed agencies & coverage research",
    current: false,
  },
  {
    id: "contractor" as const,
    label: "Contractor Trust Hub",
    shortLabel: "Contractor",
    href: "https://www.contractortrusthub.com",
    blurb: "State licensing-board contractor research",
    current: true,
  },
  {
    id: "senior" as const,
    label: "SeniorTrustHub",
    shortLabel: "Senior",
    href: "https://www.seniortrusthub.com",
    blurb: "CMS / supported state senior-care research",
    current: false,
  },
  {
    id: "investor" as const,
    label: "InvestorTrustHub",
    shortLabel: "Investor",
    href: "https://www.investortrusthub.com",
    blurb: "SEC / IARD investment-firm research",
    current: false,
  },
] as const;

/** Footer / reciprocal list (siblings + parent, not self). */
export const CONTRACTOR_NETWORK_LINKS = SWITCH_HUB_LINKS.filter((h) => !h.current);
