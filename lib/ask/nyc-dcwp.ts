import { NYC_SNAPSHOT } from "@/lib/new-york-city-intelligence/snapshot";
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

function hicContext(text: string): boolean {
  return /\bhome[- ]improvement\b/.test(text) || /\bdcwp\b/.test(text) || /\bhic\b/.test(text);
}

export function interpretNycDcwp(query: string, text: string): AskResult | null {
  const nyc = nycPlace(text);
  const hic = hicContext(text);
  if (!nyc && !hic) return null;
  if (/\bpublic[- ]work\b/.test(text) || /\bnysdol\b/.test(text) || /\bcontractor registry\b/.test(text)) {
    return null;
  }

  const interpretation: AskInterpretation = { ...EMPTY, notes: [], location: nyc ? "New York City" : "Not specified" };

  if (/\bbest\b/.test(text) || /\brank/.test(text) || /\brecommend/.test(text)) {
    interpretation.notes.push("nyc-hic-no-ranking");
    return closed(
      query,
      interpretation,
      "ContractorTrustHub does not rank or recommend New York City contractors. Manhattan or Brooklyn wording can scope NYC DCWP research; it does not create a borough ranking page.",
      ["Open /new-york/new-york-city", "Confirm on DCWP Search Business"],
      "/new-york/new-york-city",
    );
  }

  if (/\bcomplaint/.test(text) && /\b(llc|inc|corp|corporation|company|construction)\b/.test(text) && !hic && !/\bdcwp\b/.test(text)) {
    interpretation.notes.push("nyc-named-complaint-needs-exact-id");
    return closed(
      query,
      interpretation,
      "A named-company complaint question needs an exact DCWP Business Unique ID or license number before company-specific attribution. Name-only matching is unsafe. A complaint is not a violation or a quality score.",
      ["Add the DCWP license number or Business Unique ID", "Open /new-york/new-york-city"],
      "/new-york/new-york-city",
    );
  }

  if (/\bcomplaint/.test(text) && nyc) {
    interpretation.notes.push("nyc-dcwp-complaints");
    interpretation.evidenceFamily = "DCWP consumer complaint observations";
    return closed(
      query,
      interpretation,
      `This hub publishes ${NYC_SNAPSHOT.complaints.parsed_rows.toLocaleString("en-US")} NYC DCWP Home Improvement Contractor complaint observations. A complaint is not a violation, not a substantiated finding, and not company quality. Exact Business Unique ID is required for company-specific attribution. Missing is not a clean history.`,
      ["Open /new-york/new-york-city", "Confirm on DCWP Search Business"],
      "/new-york/new-york-city",
    );
  }

  if (nyc && (/\blicens/.test(text) || hic || /\bdcwp\b/.test(text))) {
    interpretation.notes.push("nyc-dcwp-hic");
    return closed(
      query,
      interpretation,
      "NYC home-improvement contractor licensing is DCWP evidence, not NYSDOL public-work registration and not a DOB general-contractor registry. Confirm current status on official DCWP Search Business. Frozen Open Data is not live verification.",
      ["Open /new-york/new-york-city", "Confirm on DCWP Search Business"],
      "/new-york/new-york-city",
    );
  }

  if (hic && /\blicens/.test(text) && !nyc) {
    interpretation.notes.push("ny-hic-local-not-pw-registry");
    return closed(
      query,
      interpretation,
      "New York public-work contractor registration is not a statewide home-improvement contractor license. Local licensing, including New York City DCWP, may apply to ordinary private residential work.",
      ["Open /new-york/new-york-city", "Open /new-york"],
      "/new-york/new-york-city",
    );
  }

  if (nyc && /\broof/.test(text) && !/\bpermit/.test(text)) {
    interpretation.notes.push("nyc-roofing-not-automatic-hic");
    return closed(
      query,
      interpretation,
      "A roofing contractor in a borough is not automatically a DCWP Home Improvement Contractor for every roofing job. DCWP HIC covers defined residential home-improvement work and does not replace plumbing, electrical, new-home construction, or DOB credentials.",
      ["Open /new-york/new-york-city", "Confirm the work type and DCWP license"],
      "/new-york/new-york-city",
    );
  }

  return null;
}
