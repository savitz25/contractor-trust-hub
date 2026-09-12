import { NYC_ACRIS_SNAPSHOT } from "@/lib/new-york-city-acris-intelligence/snapshot";
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
    /\bstaten island\b/.test(text) ||
    /\bbbl\b/.test(text) ||
    /\bacris\b/.test(text)
  );
}

export function interpretNycAcris(query: string, text: string): AskResult | null {
  if (/\bhome[- ]improvement\b/.test(text) && /\blicens/.test(text)) return null;
  if (/\bpublic[- ]work\b/.test(text) || /\bnysdol\b/.test(text)) return null;
  if (/\bpermit/.test(text) && !/\bdeed|mortgage|acris|recorded document|property document/.test(text)) return null;

  const nyc = nycPlace(text);
  const acrish =
    /\bacris\b/.test(text) ||
    /\bdeed/.test(text) ||
    /\bmortgage/.test(text) ||
    /\brecorded document/.test(text) ||
    /\bproperty document/.test(text) ||
    /\bwho owns\b/.test(text) ||
    /\bsold\b/.test(text) ||
    /\blender\b/.test(text);
  if (!nyc && !acrish) return null;

  const interpretation: AskInterpretation = { ...EMPTY, notes: [], location: nyc ? "New York City" : "Not specified" };

  if (/\bbest\b/.test(text) || /\brank/.test(text) || /\bproperty sales\b/.test(text)) {
    interpretation.notes.push("nyc-acris-no-ranking");
    return closed(
      query,
      interpretation,
      "ContractorTrustHub does not rank contractors from property documents or sales. ACRIS is not a contractor score.",
      ["Open /new-york/new-york-city"],
      "/new-york/new-york-city",
    );
  }

  if (/\bwho owns\b/.test(text) || /\bcurrent owner\b/.test(text) || /\bbeneficial owner\b/.test(text)) {
    interpretation.notes.push("nyc-acris-not-current-ownership");
    return closed(
      query,
      interpretation,
      "ACRIS recorded documents do not prove current beneficial ownership. Party names were not acquired and are not customer identities. Exact BBL is required before property-document research.",
      ["Open /new-york/new-york-city", "Search official ACRIS"],
      "/new-york/new-york-city",
    );
  }

  if (/\bsold\b/.test(text) || /\bsale\b/.test(text) || /\bpurchased\b/.test(text)) {
    interpretation.notes.push("nyc-acris-deed-ne-sale");
    return closed(
      query,
      interpretation,
      "A deed-type ACRIS document is not automatically an arm’s-length sale, market value, or current ownership. Recorded amount is not market value.",
      ["Open /new-york/new-york-city"],
      "/new-york/new-york-city",
    );
  }

  if (/\blender\b/.test(text) || /\bnmls\b/.test(text)) {
    interpretation.notes.push("nyc-acris-no-nmls");
    return closed(
      query,
      interpretation,
      "ACRIS mortgage documents are recorded instruments. This hub does not attach lender names to NMLS identities or LenderTrustHub profiles. A recorded mortgage is not current balance or current holder.",
      ["Open /new-york/new-york-city"],
      "/new-york/new-york-city",
    );
  }

  if (/\bmortgage/.test(text)) {
    interpretation.notes.push("nyc-acris-mortgage-document");
    return closed(
      query,
      interpretation,
      `This hub publishes ${NYC_ACRIS_SNAPSHOT.hero.mtge_value.toLocaleString("en-US")} mortgage-type ACRIS documents recorded ${NYC_ACRIS_SNAPSHOT.window.start} to ${NYC_ACRIS_SNAPSHOT.window.recorded_max}. That is recorded-document evidence, not current loan balance or holder.`,
      ["Open /new-york/new-york-city", "Use BBL"],
      "/new-york/new-york-city",
    );
  }

  if (/\bdeed/.test(text) || /\bacris\b/.test(text) || /\brecorded document/.test(text) || /\bproperty document/.test(text) || /\bbbl\b/.test(text)) {
    interpretation.notes.push("nyc-acris-property-documents");
    interpretation.evidenceFamily = "ACRIS recorded property documents";
    return closed(
      query,
      interpretation,
      `This hub publishes ${NYC_ACRIS_SNAPSHOT.master.parsed_rows.toLocaleString("en-US")} ACRIS Master observations recorded ${NYC_ACRIS_SNAPSHOT.window.start} to ${NYC_ACRIS_SNAPSHOT.window.recorded_max}, joined to lots by exact borough/block/lot BBL. This is not a title search. Staten Island recording coverage is partial.`,
      ["Open /new-york/new-york-city", "Use BBL"],
      "/new-york/new-york-city",
    );
  }

  return null;
}
