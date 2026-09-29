import data from "@/lib/maryland-intelligence/discipline.json";
import { ASK_CONTRACT_VERSION, type AskResult, type AskInterpretation } from "./types";

const STATE = /\b(?:maryland|mhic)\b/i;
const CITY = /\b(?:baltimore|annapolis|frederick|rockville)\b/i;
const TOPIC = /\b(?:contractor|home improvement|licen[sc]e|disciplin|complaint|guaranty fund|electric|plumb|hvac)\b/i;
const LABELED = /\b(?:MHIC(?:\s+(?:contractor\s+)?licen[sc]e)?|maryland\s+(?:contractor\s+)?licen[sc]e)\s*(?:#|number|no\.?|:)?\s*((?:0[15]-)?\d{4,8}(?:-0[1-9])?)\b/i;

export function interpretMaryland(query: string): AskResult | null {
  if (!(STATE.test(query) || (CITY.test(query) && TOPIC.test(query)))) return null;
  const exact = query.match(LABELED)?.[1] ?? null;
  const bare = !exact && /\b\d{4,8}\b/.test(query);
  const discipline = /\b(?:disciplin|order|enforcement)\b/i.test(query);
  const guaranty = /\bguaranty fund\b/i.test(query);
  const complaints = /\bcomplaints?\b/i.test(query);
  const href = exact ? `/maryland?license=${encodeURIComponent(exact)}#licenses` : discipline ? "/maryland#enforcement" : guaranty ? "/maryland#guaranty" : complaints ? "/maryland#complaints" : "/maryland#licenses";
  const interpretation: AskInterpretation = { identifier: exact, entityQuery: null, location: "Maryland", trade: "Not specified", credentialStatus: "Not specified", evidenceFamily: "MHIC active verification and public action tables", entityType: "MHIC credential or standalone action", sort: "Default", notes: ["MD-CON-001: no roster or name-only adverse joins", ...(bare ? ["A bare number is ambiguous; label it as an MHIC license number."] : [])] };
  const body = exact
    ? `Verify MHIC license ${exact} in Maryland Labor's live active-license search. This snapshot has no contractor roster; the disciplinary index lacks exact license identifiers, so no action is attached to this number.`
    : bare ? "A bare number is ambiguous; label it as an MHIC license number to request a license check."
    : guaranty ? `${data.rows.filter((row) => row.guarantyFundAwardDollars !== null).length} public FY2022–FY2025 MHIC rows print a Guaranty Fund award amount. An award is not a license revocation or proof of payment. The rows are not attached to providers without exact license identifiers.`
    : complaints ? "MHIC accepts complaints; closed complaint histories are available by request, while open complaints are not publicly reportable. No provider-level complaint corpus or counts were acquired."
    : discipline ? `${data.rows.length} MHIC action table rows were captured for FY2022–FY2025. Proposed and final decree types remain distinct. The index does not print exact license identifiers, so these actions are standalone.`
    : "Maryland MHIC separately licenses home improvement contractors and salespersons. Verify current contractor status in MHIC's active-license search. Statewide roster and class counts were not acquired; trade credentials are separate.";
  return { version: ASK_CONTRACT_VERSION, query, mode: "guidance", supported: true, interpretation, href, count: null, aggregate: null, comparison: null, failMessage: null, changeHints: ["Use the official MHIC search for current license status."], definition: { title: exact ? `Maryland MHIC license ${exact}` : "Maryland MHIC contractor evidence", body, href } };
}
