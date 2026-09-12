import { NYC_DOB_SNAPSHOT } from "@/lib/new-york-city-dob-intelligence/snapshot";
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

function nycPlace(text: string): boolean {
  return (
    /\bnew york city\b/.test(text) ||
    /\bin nyc\b/.test(text) ||
    /\bnyc\b/.test(text) ||
    /\bmanhattan\b/.test(text) ||
    /\bbrooklyn\b/.test(text) ||
    /\bqueens\b/.test(text) ||
    /\bbronx\b/.test(text) ||
    /\bstaten island\b/.test(text)
  );
}

export function interpretNycDob(query: string, text: string): AskResult | null {
  const nyc = nycPlace(text);
  const permitish = /\bpermit/.test(text) || /\bbbl\b/.test(text) || /\bbin\b/.test(text) || /\bpluto\b/.test(text) || /\bdob\b/.test(text) || /\bworksite\b/.test(text);
  if (!nyc && !permitish) return null;
  if (/\bhome[- ]improvement\b/.test(text) && /\blicens/.test(text)) return null;
  if (/\bpublic[- ]work\b/.test(text) || /\bnysdol\b/.test(text)) return null;
  if (
    (/\bacris\b/.test(text) ||
      /\bdeed/.test(text) ||
      /\bmortgage/.test(text) ||
      /\brecorded document/.test(text) ||
      /\bproperty document/.test(text)) &&
    !/\bpermit/.test(text) &&
    !/\bdob\b/.test(text) &&
    !/\bpluto\b/.test(text)
  ) {
    return null;
  }

  const interpretation: AskInterpretation = { ...EMPTY, notes: [], location: nyc ? "New York City" : "Not specified" };

  if (/\bbest\b/.test(text) || /\brank/.test(text)) {
    interpretation.notes.push("nyc-dob-no-ranking");
    return closed(
      query,
      interpretation,
      "ContractorTrustHub does not rank contractors by permit counts. A permit is not quality, completion, or proof of who did the work.",
      ["Open /new-york/new-york-city"],
      "/new-york/new-york-city",
    );
  }

  if (/\bwho (pulled|filed|got)\b/.test(text) || /\bpermittee\b/.test(text) || /\bapplicant\b/.test(text)) {
    interpretation.notes.push("nyc-dob-actor-role");
    return closed(
      query,
      interpretation,
      "DOB records a source-native actor role. Applicant is not contractor. Filing representative is not permittee. Owner is not contractor. PE/RA is not a general contractor. Exact BBL/BIN is required before property evidence.",
      ["Open /new-york/new-york-city", "Add the BBL or BIN"],
      "/new-york/new-york-city",
    );
  }

  if (/\bdoes this contractor have permits\b/.test(text) || (/\bpermits?\b/.test(text) && /\b(llc|inc|corp|construction)\b/.test(text))) {
    interpretation.notes.push("nyc-dob-named-contractor-needs-exact-id");
    return closed(
      query,
      interpretation,
      "A named-company NYC permit question needs an exact DOB actor/license identifier. Name-only matching is unsafe. A permit at an address does not prove a particular contractor performed the work.",
      ["Add the DOB license number", "Open /new-york/new-york-city"],
      "/new-york/new-york-city",
    );
  }

  if (/\bpermit/.test(text) || /\bwhat work was permitted\b/.test(text) || /\bbbl\b/.test(text) || /\bbin\b/.test(text)) {
    interpretation.notes.push("nyc-dob-property-research");
    interpretation.evidenceFamily = "DOB permit / property observations";
    return closed(
      query,
      interpretation,
      `This hub publishes ${NYC_DOB_SNAPSHOT.dob_now.parsed_rows.toLocaleString("en-US")} DOB NOW approved-permit observations issued ${NYC_DOB_SNAPSHOT.window.start} to ${NYC_DOB_SNAPSHOT.window.end}, joined to PLUTO lots by exact BBL. Address-only matching is not automatic. A permit is not completion, quality, or contractor blame. Multiple lots at one address stay NEEDS_CLARIFICATION.`,
      ["Open /new-york/new-york-city", "Use BBL or BIN"],
      "/new-york/new-york-city",
    );
  }

  return null;
}
