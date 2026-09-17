import { phraseInText } from "./ontology";
import { PENNSYLVANIA_SNAPSHOT } from "@/lib/pennsylvania-intelligence/snapshot";
import { ASK_CONTRACT_VERSION, type AskInterpretation, type AskResult } from "./types";

const EMPTY: AskInterpretation = {
  identifier: null,
  entityQuery: null,
  location: "Not specified",
  trade: "Not specified",
  credentialStatus: "Not specified",
  evidenceFamily: "Not specified",
  entityType: "Contractor credential / identity",
  sort: "Default",
  notes: [],
};

function closed(
  query: string,
  interpretation: AskInterpretation,
  failMessage: string,
  changeHints: string[],
  href: string | null,
  extra?: Partial<AskResult>,
): AskResult {
  return {
    version: ASK_CONTRACT_VERSION,
    query,
    mode: "fail_closed",
    supported: false,
    interpretation,
    href,
    count: null,
    aggregate: null,
    comparison: null,
    failMessage,
    changeHints,
    ...extra,
  };
}

export function hasPennsylvaniaIntent(text: string): boolean {
  return (
    phraseInText(text, "pennsylvania") ||
    phraseInText(text, "pa statewide") ||
    phraseInText(text, "philadelphia") ||
    phraseInText(text, "pittsburgh") ||
    phraseInText(text, "allegheny") ||
    phraseInText(text, "hicpa") ||
    /(^|\s)in pa(?=\s|$)/.test(text) ||
    /\bpa hic\b/.test(text) ||
    /\bpa home improvement\b/.test(text) ||
    /\bpa#/.test(text)
  );
}

function parsePaHicNumber(query: string, text: string): string | null {
  const paPrefixed = query.match(/\bPA\s*#?\s*(\d{5,10})\b/i);
  if (paPrefixed) return `PA${paPrefixed[1]}`;
  const labeled = query.match(
    /\b(?:hic(?:pa)?|registration(?:\s+number)?)\s*#?\s*(?:pa)?\s*(\d{5,10})\b/i,
  );
  if (
    labeled &&
    (hasPennsylvaniaIntent(text) || /\bpa\b/i.test(query) || /\bhicpa\b/i.test(query))
  ) {
    return `PA${labeled[1]}`;
  }
  return null;
}

export function interpretPennsylvaniaHic(query: string, text: string): AskResult | null {
  const hic = parsePaHicNumber(query, text);
  if (!hasPennsylvaniaIntent(text) && !hic) return null;
  const interpretation: AskInterpretation = {
    ...EMPTY,
    location: "Pennsylvania",
    identifier: hic,
    notes: ["pa-hic-state-intelligence"],
  };

  if (/\b(philadelphia|pittsburgh|allegheny|montgomery)\b/.test(text) && /\/pennsylvania\//.test(query)) {
    return closed(
      query,
      interpretation,
      "This ticket publishes statewide Pennsylvania intelligence only. Philadelphia and Pittsburgh licensing are municipal, not statewide routes.",
      ["Open Pennsylvania contractor research"],
      "/pennsylvania",
    );
  }

  if (hic) {
    return closed(
      query,
      { ...interpretation, evidenceFamily: "HICPA registration — official search" },
      `PA Home Improvement Contractor registration ${hic} is a HICPA identity, not a general contractor license and not a CMS-style CCN. Confirm current active status on official OAG Home Improvement Contractor Search. Search results display active registrations only. Statewide HICPA bulk was not acquired (OPEN_SEARCH_ONLY).`,
      ["Open official HICPA search", "Open Pennsylvania contractor research"],
      "/pennsylvania",
    );
  }

  if (/\bdebar/.test(text) || /prevailing wage/.test(text)) {
    return closed(
      query,
      { ...interpretation, evidenceFamily: "PA prevailing-wage debarment" },
      `Current DLI prevailing-wage debarment listings: ${PENNSYLVANIA_SNAPSHOT.debarment.PA_PREVAILING_WAGE_DEBARMENT_ROWS} rows. A debarment is not a complaint, not a conviction, and not a HICPA registration. Name-only attachment is unsafe. Current settlements observation is none — that is not historical clearance.`,
      ["Open Pennsylvania contractor research", "Open DLI debarments"],
      "/pennsylvania",
    );
  }

  if (/\basbestos\b/.test(text)) {
    return closed(
      query,
      { ...interpretation, evidenceFamily: "DLI asbestos contractor certification" },
      `DLI certified asbestos abatement contractor firms in this snapshot: ${PENNSYLVANIA_SNAPSHOT.asbestos.PA_ASBESTOS_CONTRACTOR_DISTINCT_IDS} distinct CERT #s. Firm certification is not an individual asbestos credential and not HICPA registration.`,
      ["Open Pennsylvania contractor research"],
      "/pennsylvania",
    );
  }

  if (/\blead\b/.test(text) && /abatement|contractor|certif/.test(text)) {
    return closed(
      query,
      { ...interpretation, evidenceFamily: "DLI lead contractor certification" },
      `DLI certified lead abatement contractor firms in this snapshot: ${PENNSYLVANIA_SNAPSHOT.lead.PA_LEAD_CONTRACTOR_DISTINCT_IDS} distinct CERT #s. Lead certification is not HICPA registration.`,
      ["Open Pennsylvania contractor research"],
      "/pennsylvania",
    );
  }

  if (/\b(electrician|electrical|plumber|plumbing)\b/.test(text)) {
    return closed(
      query,
      { ...interpretation, evidenceFamily: "Municipal / local trade licensing" },
      "Pennsylvania does not publish a statewide electrician or plumber contractor license census. Electrical and plumbing licensing is typically municipal. Absence from the statewide page is not zero local licenses.",
      ["Open Pennsylvania contractor research", "Check the municipality where the work will occur"],
      "/pennsylvania",
    );
  }

  if (/\blicensed contractor/.test(text) || (/\blicen/.test(text) && /\bcontractor/.test(text))) {
    return closed(
      query,
      interpretation,
      "Pennsylvania does not have a universal statewide general-contractor license. HICPA registration is the primary statewide home-improvement registration and is not an endorsement or competency finding. A licensed-contractor question is not a statewide license census.",
      ["Open Pennsylvania contractor research", "Look up an exact PA HIC registration"],
      "/pennsylvania",
    );
  }

  if (
    /\bhow many\b/.test(text) &&
    (/\bhic\b/.test(text) || /home improvement/.test(text) || /registered contractor/.test(text))
  ) {
    return closed(
      query,
      interpretation,
      "A statewide HICPA registration count is OPEN_SEARCH_ONLY. Official search displays active registrations after Turnstile verification. Search-only is not zero registered contractors.",
      ["Open official HICPA search", "Open Pennsylvania contractor research"],
      "/pennsylvania",
    );
  }

  if (/\b(best|safest|worst|top)\b/.test(text)) {
    return closed(
      query,
      interpretation,
      "ContractorTrustHub does not rank Pennsylvania contractors and does not publish a Trust Score.",
      ["Open Pennsylvania contractor research"],
      "/pennsylvania",
    );
  }

  if (/\b(philadelphia|pittsburgh)\b/.test(text)) {
    return closed(
      query,
      interpretation,
      "Philadelphia and Pittsburgh contractor licensing are municipal. This page is statewide Pennsylvania intelligence only and does not create city routes. Municipal absence from the state page is not zero.",
      ["Open Pennsylvania contractor research"],
      "/pennsylvania",
    );
  }

  return closed(
    query,
    interpretation,
    "Pennsylvania contractor research is statewide HICPA registration (search-only), separate DLI asbestos and lead contractor certifications, and prevailing-wage debarment listings. There is no universal statewide general-contractor license census.",
    ["Open Pennsylvania contractor research", "Look up an exact PA HIC registration"],
    "/pennsylvania",
  );
}
