import { LA_SNAPSHOT } from "@/lib/louisiana-intelligence/snapshot";
import { ASK_CONTRACT_VERSION, type AskInterpretation, type AskResult } from "./types";

const STATE = /\b(?:louisiana|lslbc)\b/i;
const CITY = /\b(?:new orleans|baton rouge|shreveport|lafayette)\b/i;
const TOPIC = /\b(?:contractors?|licen[sc]es?|credentials?|certificates?|registrations?|commercial|residential|home improvement|mold|classif\w*|disciplin\w*|complaints?|parishes?|census)\b/i;
const KEY = /\bLA-LSLBC:(\d{3,8})\b/i;
const LABELED = /\b(?:LSLBC|Louisiana)\b[\s\S]{0,48}?\b(?:license|certificate|registration|credential)\s*(?:#|number|no\.?|:)?\s*(\d{3,8})\b/i;
const CENSUS = /\b(?:how many|number of|count of|census|headcount)\b/i;
const TOTAL_POPULATION = /\btotal\b/i;
const PLUMBING = /\bplumb/i;
const CLASSIFICATION = /\b(?:classif\w*|qualifying part(?:y|ies)|qualifier)\b/i;
const TRADE_CLASS = /\b(?:roof(?:ing|er|ers)?|electric(?:al|ian|ians)?|hvac|heating|air conditioning|mechanical)\b/i;

function base(query: string, identifier: string | null, notes: string[]): AskInterpretation {
  return {
    identifier,
    entityQuery: null,
    location: "Louisiana",
    trade: "Not specified",
    credentialStatus: "Not specified",
    evidenceFamily: "LSLBC Active certificate types, kept separate",
    entityType: "LSLBC license certificate",
    sort: "Default",
    notes,
  };
}

function closed(query: string, interpretation: AskInterpretation, href: string, failMessage: string): AskResult {
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
    changeHints: ["Open /louisiana for separate certificate types.", "Confirm an exact license on the official LSLBC lookup."],
    definition: { title: "Louisiana LSLBC certificate types stay separate", body: failMessage, href },
  };
}

function guidance(query: string, interpretation: AskInterpretation, href: string, title: string, body: string): AskResult {
  return {
    version: ASK_CONTRACT_VERSION,
    query,
    mode: "guidance",
    supported: true,
    interpretation,
    href,
    count: null,
    aggregate: null,
    comparison: null,
    failMessage: null,
    changeHints: ["Confirm the exact license on the official LSLBC lookup."],
    definition: { title, body, href },
  };
}

export function interpretLouisiana(query: string): AskResult | null {
  const key = query.match(KEY);
  if (!(STATE.test(query) || (CITY.test(query) && TOPIC.test(query)) || key)) return null;

  const labeled = !key && query.match(LABELED);
  const exact = key?.[1] ?? labeled?.[1] ?? null;
  const bare = !exact && /\b\d{3,}\b/.test(query);
  const identifier = exact ? `LA-LSLBC:${exact}` : null;
  const notes = [
    "LA-CON-001: four LSLBC certificate types stay separate; no combined Louisiana contractors total",
    "Exact license numbers are identity only; no new profile mint",
    ...(bare ? ["A bare number is ambiguous until it is an LSLBC license identity."] : []),
  ];
  const interpretation = base(query, identifier, notes);

  if (exact && !PLUMBING.test(query)) {
    return guidance(
      query,
      interpretation,
      `/louisiana?license=${encodeURIComponent(exact)}#lookup`,
      `Louisiana LSLBC license ${exact}`,
      `${identifier} is an LSLBC license-number identity, not a new contractor profile. Confirm certificate type, status, and classifications on the official LSLBC lookup. The ${LA_SNAPSHOT.retrievedAt} roster counts are certificate rows, not this identity's profile.`,
    );
  }

  if (PLUMBING.test(query)) {
    return closed(
      query,
      interpretation,
      "/louisiana#not-acquired",
      "Louisiana State Plumbing Board person licenses are a separate grain and were NOT_ACQUIRED. They are not LSLBC certificate rows, they are not zero, and they are not added into a Louisiana contractors total.",
    );
  }

  if (CLASSIFICATION.test(query) || TRADE_CLASS.test(query)) {
    return closed(
      query,
      interpretation,
      "/louisiana#not-acquired",
      "Classifications on the interactive LSLBC lookup were NOT_ACQUIRED. Trade classifications and qualifying-party names are not on the roster export. They are not zero, and they are not added into one Louisiana contractors total.",
    );
  }

  if (CENSUS.test(query) || (TOTAL_POPULATION.test(query) && /\b(?:contractor|license|certificate|registration|credential)/i.test(query))) {
    return closed(
      query,
      interpretation,
      "/louisiana#credentials",
      "LSLBC certificate types stay separate and are not added into one Louisiana contractors total. Commercial License Certificate, Residential License Certificate, Home Improvement Registration, and Mold Remediation License Certificate rows are license-certificate rows, not a deduplicated company census.",
    );
  }

  if (/\b(?:expired|inactive)\b/i.test(query)) {
    return closed(
      query,
      interpretation,
      "/louisiana#not-acquired",
      "Expired and inactive credentials are not in the Active LSLBC export. Missing is not zero, and it is not proof that someone cannot work.",
    );
  }

  if (bare) {
    return guidance(
      query,
      interpretation,
      "/louisiana#lookup",
      "Louisiana LSLBC license identity",
      "A bare number is ambiguous. Supply the LSLBC license number as an identity, then confirm it on the official lookup. This does not mint a contractor profile, and it is not a census of Louisiana contractors.",
    );
  }

  if (/\bparish\b/i.test(query) || CITY.test(query)) {
    const place = CITY.exec(query)?.[0] ?? "Louisiana";
    return guidance(
      query,
      interpretation,
      "/louisiana#geography",
      "Louisiana geography is not a parish roster",
      `${place} is geography only. Parish on the LSLBC roster is an address field, not a service area. No parish pages are published. The four certificate types are not added into one Louisiana contractors total.`,
    );
  }

  const discipline = /\b(?:disciplin|enforcement|order)\b/i.test(query);
  const complaint = /\bcomplaints?\b/i.test(query);
  const href = discipline ? "/louisiana#not-acquired" : complaint ? "/louisiana#not-acquired" : "/louisiana#credentials";
  const body = discipline
    ? "No LSLBC disciplinary corpus was acquired. Acquired disciplinary attachments are not a count of zero events, and none are joined by name."
    : complaint
      ? "A public provider-level complaint corpus was not acquired. A complaint is not a finding, and missing complaints are not zero."
      : `The Louisiana State Licensing Board for Contractors publishes four separate certificate types on the ${LA_SNAPSHOT.retrievedAt} Active roster. Those rows are license certificates, not one Louisiana contractor census. Home Improvement Registration is not a commercial or residential construction license by itself. Mold Remediation is a specialty certificate, not a general construction license.`;
  return guidance(query, interpretation, href, "Louisiana LSLBC contractor certificate evidence", body);
}
