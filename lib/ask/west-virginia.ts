import { WV_SNAPSHOT as data } from "@/lib/west-virginia-intelligence/snapshot";
import { ASK_CONTRACT_VERSION, type AskInterpretation, type AskResult } from "./types";

// Bare "wv" is not a match. "in wv" is. "west virginia" is not Virginia.
const STATE = /\bwest virginia\b|\bin wv\b/i;
const CITY = /\b(?:charleston|morgantown|huntington)\b/i;
const RANK = /\b(?:best|top|safest|recommended|trust score|rating)\b/i;

function matches(query: string): boolean {
  return STATE.test(query);
}

function base(notes: string[]): AskInterpretation {
  return {
    identifier: null,
    entityQuery: null,
    location: "West Virginia",
    trade: "Not specified",
    credentialStatus: "Not specified",
    evidenceFamily: "West Virginia Division of Labor elevator-inspector list. Not a contractor-license roster.",
    entityType: "Elevator inspector row",
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
    changeHints: ["Open /west-virginia for the Division of Labor evidence."],
    definition: { title: "West Virginia Division of Labor", body: message, href },
  };
}

function geography(query: string): string {
  return CITY.test(query)
    ? " Charleston, Morgantown, and Huntington are geography only. No city route was published."
    : "";
}

export function interpretWestVirginia(query: string): AskResult | null {
  if (!matches(query)) return null;
  const place = geography(query);
  const elev = data.elevatorInspectors;
  if (RANK.test(query)) {
    return result(
      query,
      "fail_closed",
      "/west-virginia",
      "ContractorTrustHub does not rank West Virginia contractors and does not publish a Trust Score.",
      ["Ranking is unsupported."],
    );
  }
  if (/\belevator\b/i.test(query)) {
    return result(
      query,
      "fail_closed",
      "/west-virginia#elevator-inspectors",
      `The Division of Labor elevator-inspector list has ${elev.inspectorRows} inspector rows and ${elev.distinctInspectorNameStrings} distinct inspector-name strings. It prints ${elev.distinctBusinessNameStrings} distinct business-name strings. Those strings were not resolved into companies. A person is not a company. Two rows include a status note and were not removed from the ${elev.inspectorRows}. An elevator inspector is not a contractor license. The list does not print an as-of date.${place}`,
      ["Elevator inspectors stay separate from contractor licenses."],
    );
  }
  if (/\bhvac\b/i.test(query)) {
    return result(
      query,
      "fail_closed",
      "/west-virginia#other-credentials",
      `A West Virginia HVAC certification roster was ${data.hvacCertificationRoster}. HVAC is not an elevator inspector and is not a contractor license. Missing is not zero.${place}`,
      ["HVAC stays separate."],
    );
  }
  if (/\bplumb(?:ing|er|ers)\b/i.test(query)) {
    return result(
      query,
      "fail_closed",
      "/west-virginia#other-credentials",
      `A West Virginia plumbing certification roster was ${data.plumbingCertificationRoster}. Plumbing is not an elevator inspector and is not a contractor license. Missing is not zero.${place}`,
      ["Plumbing stays separate."],
    );
  }
  if (/\bmanufactured housing\b|\bmodular\b/i.test(query)) {
    return result(
      query,
      "fail_closed",
      "/west-virginia#other-credentials",
      `A West Virginia manufactured-housing roster was ${data.manufacturedHousingRoster}. It is not a contractor-license count. Missing is not zero.${place}`,
      ["Manufactured housing stays separate."],
    );
  }
  return result(
    query,
    "fail_closed",
    "/west-virginia",
    `A West Virginia contractor-license roster was ${data.contractorLicenseRoster}. The Contractor Licensing Board search and the Division database search were not downloaded as bulk rosters. A search page is not a census. The elevator-inspector list is a separate population and is not added. HVAC, plumbing, and manufactured housing were ${data.hvacCertificationRoster}. Missing is not zero. No combined contractor total is published.${place}`,
    ["No combined contractor population."],
  );
}
