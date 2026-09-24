import { phraseInText } from "./ontology";
import summary from "@/lib/massachusetts-intelligence/summary.json";
import { MA_CSL_LOOKUP, MA_HIC_SEARCH } from "@/lib/massachusetts-intelligence/publication";
import { ASK_CONTRACT_VERSION, type AskInterpretation, type AskResult } from "./types";

// MA-CON-001. Counts only (summary.json); discipline rows stay on the server-rendered /massachusetts page.
// HIC, CSL, trade licenses, DCAMM, and debarment are separate systems. No combined contractor count.

const EMPTY: AskInterpretation = {
  identifier: null,
  entityQuery: null,
  location: "Massachusetts",
  trade: "Not specified",
  credentialStatus: "Not specified",
  evidenceFamily: "Massachusetts statewide credentials",
  entityType: "Massachusetts contractor credential",
  sort: "Default",
  notes: [],
};

function result(query: string, interpretation: AskInterpretation, extra: Partial<AskResult>): AskResult {
  return {
    version: ASK_CONTRACT_VERSION,
    query,
    mode: "fail_closed",
    supported: false,
    interpretation,
    href: "/massachusetts",
    count: null,
    aggregate: null,
    comparison: null,
    failMessage: null,
    changeHints: [],
    ...extra,
  };
}

export function hasMassachusettsIntent(text: string): boolean {
  return (
    phraseInText(text, "massachusetts") ||
    phraseInText(text, "boston") ||
    phraseInText(text, "worcester") ||
    phraseInText(text, "dcamm") ||
    phraseInText(text, "ma contractor hub") ||
    phraseInText(text, "construction supervisor") ||
    phraseInText(text, "csl") ||
    phraseInText(text, "hic") ||
    /(^|\s)in ma(?=\s|$)/.test(text)
  );
}

const TRADE_RE = /\b(electrician|electrical|plumber|plumbing|gas ?fitter|gasfitter|sheet metal)\b/;

function tradeBoards(text: string): { label: string; boards: Array<keyof typeof summary.dolRowsByBoard> } | null {
  const m = text.match(TRADE_RE)?.[1] ?? "";
  if (/electric/.test(m)) return { label: "electrician", boards: ["EL"] };
  if (/plumb|gas/.test(m)) return { label: "plumber and gas fitter", boards: ["PL", "GF"] };
  if (/sheet/.test(m)) return { label: "sheet metal", boards: ["SM"] };
  return null;
}

export function interpretMassachusetts(query: string, text: string): AskResult | null {
  if (!hasMassachusettsIntent(text)) return null;
  const interpretation: AskInterpretation = { ...EMPTY, notes: ["ma-con-001-state-intelligence"] };
  const trade = tradeBoards(text);

  // Exact identifiers first. HIC and CSL rows are not in this hub, so the lookup is the official one.
  const hic = query.match(/\bhic\b(?:\s+registration)?(?:\s+(?:no\.?|number|#))?\s*#?\s*(\d{4,8})\b/i)?.[1];
  if (hic) {
    return result(query, { ...interpretation, identifier: `MA-HIC:${hic}`, evidenceFamily: "Massachusetts HIC registration" }, {
      href: MA_HIC_SEARCH,
      failMessage: `HIC registration ${hic}: Massachusetts HIC rows are not stored in this hub (no bulk roster is published). Check the number on the MA Contractor Hub, which shows registration status, expiration, complaints, arbitration outcomes, and Guaranty Fund payouts. Not found here does not mean unregistered.`,
      changeHints: ["An HIC registration is not a Construction Supervisor License."],
    });
  }
  const csl = query.match(/\b(?:csl|construction supervisor(?: license)?)(?:\s+(?:no\.?|number|#))?\s*#?\s*((?:cs-?)?\d{4,8})\b/i)?.[1];
  if (csl) {
    return result(query, { ...interpretation, identifier: `MA-CSL:${csl.toUpperCase()}`, evidenceFamily: "Massachusetts Construction Supervisor License" }, {
      href: MA_CSL_LOOKUP,
      failMessage: `CSL ${csl.toUpperCase()}: Construction Supervisor License rows are not stored in this hub. Verify the number on the DOL License Verification Site. A CSL is not an HIC registration.`,
      changeHints: ["Check HIC registration separately for residential home-improvement work."],
    });
  }
  const tradeLicense = trade ? query.match(/\b(?:license|lic\.?|#|no\.?|number)\s*#?\s*([A-Za-z]?\d{2,7}(?:-[A-Za-z])?)\b/i)?.[1] : undefined;
  if (trade && tradeLicense) {
    // Guidance, not "entity": entity mode would run the provider-catalog identifier query.
    const license = tradeLicense.toUpperCase();
    const href = `/massachusetts?license=${encodeURIComponent(license)}&board=${trade.boards.join(",")}#dol-lookup`;
    return result(query, { ...interpretation, identifier: `MA-DOL:${license}`, trade: trade.label, evidenceFamily: "Massachusetts DOL license number" }, {
      mode: "guidance",
      supported: true,
      href,
      definition: {
        title: `Massachusetts ${trade.label} license ${license}`,
        body: `Open the exact license-number match against DOL ${trade.label} discipline rows (${summary.dolWindow}) on the Massachusetts page. No match there is not a clean record; verify the license itself with DOL. A person's license is not a contractor business.`,
        href,
      },
      changeHints: ["Exact license number only; no name matching."],
    });
  }

  const discipline = /\b(disciplin|enforcement|revoked|revocation|suspend|sanction|fine|fined|violation)/.test(text);
  const debarred = /\bdebar/.test(text);
  const complaint = /\b(complaint|arbitration|guaranty fund)/.test(text);

  if (debarred) {
    // Not `aggregate`: the shared Ask table captions aggregates as active/current credential rows.
    const lines = [
      `DCAMM suspended or debarred parties (public contracting): ${summary.dcammRows}`,
      `AG Fair Labor debarment list rows, all years: ${summary.agRows} (${summary.agRowsCoveringRetrievalDate} have a period covering ${summary.retrievalDate})`,
    ];
    return result(query, { ...interpretation, evidenceFamily: "Massachusetts public-contracting and labor debarment" }, {
      mode: "guidance",
      supported: true,
      href: "/massachusetts#dcamm",
      definition: {
        title: "Massachusetts debarment lists (separate sources, not added together)",
        body: `${lines.join(" · ")}. Debarment restricts public contracts; it is not an HIC or trade-license action. Names are not matched to contractor profiles.`,
        href: "/massachusetts#dcamm",
      },
      changeHints: ["Debarment is not licensing discipline."],
    });
  }
  if (complaint && !discipline) {
    return result(query, { ...interpretation, evidenceFamily: "Massachusetts HIC complaints" }, {
      href: MA_HIC_SEARCH,
      failMessage:
        "Massachusetts HIC complaints, arbitration, and Guaranty Fund claims are filed through the MA Contractor Hub. The Hub shows them per contractor, but no bulk outcome data is published, so this hub has none. A complaint is not a finding; arbitration is not discipline; a Guaranty Fund payment is not a revocation.",
      changeHints: ["Look up the contractor's HIC registration on the MA Contractor Hub."],
    });
  }
  if (discipline) {
    const lines = trade
      ? [`DOL ${trade.label} discipline rows, ${summary.dolWindow}: ${trade.boards.reduce((n, b) => n + summary.dolRowsByBoard[b], 0)}`]
      : [
          `DOL electrician discipline rows, ${summary.dolWindow}: ${summary.dolRowsByBoard.EL}`,
          `DOL plumber and gas fitter discipline rows, ${summary.dolWindow}: ${summary.dolRowsByBoard.PL + summary.dolRowsByBoard.GF}`,
          `DOL sheet metal discipline rows, ${summary.dolWindow}: ${summary.dolRowsByBoard.SM}`,
          `DCAMM suspended or debarred parties: ${summary.dcammRows}`,
          `AG Fair Labor debarment list rows, all years: ${summary.agRows}`,
        ];
    return result(query, { ...interpretation, trade: trade?.label ?? "Not specified", evidenceFamily: "Massachusetts regulatory evidence" }, {
      mode: "guidance",
      supported: true,
      href: "/massachusetts#dol",
      definition: {
        title: "Massachusetts regulatory records (each source separate, never summed)",
        body: `${lines.join(" · ")}. A DOL row is one complaint and license as DOL published it; a licensed person is not automatically a contractor business. HIC discipline is not acquired. Records are not attached to contractor profiles by name.`,
        href: "/massachusetts#dol",
      },
      changeHints: ["Enter a license number to see exact matches on /massachusetts."],
    });
  }
  if (/\b(csl|construction supervisor)/.test(text)) {
    return result(query, { ...interpretation, evidenceFamily: "Massachusetts Construction Supervisor License" }, {
      href: MA_CSL_LOOKUP,
      failMessage:
        "The Construction Supervisor License (CSL) is an individual DOL license for supervising building work under the State Building Code. It is not an HIC registration. CSL lookup is available on the DOL License Verification Site; no bulk CSL roster was acquired, so this hub has no CSL count.",
      changeHints: ["Residential home-improvement work may also need an HIC registration."],
    });
  }
  if (trade) {
    return result(query, { ...interpretation, trade: trade.label, evidenceFamily: "Massachusetts DOL trade license" }, {
      failMessage: `Massachusetts ${trade.label} licenses are DOL licenses, mostly held by individuals. No bulk license roster was acquired, so this hub has no licensee count. Verify a license with DOL. This hub does have DOL ${trade.label} discipline rows (${trade.boards.reduce((n, b) => n + summary.dolRowsByBoard[b], 0)} rows, ${summary.dolWindow}).`,
      changeHints: ["Ask for discipline, or enter the license number."],
    });
  }
  if (/\b(boston|worcester|springfield)\b/.test(text)) {
    return result(query, { ...interpretation, location: text.match(/\b(boston|worcester|springfield)\b/)?.[1] ?? "Massachusetts" }, {
      failMessage:
        "Massachusetts contractor credentials are statewide: HIC registration, Construction Supervisor License, and DOL trade licenses. Boston, Worcester, and Springfield do not have separate pages here, and a city is not a license system. The MA Contractor Hub HIC search can filter by city.",
      changeHints: ["Search by HIC registration number or trade license number instead."],
    });
  }
  return result(query, { ...interpretation, evidenceFamily: "Massachusetts HIC registration" }, {
    href: "/massachusetts",
    failMessage:
      "Massachusetts has no single contractor license. Residential home-improvement contractors register under the HIC program; building construction is supervised by a Construction Supervisor License holder; electricians, plumbers, and gas fitters hold separate DOL licenses. No bulk HIC or CSL roster is published, so this hub has no count of Massachusetts contractors. Check an HIC registration on the MA Contractor Hub.",
    changeHints: ["Try an HIC registration number, a CSL number, or ask for DOL discipline."],
  });
}
