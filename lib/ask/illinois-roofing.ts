import { GEO_ONTOLOGY, phraseInText } from "./ontology";
import { ILLINOIS_SNAPSHOT } from "@/lib/illinois-intelligence/snapshot";
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
  };
}

export function hasIllinoisIntent(text: string): boolean {
  return (
    phraseInText(text, "illinois") ||
    phraseInText(text, "idfpr") ||
    phraseInText(text, "in il") ||
    phraseInText(text, "il statewide")
  );
}

const OTHER: Array<[string, string]> = [
  ["florida", "fl"],
  ["new york", "ny"],
  ["new jersey", "nj"],
  ["virginia", "va"],
  ["colorado", "co"],
  ["arizona", "az"],
  ["texas", "tx"],
  ["california", "ca"],
  ["washington", "wa"],
];

export function otherStateIntents(text: string): string[] {
  const fromGeo = GEO_ONTOLOGY.filter(
    (geo) => geo.kind === "state" && geo.id !== "il" && geo.phrases.some((p) => phraseInText(text, p)),
  ).map((geo) => geo.id);
  const extras = OTHER.filter(([p]) => phraseInText(text, p)).map(([, id]) => id);
  return [...new Set([...fromGeo, ...extras])];
}

function roofingContext(text: string): boolean {
  return /\broof/.test(text);
}

function countIntent(text: string): boolean {
  return /\bhow many\b/.test(text) || /\bnumber of\b/.test(text) || /\bcount of\b/.test(text);
}

function namedCompany(text: string): boolean {
  return /\b(llc|inc|corp|corporation|ltd|limited)\b/.test(text);
}

function unsupportedFilter(text: string): boolean {
  return (
    /\b(issued|inactive|expired|chicago|cook|wage|debar|complaint|202\d)\b/.test(text) ||
    /\bserv(?:e|es|ing)\b/.test(text)
  );
}

export function interpretIllinoisRoofing(query: string, text: string): AskResult | null {
  const il = hasIllinoisIntent(text);
  const others = otherStateIntents(text);
  const interpretation: AskInterpretation = { ...EMPTY, notes: [] };

  if (/\bdebar/.test(text) && il && others.length > 0) {
    interpretation.notes.push("il-debarment-requested-other-jurisdiction");
    const href = others[0] === "fl" ? "/florida" : others[0] === "ny" ? "/new-york" : null;
    return closed(
      query,
      interpretation,
      "Debarment is checked in the requested jurisdiction, not an Illinois business location. This path does not substitute IDFPR roofing evidence.",
      ["Name one issuing jurisdiction"],
      href,
    );
  }

  if (!il) return null;
  interpretation.location = "Illinois";

  if (/\bhome[- ]improvement\b/.test(text) || (/\bcontractor/.test(text) && !roofingContext(text) && countIntent(text))) {
    interpretation.notes.push("il-not-statewide-gc");
    return closed(
      query,
      interpretation,
      "This Illinois snapshot covers IDFPR roofing contractor credentials only. It is not a count of all Illinois contractors and not a statewide general-contractor or home-improvement license.",
      ["Open /illinois", "Ask how many active roofing business licenses are in the Illinois snapshot"],
      "/illinois",
    );
  }

  if (namedCompany(text) && (/\blicens/.test(text) || roofingContext(text))) {
    interpretation.entityQuery = query.slice(0, 120);
    interpretation.notes.push("il-named-company-not-statewide-count");
    return closed(
      query,
      interpretation,
      "A named-company Illinois roofing question is not the statewide active business-license total. Confirm the exact license number on IDFPR License Look Up. Name-only matching is unsafe.",
      ["Open /illinois", "Use IDFPR License Look Up"],
      "/illinois",
    );
  }

  if (countIntent(text) && roofingContext(text)) {
    if (unsupportedFilter(text)) {
      interpretation.notes.push("il-roofing-filtered-count-unsupported");
      return closed(
        query,
        interpretation,
        "A filtered Illinois roofing count is not supported. The dated snapshot total is not an answer to a filtered question. Mailing geography is not service territory.",
        ["Ask for the unfiltered active roofing business-license count", "Open /illinois"],
        "/illinois",
      );
    }
    interpretation.evidenceFamily = "IDFPR roofing business licenses";
    interpretation.notes.push("il-roofing-active-business-aggregate");
    return {
      version: ASK_CONTRACT_VERSION,
      query,
      mode: "count",
      supported: true,
      interpretation,
      href: "/illinois",
      count: {
        value: ILLINOIS_SNAPSHOT.business_licenses.active_business_y_distinct_license_ids,
        grain: "distinct ACTIVE licensed roofing contractor license_number with business=Y",
        caveat: "Dated IDFPR Open Data snapshot. Not unique companies, not qualifying parties, and not live Verify SQL.",
      },
      aggregate: null,
      comparison: null,
      failMessage: null,
      changeHints: ["Open /illinois", "Confirm on IDFPR License Look Up"],
    };
  }

  if (roofingContext(text) && /\b(chicago|cook|serv)/.test(text)) {
    interpretation.notes.push("il-mailing-ne-service-territory");
    return closed(
      query,
      interpretation,
      "An Illinois roofing mailing address is not service territory. This snapshot does not list roofers serving Chicago.",
      ["Open /illinois"],
      "/illinois",
    );
  }

  if (roofingContext(text) || (/\bcontractor/.test(text) && !others.length)) {
    interpretation.notes.push("il-roofing-not-live-directory");
    return closed(
      query,
      interpretation,
      "Illinois roofing evidence is a dated statewide snapshot page, not a live browsable company result set and not a statewide contractor total.",
      ["Open /illinois", "Ask how many active roofing business licenses are in the Illinois snapshot"],
      "/illinois",
    );
  }

  return null;
}
