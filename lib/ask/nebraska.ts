import { NE_SNAPSHOT as data } from "@/lib/nebraska-intelligence/snapshot";
import { ASK_CONTRACT_VERSION, type AskInterpretation, type AskResult } from "./types";

const STATE = /\bnebraska\b|\bin ne\b/i;
const OTHER =
  /\b(?:kansas|iowa|idaho|new mexico|arkansas|missouri|oklahoma|utah|nevada)\b|\bin (?:ks|ia|id|nm|ar|mo|ok|ut|nv)\b/i;
const RANK = /\b(?:best|top|safest|recommended|trust score|rating)\b/i;

function matches(query: string): boolean {
  if (/\bnevada\b/i.test(query) && !/\bnebraska\b/i.test(query)) return false;
  if (!STATE.test(query)) return false;
  if (OTHER.test(query) && !/\bnebraska\b/i.test(query)) return false;
  return true;
}

function base(notes: string[]): AskInterpretation {
  return {
    identifier: null,
    entityQuery: null,
    location: "Nebraska",
    trade: "Not specified",
    credentialStatus: "Not specified",
    evidenceFamily: "Nebraska Department of Labor contractor registration. Not a quality endorsement.",
    entityType: "Contractor registration",
    sort: "Default",
    notes,
  };
}

function result(query: string, href: string, message: string, notes: string[]): AskResult {
  return {
    version: ASK_CONTRACT_VERSION,
    query,
    mode: "fail_closed",
    supported: false,
    interpretation: base(notes),
    href,
    count: null,
    aggregate: null,
    comparison: null,
    failMessage: message,
    changeHints: ["Open /nebraska for the Department of Labor registration requirement."],
    definition: { title: "Nebraska contractor registration", body: message, href },
  };
}

export function interpretNebraska(query: string): AskResult | null {
  if (!matches(query)) return null;
  const place = /\b(?:omaha|lincoln)\b/i.test(query)
    ? " Omaha and Lincoln are geography only. This research publishes no Nebraska city route."
    : "";
  if (RANK.test(query)) {
    return result(
      query,
      "/nebraska",
      "ContractorTrustHub does not rank Nebraska contractors and does not publish a Trust Score.",
      ["Ranking is unsupported."],
    );
  }
  if (/\belectric/i.test(query)) {
    return result(
      query,
      "/nebraska#separate",
      `Statewide electrical credentials are ${data.electricalCensus}. They are not the contractor registration roster and are not added to plumbing.${place}`,
      ["Electrical stays separate."],
    );
  }
  if (/\bplumb/i.test(query)) {
    return result(
      query,
      "/nebraska#separate",
      `Statewide plumbing credentials are ${data.plumbingCensus}. They are not the contractor registration roster.${place}`,
      ["Plumbing stays separate."],
    );
  }
  if (/\bworkers?\s*'?\s*comp|\binsurance\b|\bacord\b/i.test(query)) {
    return result(
      query,
      "/nebraska#registration",
      `${data.workersCompRequirement} Observations of current certificates are ${data.workersCompObservations}. A requirement is not current compliance.${place}`,
      ["Insurance requirement is not an observation."],
    );
  }
  if (/\bfine|unpaid|employee classification/i.test(query)) {
    return result(
      query,
      "/nebraska#separate",
      `The unpaid-fines list for Employee Classification Act violations was ${data.unpaidFinesRows}. No name was joined to a registration row. A fine list is not the registration roster.${place}`,
      ["Fines were not acquired."],
    );
  }
  return result(
    query,
    "/nebraska",
    `${data.requirement} ${data.qualityStatement} The registration home page prints an annual fee of $${data.annualFeeUsd} effective ${data.annualFeeEffective}. That fee is not current compliance. The registered-contractor search was not scraped. The roster is ${data.roster}. Registration number, business or person, status, business name, and workers' compensation status were not acquired as rows. Electrical and plumbing censuses stay separate and were not acquired. No combined contractor total is published.${place}`,
    ["Registration is not a roster count and not a quality endorsement."],
  );
}
