import { SC_SNAPSHOT } from "@/lib/south-carolina-intelligence/snapshot";
import { ASK_CONTRACT_VERSION, type AskInterpretation, type AskResult } from "./types";

const STATE = /\bsouth carolina\b|\bin sc\b|\bllr\b/i;
const CITY = /\b(?:charleston|columbia|greenville)\b/i;
const TOPIC = /\b(?:contractors?|licen[sc]es?|builders?|electrical|electrician|hvac|plumbing|plumber|mechanical|residential|specialty)\b/i;
const RANK = /\b(?:best|top|safest|recommended|trust score|rating)\b/i;

function matches(query: string): boolean {
  if (/\bkentucky\b|\blouisiana\b|\balabama\b/i.test(query)) return false;
  return STATE.test(query) && (TOPIC.test(query) || /\bhow many\b|\bcensus\b|\bcount\b/i.test(query) || RANK.test(query) || CITY.test(query));
}

function base(notes: string[]): AskInterpretation {
  return {
    identifier: null,
    entityQuery: null,
    location: "South Carolina",
    trade: "Not specified",
    credentialStatus: "Not specified",
    evidenceFamily: "LLR Contractor's Licensing Board and Residential Builders Commission category counts, kept separate",
    entityType: "annual-report license category",
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
    changeHints: ["Open /south-carolina for the two LLR boards.", "A printed board total is not a company census."],
    definition: { title: "South Carolina boards stay separate", body: message, href },
  };
}

export function interpretSouthCarolina(query: string): AskResult | null {
  if (!matches(query)) return null;
  if (RANK.test(query)) {
    return result(query, "fail_closed", "/south-carolina", "ContractorTrustHub does not rank South Carolina contractors and does not publish a Trust Score.", ["Ranking is unsupported."]);
  }
  if (/\b(?:how many|number of|count of|census|total)\b/i.test(query)) {
    return result(
      query,
      "fail_closed",
      "/south-carolina#boards",
      "South Carolina does not have one contractor census. The Contractor's Licensing Board and the Residential Builders Commission publish separate category counts. A qualifying party is not a contractor license, and a printed board total is not a count of companies.",
      ["No combined contractor total."],
    );
  }
  if (CITY.test(query)) {
    return result(
      query,
      "guidance",
      "/south-carolina#geography",
      "Charleston, Columbia, and Greenville are geography only. This research publishes no city contractor route. A local business license is not an LLR statewide credential.",
      ["City is not a route."],
    );
  }
  return result(
    query,
    "guidance",
    "/south-carolina#boards",
    `LLR keeps two boards separate. The FY2025 report prints ${SC_SNAPSHOT.generalContractorRows.toLocaleString("en-US")} General Contractor category rows and ${SC_SNAPSHOT.mechanicalContractorRows.toLocaleString("en-US")} Mechanical Contractor category rows. Residential Home Builders are ${SC_SNAPSHOT.homeBuildersRows.toLocaleString("en-US")} category rows. Those figures are not one company census, and the license-row roster was not acquired.`,
    ["Two boards stay separate."],
  );
}
