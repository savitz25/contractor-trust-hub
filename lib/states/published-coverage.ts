import { PUBLISHED_STATEWIDE_SLUGS } from "@/lib/seo/published-state-path";

/**
 * Single local list behind homepage state counts and state presentation.
 * Derived from PUBLISHED_STATEWIDE_SLUGS (the published /<state> routes), so a
 * newly published state appears on the homepage without a hand-entered count.
 */
const CODES: Record<(typeof PUBLISHED_STATEWIDE_SLUGS)[number], string> = {
  arizona: "AZ",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  florida: "FL",
  georgia: "GA",
  illinois: "IL",
  indiana: "IN",
  massachusetts: "MA",
  maryland: "MD",
  michigan: "MI",
  minnesota: "MN",
  nevada: "NV",
  "new-jersey": "NJ",
  "new-york": "NY",
  "north-carolina": "NC",
  ohio: "OH",
  oregon: "OR",
  pennsylvania: "PA",
  tennessee: "TN",
  texas: "TX",
  virginia: "VA",
  washington: "WA",
  wisconsin: "WI",
};

/** Newest published states first. Summaries restate each state page's own published scope. */
const RECENT: Partial<Record<(typeof PUBLISHED_STATEWIDE_SLUGS)[number], string>> = {
  indiana: "Plumbing Commission credential classes, discipline documents, and the local licensing boundary",
  wisconsin: "DSPS dwelling, electrical, and HVAC contractor credential classes with live verification",
  connecticut: "DCP home-improvement, new-home, and trade credential classes plus administrative decisions",
  maryland: "MHIC home improvement licenses, disciplinary orders, and Guaranty Fund awards",
  michigan: "BCC residential builder and skilled-trade license classes plus public disciplinary reports",
  minnesota: "Statewide construction credential classes and public enforcement evidence",
  nevada: "State Contractors Board license classifications and public board actions",
  tennessee: "Board for Licensing Contractors license classes and public regulatory events",
  massachusetts: "Construction Supervisor and Home Improvement Contractor credential evidence",
  georgia: "Statewide contractor credential classes and cease-and-desist orders",
};

export type PublishedState = {
  slug: string;
  code: string;
  name: string;
  href: string;
  /** Present only for recently published states. */
  recentSummary?: string;
};

function nameFor(slug: string): string {
  return slug
    .split("-")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

export const PUBLISHED_STATES: PublishedState[] = PUBLISHED_STATEWIDE_SLUGS.map((slug) => ({
  slug,
  code: CODES[slug],
  name: nameFor(slug),
  href: `/${slug}`,
  recentSummary: RECENT[slug],
}));

export const PUBLISHED_STATE_COUNT = PUBLISHED_STATES.length;

export const RECENT_PUBLISHED_STATES: PublishedState[] = Object.keys(RECENT)
  .map((slug) => PUBLISHED_STATES.find((s) => s.slug === slug))
  .filter((s): s is PublishedState => Boolean(s));

export function publishedStateByCode(code: string): PublishedState | undefined {
  return PUBLISHED_STATES.find((s) => s.code === code.toUpperCase());
}
