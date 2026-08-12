/** Ask Trust Hub network destinations (sibling hubs + parent). */

export const CONTRACTOR_NETWORK_LINKS = [
  {
    id: "ask" as const,
    label: "Ask Trust Hub",
    shortLabel: "Ask",
    href: "https://www.asktrusthub.com",
    blurb: "Parent knowledge & concierge layer",
  },
  {
    id: "move" as const,
    label: "Move Trust Hub",
    shortLabel: "Move",
    href: "https://www.movetrusthub.com",
    blurb: "FMCSA movers & local guides",
  },
  {
    id: "lender" as const,
    label: "Lender Trust Hub",
    shortLabel: "Lender",
    href: "https://www.lendertrusthub.com",
    blurb: "NMLS lenders & financing tools",
  },
  {
    id: "insurance" as const,
    label: "Insurance Trust Hub",
    shortLabel: "Insurance",
    href: "https://www.insurancetrusthub.com",
    blurb: "Licensed agencies & coverage research",
  },
] as const;
