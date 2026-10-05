import { alabamaLicenseInText } from "@/lib/alabama-intelligence/lookup";
import { AL_SNAPSHOT } from "@/lib/alabama-intelligence/snapshot";
import { ASK_CONTRACT_VERSION, type AskInterpretation, type AskResult } from "./types";

const STATE = /\b(?:alabama|albgc|licensing board for general contractors)\b/i;
const CITY = /\b(?:birmingham|montgomery|huntsville|tuscaloosa)\b|\bmobile,\s*alabama\b|\bmobile alabama\b/i;
const TOPIC = /\b(?:contractor|licen[sc]e|albgc|subcontractor|builder|electric|hvac|plumb|specialty|bid limit|roster)\b/i;

const fmt = (n: number) => n.toLocaleString("en-US");

export function interpretAlabama(query: string): AskResult | null {
  const state = STATE.test(query);
  const city = CITY.test(query);
  if (!(state || (city && TOPIC.test(query)))) return null;
  const row = alabamaLicenseInText(query);
  const discipline = /\b(?:disciplin\w*|enforcement|sanction\w*|complaint\w*)\b/i.test(query);
  const otherBoard = /\b(?:home\s*builder|electrical|electrician|hvac|heating|air condition\w*|plumb\w*|gas fitter)\b/i.test(query);
  const sub = /\bsubcontract/i.test(query);
  const prime = /\bprime\b/i.test(query);
  const bid = /\bbid limit\b/i.test(query);
  const href = row
    ? `/alabama?license=${encodeURIComponent(row.license)}#lookup`
    : otherBoard
      ? "/alabama#other-boards"
      : sub
        ? "/alabama#specialty"
        : bid
          ? "/alabama#bid-limit"
          : "/alabama";
  const interpretation: AskInterpretation = {
    identifier: row?.license ?? null,
    entityQuery: null,
    location: "Alabama",
    trade: "Not specified",
    credentialStatus: "Not specified",
    evidenceFamily: "ALBGC FullRosterReport license rows",
    entityType: "ALBGC license row",
    sort: "Default",
    notes: [
      "AL-CON-001: one board, the Licensing Board for General Contractors. Other statewide contractor boards are separate and were not acquired.",
      "The Name column is not labelled business or person. Bid limit is not a license class. There is no status column.",
    ],
  };
  const population = `${fmt(AL_SNAPSHOT.rows)} Alabama Licensing Board for General Contractors license rows were retrieved ${AL_SNAPSHOT.source.retrievedAt} (${fmt(AL_SNAPSHOT.distinctLicenses)} distinct license numbers). ${fmt(AL_SNAPSHOT.explicitSubcontractorSpecialtyRows)} rows have specialty text containing SUBCONTRACTOR. The other ${fmt(AL_SNAPSHOT.unclassifiedRows)} rows are not labelled prime contractors. ${fmt(AL_SNAPSHOT.inactiveSpecialtyRows)} of those have specialty text exactly INACTIVE. This is not a count of all Alabama contractors.`;
  const body = row
    ? `${row.license} is ${row.name}. Specialty text: ${row.specialty || "blank"}. Bid limit: ${row.bidLimit || "blank in source"}. Expiration date ${row.expiration} is printed on the row and is not a status. ${/SUBCONTRACTOR/i.test(row.specialty) ? "The specialty text labels this row as a subcontractor." : "The specialty text does not label this row as a subcontractor."} A name match is not an identity match.`
    : discipline
      ? "No ALBGC discipline or complaint file was acquired. A missing enforcement file is not a clear record."
      : otherBoard
        ? `Electrical, HVAC, plumbing, and home-builder words inside an ALBGC specialty are ALBGC classification text. The Electrical Contractors Board, the HVAC Board, the Plumbers and Gas Fitters Board, and the Home Builders Licensure Board are separate statewide sources. Their rosters were not acquired, so their row counts are unknown, not zero. ${population}`
        : prime
          ? `The ALBGC roster does not label a prime-contractor class. ${population}`
          : sub
            ? `${fmt(AL_SNAPSHOT.explicitSubcontractorSpecialtyRows)} rows are source-labelled subcontractors because the specialty field contains SUBCONTRACTOR. Three company names contain that word and are not in that count, because their specialty text does not. ${population}`
            : bid
              ? "Bid limit is a separate attribute on the ALBGC row (including blank and U UNLIMITED). It is not a license class and it is not revenue."
              : population;
  return {
    version: ASK_CONTRACT_VERSION,
    query,
    mode: "guidance",
    supported: true,
    interpretation,
    href,
    count: null,
    aggregate: null,
    comparison: null,
    failMessage: null,
    changeHints: ["Open the Alabama page and check the exact ALBGC license number."],
    definition: { title: row ? `ALBGC license ${row.license}` : "Alabama Licensing Board for General Contractors", body, href },
  };
}
