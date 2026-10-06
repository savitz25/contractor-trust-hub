import { AR_SNAPSHOT as data } from "@/lib/arkansas-intelligence/snapshot";
import { ASK_CONTRACT_VERSION, type AskInterpretation, type AskResult } from "./types";

const STATE = /\barkansas\b|\bcontractors licensing board\b|\bin ar\b/i;
const OTHER = /\b(?:oklahoma|missouri|utah|mississippi|arizona)\b|\bin (?:ok|mo|ut|ms|az)\b/i;
const CITY = /\b(?:little rock|north little rock|fayetteville|fort smith)\b/i;
const TOPIC =
  /\b(?:contractors?|licen[sc]es?|registrations?|commercial|residential|remodel(?:er|ing)?|roof(?:er|ing)|subcontractors?|home improvement|builder|building)\b/i;
const RANK = /\b(?:best|top|safest|recommended|trust score|rating)\b/i;

function matches(query: string): boolean {
  if (/\barizona\b/i.test(query)) return false;
  if (OTHER.test(query) && !/\barkansas\b/i.test(query)) return false;
  return STATE.test(query) || (CITY.test(query) && TOPIC.test(query) && /\barkansas\b/i.test(query));
}

function base(notes: string[]): AskInterpretation {
  return {
    identifier: null,
    entityQuery: null,
    location: "Arkansas",
    trade: "Not specified",
    credentialStatus: "Not specified",
    evidenceFamily: "Arkansas Contractors Licensing Board issuance figures. Not an active roster.",
    entityType: "CLB credential class",
    sort: "Default",
    notes,
  };
}

function result(
  query: string,
  mode: "guidance" | "fail_closed",
  href: string,
  message: string,
  notes: string[],
): AskResult {
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
    changeHints: ["Open /arkansas for the Contractors Licensing Board classes."],
    definition: { title: "Arkansas Contractors Licensing Board", body: message, href },
  };
}

function geography(query: string): string {
  return CITY.test(query)
    ? " Little Rock, North Little Rock, Fayetteville, and Fort Smith are geography only."
    : "";
}

function row(id: string) {
  const found = data.classes.find((item) => item.id === id);
  if (!found) throw new Error(`Missing Arkansas class ${id}`);
  return found;
}

export function interpretArkansas(query: string): AskResult | null {
  if (!matches(query)) return null;
  if (RANK.test(query)) {
    return result(
      query,
      "fail_closed",
      "/arkansas",
      "ContractorTrustHub does not rank Arkansas contractors and does not publish a Trust Score.",
      ["Ranking is unsupported."],
    );
  }
  const place = geography(query);
  if (/\b(?:qualifying party|qualifier)\b/i.test(query)) {
    return result(
      query,
      "fail_closed",
      "/arkansas#limits",
      `Qualifying party, company, and person are ${data.qualifyingPartySplit}. The Directory figures were not divided that way.${place}`,
      ["Person is not company."],
    );
  }
  if (/\b(?:electrical|electrician|plumbing|plumber|hvac|mechanical)\b/i.test(query)) {
    return result(
      query,
      "fail_closed",
      "/arkansas#limits",
      `Electrical, plumbing, and HVAC boards outside the Contractors Licensing Board section are ${data.otherBoards}. They are not the commercial license figure of ${row("commercial").count.toLocaleString("en-US")}.${place}`,
      ["Other boards stay separate."],
    );
  }
  if (/\broof/i.test(query)) {
    const item = row("roofer");
    return result(
      query,
      "guidance",
      "/arkansas#classes",
      `${item.label}: ${item.count.toLocaleString("en-US")}. ${item.clock}. ${item.grain}${place}`,
      ["2024 issuance is not a 2025 count."],
    );
  }
  if (/\bremodel/i.test(query)) {
    const item = row("remodeler");
    return result(
      query,
      "guidance",
      "/arkansas#classes",
      `${item.label}: ${item.count.toLocaleString("en-US")}. ${item.clock}. ${item.grain}${place}`,
      ["2023 point in time is not 2025 issuance."],
    );
  }
  if (/home improvement|specialty/i.test(query)) {
    const item = row("home-improvement");
    return result(
      query,
      "guidance",
      "/arkansas#classes",
      `${item.label}: ${item.count.toLocaleString("en-US")}. ${item.clock}. ${item.grain}${place}`,
      ["Limited and unlimited are not split."],
    );
  }
  if (/subcontract/i.test(query)) {
    const item = row("commercial-subcontractor");
    return result(
      query,
      "guidance",
      "/arkansas#classes",
      `${item.label}: ${item.count.toLocaleString("en-US")}. ${item.clock}. ${item.grain}${place}`,
      ["A bond requirement is not an observed filing."],
    );
  }
  if (/residential building|home builder|residential builder/i.test(query)) {
    const item = row("residential-building");
    return result(
      query,
      "guidance",
      "/arkansas#classes",
      `${item.label}: ${item.count.toLocaleString("en-US")}. ${item.clock}. ${item.grain}${place}`,
      ["Residential building is not commercial."],
    );
  }
  if (/commercial/i.test(query)) {
    const item = row("commercial");
    return result(
      query,
      "guidance",
      "/arkansas#classes",
      `${item.label}: ${item.count.toLocaleString("en-US")}. ${item.clock}. ${item.grain}${place}`,
      ["Issued during 2025 is not an active roster."],
    );
  }
  if (/\b(?:how many|number of|count of|census|total)\b/i.test(query)) {
    return result(
      query,
      "fail_closed",
      "/arkansas#classes",
      "Arkansas Contractors Licensing Board classes stay separate. Commercial 8,244 and residential building 2,762 are 2025 issuance figures. The remodeler figure 1,868 is a 2023 point-in-time total. Those clocks cannot be combined.",
      ["No combined contractor total."],
    );
  }
  return result(
    query,
    "guidance",
    "/arkansas",
    `The August 2026 Directory prints Contractors Licensing Board classes on different clocks. The active roster is ${data.activeRoster}. No combined Arkansas contractor total is published.${place}`,
    ["Issuance is not an active roster."],
  );
}
