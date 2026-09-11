import { GEO_ONTOLOGY, phraseInText } from "./ontology";
import { NEW_YORK_SNAPSHOT } from "@/lib/new-york-intelligence/snapshot";
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

export function hasNewYorkIntent(text: string): boolean {
  return (
    phraseInText(text, "new york") ||
    phraseInText(text, "nysdol") ||
    phraseInText(text, "in ny") ||
    phraseInText(text, "ny statewide") ||
    phraseInText(text, "ny")
  );
}

const OTHER_STATE_PHRASES: Array<[string, string]> = [
  ["florida", "fl"],
  ["new jersey", "nj"],
  ["virginia", "va"],
  ["colorado", "co"],
  ["arizona", "az"],
  ["texas", "tx"],
  ["california", "ca"],
  ["washington", "wa"],
  ["oregon", "or"],
];

export function otherStateIntents(text: string): string[] {
  const fromGeo = GEO_ONTOLOGY.filter(
    (geo) => geo.kind === "state" && geo.id !== "ny" && geo.phrases.some((phrase) => phraseInText(text, phrase)),
  ).map((geo) => geo.id);
  const extras = OTHER_STATE_PHRASES.filter(([phrase]) => phraseInText(text, phrase)).map(([, id]) => id);
  return [...new Set([...fromGeo, ...extras])];
}

function publicWorkContext(text: string): boolean {
  return (
    /\bpublic[- ]work\b/.test(text) ||
    /\bcontractor registry\b/.test(text) ||
    /\bregistry certificate/.test(text)
  );
}

function countIntent(text: string): boolean {
  return /\bhow many\b/.test(text) || /\bnumber of\b/.test(text) || /\bcount of\b/.test(text);
}

function namedCompany(text: string): boolean {
  return /\b(llc|inc|corp|corporation|ltd|limited)\b/.test(text);
}

function certificateId(text: string): string | null {
  const match = text.match(/\b\d{2}-[a-z0-9]+-cr\b/i);
  return match ? match[0].toUpperCase() : null;
}

function unsupportedAggregateFilter(text: string): boolean {
  return /\b(wage|debar|mold|asbestos|mwbe|complaint|expired|out[- ]of[- ]state)\b/.test(text);
}

export function interpretNewYorkPublicWork(query: string, text: string): AskResult | null {
  const ny = hasNewYorkIntent(text);
  const others = otherStateIntents(text);
  const interpretation: AskInterpretation = { ...EMPTY, notes: [] };

  if (/\bdebar/.test(text)) {
    if (others.length > 0 && !ny) return null;
    if (!ny) {
      interpretation.notes.push("debarment-jurisdiction-unspecified");
      return closed(
        query,
        interpretation,
        "Debarment is jurisdiction-specific. Name the state or issuing agency. This research path does not assume New York.",
        ["Name the state", "Open the relevant state research page"],
        null,
      );
    }
    interpretation.location = "New York";
    interpretation.notes.push("ny-debarment-path");
    return closed(
      query,
      interpretation,
      "New York debarment is source-specific. Exact official identity is required for a research association. Name-only matching is unsafe. Historical debarment is not current exclusion, a public-work exclusion is not a ban on ordinary private work, and same-row registry flags are not a complete EDList census. Use the official NY DOL EDList search. A debarment is not a criminal conviction.",
      ["Open /new-york", "Search the official NY DOL EDList"],
      "/new-york",
    );
  }

  if (!ny) return null;

  interpretation.location = "New York";

  if (/\bmold\b/.test(text)) {
    interpretation.notes.push("ny-mold-search-only");
    return closed(
      query,
      interpretation,
      "New York mold credentials were not acquired as a bulk business roster. Assessment businesses are not remediation businesses, and individual assessor/supervisor/worker credentials are a person grain. Confirm on the official NY DOL Mold Program. Missing is not zero.",
      ["Open /new-york", "Use the official NY DOL Mold Program"],
      "/new-york",
    );
  }
  if (/\basbestos\b/.test(text)) {
    interpretation.notes.push("ny-asbestos-search-only");
    return closed(
      query,
      interpretation,
      "New York asbestos contractor licenses were not acquired as a bulk list. An asbestos contractor license is not a worker certificate of competence. Confirm on the official NY DOL Asbestos Control Bureau. Missing is not zero.",
      ["Open /new-york", "Use the official Asbestos Control Bureau"],
      "/new-york",
    );
  }
  if (/\bhome[- ]improvement\b/.test(text) && /\blicens/.test(text)) {
    interpretation.notes.push("ny-hic-local-not-pw-registry");
    return closed(
      query,
      interpretation,
      "New York public-work contractor registration is not a statewide home-improvement contractor license. Local licensing, including New York City, may apply to ordinary private residential work. Absence from the public-work registry does not automatically mean a residential contractor is illegal.",
      ["Open /new-york", "Check the local home-improvement licensing authority"],
      "/new-york",
    );
  }

  const cert = certificateId(text);
  if (cert) {
    interpretation.identifier = cert;
    interpretation.notes.push("ny-certificate-official-verify");
    return closed(
      query,
      interpretation,
      "This hub does not run an interactive New York certificate lookup. Confirm the source-native Certificate Number on official NYSDOL / New York Open Data. A certificate number is not a unique legal organization.",
      ["Open /new-york", "Confirm on NYSDOL / New York Open Data"],
      "/new-york",
    );
  }

  if (namedCompany(text) && /\b(registered|registry|certificate)\b/.test(text)) {
    interpretation.entityQuery = query.slice(0, 120);
    interpretation.notes.push("ny-named-company-not-statewide-count");
    return closed(
      query,
      interpretation,
      "A named-company New York registration question is not the statewide public-work certificate total. Confirm the exact identity on official NYSDOL / New York Open Data. Name-only matching is unsafe.",
      ["Open /new-york", "Add the official certificate number"],
      "/new-york",
    );
  }

  const pw = publicWorkContext(text) || (/\bregistry\b/.test(text) && /\bcertificate/.test(text));
  if (countIntent(text) && (pw || (/\bpublic[- ]work\b/.test(text) && /\bcertificate/.test(text)))) {
    if (unsupportedAggregateFilter(text)) {
      interpretation.notes.push("ny-pw-filtered-count-unsupported");
      return closed(
        query,
        interpretation,
        "A filtered New York public-work count is not supported. The dated snapshot total is not an answer to a filtered question. Missing or unacquired filters are not zero.",
        ["Ask for the unfiltered snapshot certificate count", "Open /new-york"],
        "/new-york",
      );
    }
    interpretation.evidenceFamily = "NYSDOL public-work contractor registry";
    interpretation.notes.push("ny-pw-registry-aggregate");
    return {
      version: ASK_CONTRACT_VERSION,
      query,
      mode: "count",
      supported: true,
      interpretation,
      href: "/new-york",
      count: {
        value: NEW_YORK_SNAPSHOT.registry.parsed_rows,
        grain: "public-work contractor registry certificate row in the accepted NYSDOL snapshot",
        caveat:
          "Dated NYSDOL Open Data snapshot. Not live company discovery, not all New York contractors, and not a residential HIC roster.",
      },
      aggregate: null,
      comparison: null,
      failMessage: null,
      changeHints: ["Open /new-york", "Confirm on NYSDOL / New York Open Data"],
    };
  }

  if (pw || /\bregistered\b/.test(text)) {
    interpretation.notes.push("ny-pw-not-live-directory");
    return closed(
      query,
      interpretation,
      "New York public-work registration evidence is a dated statewide snapshot page, not a live browsable company result set. It is not a statewide general-contractor or home-improvement roster.",
      ["Open /new-york", "Ask how many public-work registry certificates are in the snapshot"],
      "/new-york",
    );
  }

  return null;
}
