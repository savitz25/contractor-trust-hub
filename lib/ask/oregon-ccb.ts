import { GEO_ONTOLOGY, phraseInText } from "./ontology";
import { OREGON_SNAPSHOT } from "@/lib/oregon-intelligence/snapshot";
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
  extra?: Partial<AskResult>,
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
    ...extra,
  };
}

export function hasOregonIntent(text: string): boolean {
  return (
    phraseInText(text, "oregon") ||
    phraseInText(text, "ccb") ||
    phraseInText(text, "oregon ccb") ||
    phraseInText(text, "portland") ||
    phraseInText(text, "multnomah") ||
    (/\bfinal order/.test(text) && /\b(trade license|bcd)\b/.test(text))
  );
}

function parseOrCcbNumber(query: string): string | null {
  const m = query.match(/\bccb(?:\s+license)?\s*#?\s*(\d{5,8})\b/i);
  if (m) return m[1];
  const labeled = query.match(/\b(?:oregon\s+)?(?:ccb\s+)?license\s+#?\s*(\d{5,8})\b/i);
  if (labeled && /\b(oregon|ccb)\b/i.test(query)) return labeled[1];
  return null;
}

export function interpretOregonCcb(query: string, text: string): AskResult | null {
  const ccbNumber = parseOrCcbNumber(query);
  if (!hasOregonIntent(text) && !ccbNumber) return null;
  const interpretation: AskInterpretation = {
    ...EMPTY,
    location: "Oregon",
    identifier: ccbNumber,
    notes: ["or-ccb-state-intelligence"],
  };

  if (ccbNumber && /\bcomplaint/.test(text)) {
    return closed(
      query,
      { ...interpretation, evidenceFamily: "Oregon CCB complaint history — search only" },
      `CCB license ${ccbNumber} complaint history is official CCB license-search, not an acquired bulk table. Missing bulk is not a clean history. Complaint is not discipline.`,
      ["Open official CCB license search", "Open Oregon contractor research"],
      "/oregon",
    );
  }
  if (ccbNumber && /\bdisciplin/.test(text)) {
    return closed(
      query,
      { ...interpretation, evidenceFamily: "Oregon CCB disciplinary history — search only" },
      `CCB license ${ccbNumber} disciplinary history is official CCB license-search. Discipline is not a complaint count and not a conviction. Absence of an acquired table is not a clean record.`,
      ["Open official CCB license search", "Open Oregon contractor research"],
      "/oregon",
    );
  }
  if (ccbNumber && /\bfinal order/.test(text)) {
    return closed(
      query,
      { ...interpretation, evidenceFamily: "BCD final order — structured dataset not acquired" },
      "BCD final orders are posted on an official interactive table for three years after closure. No bulk extract was acquired. A final order is not a conviction. Related cases are not extra violations.",
      ["Open BCD final orders", "Open Oregon contractor research"],
      "/oregon",
    );
  }
  if (ccbNumber) {
    return {
      version: ASK_CONTRACT_VERSION,
      query,
      mode: "entity",
      supported: true,
      interpretation: { ...interpretation, notes: ["or-ccb-exact-id"] },
      href: "/oregon",
      count: null,
      aggregate: null,
      comparison: null,
      failMessage: `Exact CCB license ${ccbNumber} is verified on the official Oregon CCB search. This hub does not substitute a Florida credential lookup. A CCB number is not a BCD trade license.`,
      changeHints: ["Open official CCB license search"],
    };
  }

  if (/\b(best|safest|top[- ]?rated|most trusted|recommended)\b/.test(text)) {
    return closed(
      query,
      interpretation,
      "ContractorTrustHub does not rank Oregon contractors and does not publish a Trust Score.",
      ["Open Oregon contractor research"],
      "/oregon",
    );
  }
  if (/\bportland\b|\bmultnomah\b/.test(text) && /\b(serving|best|local page|city page)\b/.test(text)) {
    return closed(
      query,
      interpretation,
      "This ticket publishes statewide Oregon CCB/BCD research. Portland and Multnomah County are not separate intelligence routes.",
      ["Open Oregon contractor research"],
      "/oregon",
    );
  }
  if (/\bdisciplin/.test(text) && !/\bcomplaint/.test(text)) {
    return closed(
      query,
      { ...interpretation, evidenceFamily: "Oregon CCB disciplinary history — search only" },
      "Oregon CCB disciplinary history is official license-search, not an acquired bulk table. Discipline is not a complaint. Missing bulk is not a clean history.",
      ["Open Oregon contractor research", "CCB license search"],
      "/oregon",
    );
  }
  if (/\bfinal order/.test(text)) {
    return closed(
      query,
      { ...interpretation, evidenceFamily: "BCD final order — structured dataset not acquired" },
      "BCD final orders remain on an official interactive table. No bulk extract was acquired. A final order is not a conviction. Unknown is not zero matters.",
      ["Open BCD final orders", "Open Oregon contractor research"],
      "/oregon",
    );
  }
  if (/\bcomplaint/.test(text) && !/\bdiscipline|final order|debar/.test(text)) {
    return closed(
      query,
      { ...interpretation, evidenceFamily: "Oregon CCB complaint history — search only" },
      "Oregon CCB complaint history is official license-search, not an acquired bulk table. Missing bulk complaints is not zero complaints. Complaint is not discipline. Federal or Florida complaint grains are not a substitute.",
      ["Open Oregon contractor research", "CCB license search"],
      "/oregon",
    );
  }
  if (/\bhow many\b/.test(text) && /\b(bcd|electrical contractor|plumbing contractor)\b/.test(text) && /\bbusiness\b/.test(text)) {
    return {
      version: ASK_CONTRACT_VERSION,
      query,
      mode: "count",
      supported: true,
      interpretation: { ...interpretation, notes: ["or-bcd-business"] },
      href: "/oregon",
      count: {
        value: OREGON_SNAPSHOT.bcd.ENTITY_GRAIN_DISTINCT_IDS.BUSINESS,
        grain: "BCD business/contractor credential IDs — not CCB and not person credentials",
        caveat: "Not added to CCB license IDs. Person and inspector credentials excluded.",
      },
      aggregate: null,
      comparison: null,
      failMessage: null,
      changeHints: [],
    };
  }
  if (/\bhow many\b/.test(text) && /\b(ccb license identit|active ccb license identit|distinct ccb)\b/.test(text)) {
    return {
      version: ASK_CONTRACT_VERSION,
      query,
      mode: "count",
      supported: true,
      interpretation: { ...interpretation, notes: ["or-ccb-distinct-ids"] },
      href: "/oregon",
      count: {
        value: OREGON_SNAPSHOT.ccb.DISTINCT_NONEMPTY_LICENSE_IDS,
        grain: "Distinct CCB active license IDs — not unique companies and not BCD credentials",
        caveat: "Endorsement rows can repeat a license_number. Not unique companies.",
      },
      aggregate: null,
      comparison: null,
      failMessage: null,
      changeHints: [],
    };
  }
  if (/\bhow many\b/.test(text) && /\b(contractor|ccb|licensed)\b/.test(text)) {
    if (/\bcompan(y|ies)\b/.test(text) || /\bunique businesses\b/.test(text)) {
      return closed(
        query,
        interpretation,
        "Oregon CCB active licenses are not unique companies. The snapshot headline is distinct license IDs, not a company census.",
        ["Open Oregon contractor research"],
        "/oregon",
      );
    }
    return {
      version: ASK_CONTRACT_VERSION,
      query,
      mode: "count",
      supported: true,
      interpretation: { ...interpretation, notes: ["or-ccb-distinct-ids"] },
      href: "/oregon",
      count: {
        value: OREGON_SNAPSHOT.ccb.DISTINCT_NONEMPTY_LICENSE_IDS,
        grain: "Distinct CCB active license IDs — not unique companies and not BCD credentials",
        caveat: "Endorsement rows can repeat a license_number. Not unique companies.",
      },
      aggregate: null,
      comparison: null,
      failMessage: null,
      changeHints: [],
    };
  }
  if (/\blicensed in oregon\b|\boregon contractor\b|\bccb\b|\bbcd\b/.test(text) || GEO_ONTOLOGY.some((g) => g.id === "or" && g.phrases.some((p) => phraseInText(text, p)))) {
    return closed(
      query,
      interpretation,
      "Oregon contractor licensing is CCB for construction contractors and BCD for trade credentials. Confirm a labeled CCB or BCD number on the official search. A USDOT or out-of-state license is not Oregon CCB authority.",
      ["Open Oregon contractor research"],
      "/oregon",
    );
  }
  return null;
}
