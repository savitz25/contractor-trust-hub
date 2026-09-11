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

function qualifyingPartyGrain(text: string): boolean {
  return /\bqualifying[- ]part/.test(text);
}

function sourceRowGrain(text: string): boolean {
  return /\bsource rows?\b/.test(text) || /\btransaction rows?\b/.test(text);
}

function otherStatusGrain(text: string): boolean {
  return /\b(suspended|revoked|inactive|expired|cancelled|canceled|not renewed|terminated)\b/.test(text);
}

function extraRestriction(text: string): boolean {
  return (
    /\bissued\b/.test(text) ||
    /\b20\d{2}\b/.test(text) ||
    /\b(chicago|cook|wage|debar|complaint)\b/.test(text) ||
    /\bserv(?:e|es|ing)\b/.test(text)
  );
}

function activeBusinessLicenseGrain(text: string): boolean {
  if (!countIntent(text) || !roofingContext(text)) return false;
  if (qualifyingPartyGrain(text) || sourceRowGrain(text) || otherStatusGrain(text) || extraRestriction(text)) {
    return false;
  }
  const active = /\bactive\b/.test(text);
  const business = /\bbusiness licen/.test(text) || /\blicensed roofing contractor/.test(text);
  return active && business;
}

function activeQualifyingPartyGrain(text: string): boolean {
  if (!countIntent(text) || !roofingContext(text) || !qualifyingPartyGrain(text)) return false;
  if (sourceRowGrain(text) || otherStatusGrain(text) || extraRestriction(text)) return false;
  return /\bactive\b/.test(text);
}

function sourceRowsGrain(text: string): boolean {
  if (!countIntent(text) || !roofingContext(text) || !sourceRowGrain(text)) return false;
  if (qualifyingPartyGrain(text) || otherStatusGrain(text) || extraRestriction(text) || /\bactive\b/.test(text)) {
    return false;
  }
  return true;
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
    if (activeBusinessLicenseGrain(text)) {
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
    if (activeQualifyingPartyGrain(text)) {
      interpretation.evidenceFamily = "IDFPR roofing qualifying-party credentials";
      interpretation.notes.push("il-roofing-active-qp-aggregate");
      return {
        version: ASK_CONTRACT_VERSION,
        query,
        mode: "count",
        supported: true,
        interpretation,
        href: "/illinois",
        count: {
          value: ILLINOIS_SNAPSHOT.qualifying_parties.active_distinct_license_ids,
          grain: "distinct ACTIVE qualifying-party roofing license_number (person grain)",
          caveat: "Person credentials, not roofing businesses. Dated snapshot, not a public person directory.",
        },
        aggregate: null,
        comparison: null,
        failMessage: null,
        changeHints: ["Open /illinois"],
      };
    }
    if (sourceRowsGrain(text)) {
      interpretation.evidenceFamily = "IDFPR roofing source rows";
      interpretation.notes.push("il-roofing-source-row-aggregate");
      return {
        version: ASK_CONTRACT_VERSION,
        query,
        mode: "count",
        supported: true,
        interpretation,
        href: "/illinois",
        count: {
          value: ILLINOIS_SNAPSHOT.roofing.source_rows,
          grain: "IDFPR roofing license-transaction source rows",
          caveat: "Rows are not distinct licenses and not unique companies.",
        },
        aggregate: null,
        comparison: null,
        failMessage: null,
        changeHints: ["Open /illinois"],
      };
    }
    interpretation.notes.push("il-roofing-count-grain-unspecified");
    return closed(
      query,
      interpretation,
      "This snapshot can answer the unfiltered count of ACTIVE licensed roofing business IDs, or explicitly requested qualifying-party IDs or source rows. It does not substitute one grain for another, and it does not run filtered status, date, geography, or discipline queries.",
      ["Ask how many active roofing business licenses are in the Illinois snapshot", "Open /illinois"],
      "/illinois",
    );
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
