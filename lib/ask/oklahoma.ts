import { OK_SNAPSHOT as data } from "@/lib/oklahoma-intelligence/snapshot";
import { ASK_CONTRACT_VERSION, type AskInterpretation, type AskResult } from "./types";

const STATE = /\boklahoma\b|\bconstruction industries board\b|\bin ok\b/i;
const OTHER = /\b(?:arkansas|missouri|utah|mississippi)\b|\bin (?:ar|mo|ut|ms)\b/i;
const CITY = /\b(?:oklahoma city|tulsa|norman|edmond|lawton|broken arrow)\b/i;
const TOPIC =
  /\b(?:contractors?|licen[sc]es?|registrations?|electrical|electrician|mechanical|hvac|plumbing|plumber|roofing|apprentices?|journeymen|journeyman|inspectors?|bond|insurance)\b/i;
const RANK = /\b(?:best|top|safest|recommended|trust score|rating)\b/i;

function matches(query: string): boolean {
  if (OTHER.test(query) && !/\boklahoma\b/i.test(query)) return false;
  return STATE.test(query) || (CITY.test(query) && TOPIC.test(query));
}

function base(notes: string[]): AskInterpretation {
  return {
    identifier: null,
    entityQuery: null,
    location: "Oklahoma",
    trade: "Not specified",
    credentialStatus: "Not specified",
    evidenceFamily: "CIB trade credentials. No statewide general-contractor license.",
    entityType: "CIB credential",
    sort: "Default",
    notes,
  };
}

function result(query: string, mode: "guidance" | "fail_closed", href: string, message: string, notes: string[]): AskResult {
  return {
    version: ASK_CONTRACT_VERSION,
    query,
    mode,
    supported: mode === "guidance",
    interpretation: base(notes),
    href,
    count: null,
    aggregate: null,
    comparison: null,
    failMessage: mode === "fail_closed" ? message : null,
    changeHints: [
      "Open /oklahoma for the CIB credential classes.",
      "Confirm a current record on the official CIB search.",
    ],
    definition: { title: "Oklahoma Construction Industries Board", body: message, href },
  };
}

export function interpretOklahoma(query: string): AskResult | null {
  if (!matches(query)) return null;
  if (RANK.test(query)) {
    return result(
      query,
      "fail_closed",
      "/oklahoma",
      "ContractorTrustHub does not rank Oklahoma contractors and does not publish a Trust Score.",
      ["Ranking is unsupported."],
    );
  }
  if (/\b(?:bond|insurance|liability|workers'? compensation)\b/i.test(query)) {
    return result(
      query,
      "guidance",
      "/oklahoma#requirements",
      `An active plumbing, electrical, or mechanical contractor must carry a $${data.bondRequirementUsd.toLocaleString("en-US")} surety bond and $${data.liabilityRequirementUsd.toLocaleString("en-US")} commercial general liability. That is a requirement on the CIB page last modified ${data.requirementsLastModified}. Current coverage for a named holder is ${data.observedBondOrInsurance}.`,
      ["A requirement is not observed compliance."],
    );
  }
  if (/\b(?:how many|number of|count of|census|total)\b/i.test(query)) {
    return result(
      query,
      "fail_closed",
      "/oklahoma#credentials",
      "Oklahoma does not issue a statewide general contractor license. Electrical, mechanical, plumbing, roofing, inspector, journeyman, and apprentice populations stay separate, and each bulk roster is NOT_ACQUIRED. There is no combined Oklahoma contractor count.",
      ["No combined contractor total."],
    );
  }
  if (CITY.test(query) && !/\boklahoma\b/i.test(query)) {
    return result(
      query,
      "guidance",
      "/oklahoma#geography",
      "Oklahoma City, Tulsa, Norman, Edmond, Lawton, and Broken Arrow are geography only. This page publishes no city contractor route. A city license is not a CIB statewide credential.",
      ["City is not a route."],
    );
  }
  if (/\bgeneral contractor/i.test(query)) {
    return result(
      query,
      "guidance",
      "/oklahoma#general",
      "General contractors are not currently required to have a state license in Oklahoma. That CIB FAQ statement was last modified December 30, 2025. It is not a count of zero general contractors, and a city license is not a statewide credential.",
      ["No statewide general-contractor license."],
    );
  }
  return result(
    query,
    "guidance",
    "/oklahoma#credentials",
    `The Construction Industries Board regulates plumbing, electrical, mechanical, roofing, building and construction inspectors, and home inspectors. Each bulk roster is ${data.bulkRosters}. The licensee lookup page was last modified ${data.lookupLastModified}. An application is not an issued license.`,
    ["Credential classes stay separate."],
  );
}
