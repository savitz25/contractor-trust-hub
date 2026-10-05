import { KY_SNAPSHOT } from "@/lib/kentucky-intelligence/snapshot";
import { ASK_CONTRACT_VERSION, type AskInterpretation, type AskResult } from "./types";

const STATE = /\bkentucky\b|\bdhbc\b|\bin ky\b/i;
const CITY = /\b(?:louisville|lexington)\b/i;
const TOPIC = /\b(?:contractors?|licen[sc]es?|credentials?|electrical|electrician|hvac|plumbing|plumber|inspectors?|fire|manufactured|census|disciplin\w*)\b/i;
const KEY = /\bKY-DHBC:([A-Z0-9]+)\b/i;
const RANK = /\b(?:best|top|safest|recommended|trust score|rating)\b/i;

function matches(query: string): boolean {
  return STATE.test(query) || (CITY.test(query) && TOPIC.test(query)) || KEY.test(query);
}

function base(notes: string[]): AskInterpretation {
  return {
    identifier: null,
    entityQuery: null,
    location: "Kentucky",
    trade: "Not specified",
    credentialStatus: "Not specified",
    evidenceFamily: "DHBC electrical, HVAC, and plumbing business licenses, kept separate",
    entityType: "DHBC business license",
    sort: "Default",
    notes,
  };
}

function result(query: string, mode: "guidance" | "fail_closed", href: string, message: string, notes: string[]): AskResult {
  const interpretation = base(notes);
  return {
    version: ASK_CONTRACT_VERSION,
    query,
    mode,
    supported: mode === "guidance",
    interpretation,
    href,
    count: null,
    aggregate: null,
    comparison: null,
    failMessage: mode === "fail_closed" ? message : null,
    changeHints: ["Open /kentucky for the three DHBC business-license classes.", "Confirm a license on the official DHBC search or Verify."],
    definition: { title: "Kentucky DHBC specialties stay separate", body: message, href },
  };
}

export function interpretKentucky(query: string): AskResult | null {
  if (!matches(query)) return null;
  const key = query.match(KEY)?.[1];
  if (key) {
    return result(
      query,
      "guidance",
      `${KY_SNAPSHOT.verifyPath}&q=${encodeURIComponent(key)}`,
      `KY-DHBC:${key} is a Verify identity for the existing Kentucky DHBC load. Confirm the current official record at the DHBC licensee search. This lookup does not create a new roster row.`,
      ["Exact DHBC key."],
    );
  }
  if (RANK.test(query)) {
    return result(query, "fail_closed", "/kentucky", "ContractorTrustHub does not rank Kentucky contractors and does not publish a Trust Score.", ["Ranking is unsupported."]);
  }
  if (/\b(?:how many|number of|count of|census|total)\b/i.test(query)) {
    return result(
      query,
      "fail_closed",
      "/kentucky#credentials",
      "Kentucky has no statewide general contractor license. The recorded production load keeps electrical, HVAC, and plumbing business licenses separate. Those classes are not one Kentucky contractor census.",
      ["No combined contractor total."],
    );
  }
  if (CITY.test(query) && !STATE.test(query)) {
    return result(
      query,
      "guidance",
      "/kentucky#geography",
      "Louisville and Lexington are geography only. This research publishes no city contractor route. Local licenses are not the statewide DHBC load.",
      ["City is not a route."],
    );
  }
  return result(
    query,
    "guidance",
    "/kentucky#credentials",
    `Kentucky DHBC licenses specialty trades. The recorded production Verify load has ${KY_SNAPSHOT.classes.map((row) => `${row.rows.toLocaleString("en-US")} Active ${row.label}`).join(", ")} rows. The ${KY_SNAPSHOT.recordedLicenseRows.toLocaleString("en-US")} figure is the sum of those license rows. It is not a company census and it was not re-extracted on ${KY_SNAPSHOT.publishedAt}.`,
    ["Three business-license classes stay separate."],
  );
}
