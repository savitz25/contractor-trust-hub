import { phraseInText } from "./ontology";
import { GA_CEASE_AND_DESIST, GA_CREDENTIAL_CLASSES } from "@/lib/georgia-intelligence/snapshot";
import { ASK_CONTRACT_VERSION, type AskInterpretation, type AskResult } from "./types";

const EMPTY: AskInterpretation = {
  identifier: null,
  entityQuery: null,
  location: "Georgia",
  trade: "Not specified",
  credentialStatus: "Not specified",
  evidenceFamily: "Georgia SOS licensing",
  entityType: "Georgia contractor credential",
  sort: "Default",
  notes: [],
};

export function hasGeorgiaIntent(text: string): boolean {
  return phraseInText(text, "georgia") || phraseInText(text, "goals") || /(^|\s)in ga(?=\s|$)/.test(text);
}

export function interpretGeorgiaSos(query: string, text: string): AskResult | null {
  if (!hasGeorgiaIntent(text)) return null;
  const cease = /cease|desist|unlicensed/.test(text);
  const trade = /electric/.test(text)
    ? "electrical"
    : /plumb/.test(text)
      ? "plumbing"
      : /hvac|conditioned air|air condition/.test(text)
        ? "conditioned air"
        : /general contractor|residential/.test(text)
          ? "residential or commercial general"
          : "statewide contractor credential";
  const interpretation: AskInterpretation = {
    ...EMPTY,
    trade,
    evidenceFamily: cease ? "Georgia SOS cease-and-desist" : "Georgia SOS license class",
    notes: [
      "Paid GOALS rosters are not acquired. A license number must be verified at the official lookup.",
      "Cease-and-desist rows are not joined to licensed profiles.",
    ],
  };
  if (cease) {
    return {
      version: ASK_CONTRACT_VERSION,
      query,
      mode: "guidance",
      supported: true,
      interpretation,
      href: "/georgia",
      count: {
        value: GA_CEASE_AND_DESIST.length,
        grain: "unlicensed-practice cease-and-desist order",
        caveat: "Not a count of licensed Georgia contractors. Not joined to a license record.",
      },
      aggregate: null,
      comparison: null,
      failMessage: null,
      changeHints: ["This count is cease-and-desist orders, not licensed contractors."],
    };
  }
  const acquired = GA_CREDENTIAL_CLASSES.filter((row) => row.coverage === "KNOWN").length;
  return {
    version: ASK_CONTRACT_VERSION,
    query,
    mode: "fail_closed",
    supported: false,
    interpretation,
    href: "/georgia",
    count: null,
    aggregate: null,
    comparison: null,
    failMessage: `Georgia ${trade} license rows are not in this hub. Acquired license-class extracts: ${acquired}. Use the state page and the official GOALS lookup.`,
    changeHints: ["Do not treat a cease-and-desist list as a licensee census."],
  };
}
