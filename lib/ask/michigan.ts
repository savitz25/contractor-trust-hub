import discipline from "@/lib/michigan-intelligence/discipline.json";
import { ASK_CONTRACT_VERSION, type AskResult, type AskInterpretation } from "./types";

const CITIES = /\b(?:detroit|grand rapids|lansing|ann arbor)\b/i;
const MI = /\b(?:michigan|mi|bcc|lara)\b/i;
const TOPIC = /\b(?:contractor|builder|roof|siding|waterproof|electric|plumb|mechanical|license|disciplin|enforcement)\b/i;

export function interpretMichigan(query: string): AskResult | null {
  const number = query.match(/\b\d{7,12}\b/)?.[0];
  const exactInReport = number && discipline.rows.some((row) => row.licenseNumber === number);
  if (!exactInReport && !(MI.test(query) || (CITIES.test(query) && TOPIC.test(query)))) return null;
  const interpretation: AskInterpretation = { identifier: number ?? null, entityQuery: null, location: "Michigan", trade: "Not specified", credentialStatus: "Not specified", evidenceFamily: "Michigan BCC public disciplinary reports", entityType: "BCC credential or report event", sort: "Default", notes: ["MI-CON-001 exact report number; no roster-to-business join"] };
  const href = number ? `/michigan?license=${number}#enforcement` : /disciplin|enforcement/i.test(query) ? "/michigan#enforcement" : "/michigan#licenses";
  const body = number
    ? `Check the exact printed number ${number} against the BCC disciplinary report extraction. A report match is an action on a credential, not proof of a current license or a match to a canonical company. Confirm current status in BCC Accela.`
    : "Michigan BCC has separate individual and company residential builder and maintenance and alteration licenses, plus skilled-trade licenses. Public FY2022–FY2026 disciplinary reports are indexed by exact printed number. Statewide license rosters and class counts were not acquired; verify current status in BCC Accela.";
  return { version: ASK_CONTRACT_VERSION, query, mode: "guidance", supported: true, interpretation, href, count: null, aggregate: null, comparison: null, failMessage: null, changeHints: ["Use the exact printed license number for disciplinary lookup."], definition: { title: number ? `Michigan BCC credential ${number}` : "Michigan BCC contractor license and disciplinary evidence", body, href } };
}
