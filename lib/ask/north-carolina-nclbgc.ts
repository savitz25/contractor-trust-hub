import { phraseInText } from "./ontology";
import { NORTH_CAROLINA_SNAPSHOT } from "@/lib/north-carolina-intelligence/snapshot";
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
  extra?: Partial<AskResult>,
): AskResult {
  return {
    version: ASK_CONTRACT_VERSION,
    query,
    mode: "fail_closed",
    supported: false,
    interpretation,
    href: "/north-carolina",
    count: null,
    aggregate: null,
    comparison: null,
    failMessage,
    changeHints,
    ...extra,
  };
}

export function hasNorthCarolinaIntent(text: string): boolean {
  const namedCity = /\b(charlotte|raleigh|mecklenburg|durham)\b/.test(text) && /\b(contractor|nclbgc|license|licensed)\b/.test(text);
  return (
    phraseInText(text, "north carolina") ||
    phraseInText(text, "nclbgc") ||
    phraseInText(text, "ncbeec") ||
    namedCity ||
    /(^|\s)in nc(?=\s|$)/.test(text) ||
    /\bnc licensing board\b/.test(text)
  );
}

export function parseNcNclbgcNumber(query: string, text: string): string | null {
  const labeled = query.match(/\b(?:nclbgc|license(?:\s+number)?|contractor license)\s*#?\s*(?:l\.?)?\s*(\d{4,6})\b/i);
  const dotted = query.match(/\bL\.(\d{4,6})\b/i);
  const raw = labeled?.[1] || dotted?.[1];
  if (!raw) return null;
  if (!hasNorthCarolinaIntent(text) && !/\bnclbgc\b|\bL\.\d/i.test(query)) return null;
  return `L.${raw}`;
}

export function interpretNorthCarolinaNclbgc(query: string, text: string): AskResult | null {
  const license = parseNcNclbgcNumber(query, text);
  const local = /\b(charlotte|raleigh|mecklenburg|wake|durham)\b/.test(text);
  const nc = hasNorthCarolinaIntent(text) || Boolean(license);
  if (!nc) return null;

  const interpretation: AskInterpretation = {
    ...EMPTY,
    location: "North Carolina",
    identifier: license,
    notes: ["nc-nclbgc-state-intelligence"],
  };

  if (/\bbest\b|\bsafest\b|\btrust score\b|\brecommended\b/.test(text)) {
    return closed(query, interpretation, "ContractorTrustHub does not rank best or safest North Carolina contractors and does not publish a Trust Score.", ["Use /north-carolina for official-source research"]);
  }
  if (license) {
    return closed(
      query,
      { ...interpretation, evidenceFamily: "NCLBGC license identity" },
      `${license} is an NCLBGC license-number identity. Exact license outranks geography. Confirm current status, classification, limitation, qualifier, and any 2022+ profile-linked disciplinary documents on the official NCLBGC search. A qualifier is not the licensed business.`,
      ["Open NCLBGC Licensee and Qualifier Search"],
    );
  }
  if (local && /\b(contractor|nclbgc|license)/.test(text)) {
    return closed(query, interpretation, "North Carolina contractor intelligence on this hub is statewide only. Charlotte, Raleigh, Mecklenburg, and Wake are not local intelligence routes in this ticket. Verify licenses on NCLBGC / NCBEEC / PHFS search. Permits are local and fragmented.", ["Stay on /north-carolina"]);
  }
  if (/\bunlicensed\b/.test(text)) {
    return closed(query, interpretation, `NCLBGC unlicensed injunctions are a separate grain from licensed discipline. Spring 2026 Board PDF: ${NORTH_CAROLINA_SNAPSHOT.unlicensed.NC_NCLBGC_UNLICENSED_UNIQUE_CASES} unique cases. An unlicensed respondent is not an NCLBGC licensee. Name-only attachment is unsafe.`, ["Read /north-carolina unlicensed section"]);
  }
  if (/\bdisciplin|consent order|final decision|complaint/.test(text)) {
    return closed(query, interpretation, "NCLBGC profile-linked Consent Orders and Final Decisions cover complaints filed in 2022 or later that resulted in discipline. No link is not a clean history. A complaint is not discipline. Statewide profile-link census was not acquired. Recent licensed case-summary PDFs name 49 distinct licenses in two periods only.", ["Open /north-carolina discipline section"]);
  }
  if (/\belectrical|electrician/.test(text)) {
    return closed(query, interpretation, "North Carolina electrical contractors are licensed by NCBEEC, not NCLBGC. Current electrical roster is OPEN_SEARCH_ONLY (not zero). Person records are not business counts. Paid listings were not purchased.", ["Use NCBEEC active-license search"]);
  }
  if (/\bplumb/.test(text)) {
    return closed(query, interpretation, "North Carolina plumbers are licensed by the Plumbing, Heating & Fire Sprinkler Board, not NCLBGC. Contractor classes are not technician classes. Roster is OPEN_SEARCH_ONLY.", ["Use PHFS license search"]);
  }
  if (/\bhvac|heating|air condition/.test(text)) {
    return closed(query, interpretation, "North Carolina HVAC/heating contractors are a PHFS board class, not NCLBGC general contractors. Heating groups stay separate from plumbing and fire sprinkler. Roster is OPEN_SEARCH_ONLY.", ["Use PHFS license search"]);
  }
  if (/\bfire sprinkler/.test(text)) {
    return closed(query, interpretation, "Fire sprinkler installation/inspection/residential classes are PHFS board credentials, not NCLBGC specialty S(Roofing) or Building. Roster is OPEN_SEARCH_ONLY.", ["Use PHFS license search"]);
  }
  if (/\bdebar/.test(text)) {
    return closed(query, interpretation, `NC DOA lists ${NORTH_CAROLINA_SNAPSHOT.doa_debarment.NC_DOA_DEBARRED_VENDOR_ROWS} debarred-vendor rows last revised 2021-06-01. That is procurement debarment, not NCLBGC discipline. No later revision is not currently verified clean. Name-only joins are unsafe.`, ["Open /north-carolina debarment section"]);
  }
  if (/\bunlimited\b/.test(text) && /\b(contractor|license)/.test(text)) {
    return closed(query, interpretation, "Unlimited is an NCLBGC project-value limitation (no single-project ceiling), not a quality rank or TrustHub winner. Limited is up to $750,000. Intermediate is up to $1,500,000. Limitation is not experience.", ["Read /north-carolina limitations"]);
  }
  if (/\blimited\b/.test(text) && /\b(contractor|license)/.test(text) && !/\brestricted limited plumbing/.test(text)) {
    return closed(query, interpretation, "Limited is an NCLBGC single-project authorization up to $750,000, excluding land. It is not a quality or inexperience label. Current NCLBGC Limited counts are search-only, not zero.", ["Read /north-carolina limitations"]);
  }
  if (/\bspecialty roofing|s\(roofing\)|roofing classification/.test(text)) {
    return closed(query, interpretation, "S(Roofing) is one NCLBGC specialty classification. Building and Residential classifications can also authorize roofing within their scope. This is not a complete roofing-contractor census.", ["Read /north-carolina roofing semantics"]);
  }
  if (/\broof/.test(text)) {
    return closed(query, interpretation, "North Carolina roofing is not limited to S(Roofing) specialty rows. Building and Residential NCLBGC classifications can encompass roofing. Do not manufacture all roofers in NC. Current roster is OPEN_SEARCH_ONLY.", ["Read /north-carolina roofing semantics"]);
  }
  if (/\bresidential contractor/.test(text)) {
    return closed(query, interpretation, "Residential is an NCLBGC classification, not a quality tier. It can include certain residential specialty work. Current Residential counts are search-only, not zero. A qualifier is not the licensed business.", ["Open NCLBGC search"]);
  }
  if (/\bbuilding contractor/.test(text)) {
    return closed(query, interpretation, "Building is an NCLBGC classification covering commercial, industrial, institutional, and residential building work, including some specialty work such as roofing. It is not exclusive of other trades. Current counts are search-only.", ["Open NCLBGC search"]);
  }
  if (/\bgeneral contractor|nclbgc|licensed contractor|contractors north carolina|contractor license/.test(text)) {
    return closed(
      query,
      interpretation,
      "North Carolina requires an NCLBGC general-contractor license when total project cost is $40,000 or more. That is not every construction job. Current NCLBGC licensee/qualifier search is OPEN_SEARCH_ONLY — not zero and not the mixed ~38,523 Board-news figure. Electrical and PHFS boards are separate. No combined North Carolina contractors total.",
      ["Use /north-carolina and official board search"],
    );
  }
  return closed(query, interpretation, "North Carolina contractor research is on /north-carolina. Current NCLBGC, NCBEEC, and PHFS bulk rosters are search-only. Search-only is not zero.", ["Open /north-carolina"]);
}
