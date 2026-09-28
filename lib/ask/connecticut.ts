import snapshot from "@/lib/connecticut-intelligence/snapshot.json";
import { ASK_CONTRACT_VERSION, type AskInterpretation, type AskResult } from "./types";

const CT = /\b(?:connecticut|ctdot|ct\s+dcp|ct\s+elicense)\b/i;
const CITY = /\b(?:hartford|new haven|stamford|bridgeport)\b/i;
const TOPIC = /\b(?:contractor|home improvement|new home|electric|plumb|heating|hvac|fire protection|sheet metal|elevator|license|credential|disciplin|enforcement|complaint|guaranty)\b/i;
const FULL_NUMBER = /\b(?:HIC|NHC|ELC|PLM|HTG|SMT|FSP|ELV)\.\d{5,8}(?:[.-][A-Z0-9]+)?\b/i;

export function interpretConnecticut(query: string): AskResult | null {
  const exact = query.match(FULL_NUMBER)?.[0].toUpperCase() ?? null;
  if (!exact && !CT.test(query) && !(CITY.test(query) && TOPIC.test(query))) return null;
  const bare = !exact && /\b\d{3,}\b/.test(query);
  const decision = /disciplin|enforcement|decision|complaint/i.test(query);
  const href = exact ? `/connecticut?credential=${encodeURIComponent(exact)}#credential-lookup` : decision ? "/connecticut#enforcement" : "/connecticut#credentials";
  const interpretation: AskInterpretation = {
    identifier: exact, entityQuery: null, location: "Connecticut", trade: "Not specified", credentialStatus: "Not specified",
    evidenceFamily: "Connecticut DCP eLicense credentials and administrative decisions", entityType: "DCP credential or decision-index row",
    sort: "Default", notes: ["Exact DCP number only; no company-name or adverse name join"],
  };
  const body = bare
    ? "A bare number is ambiguous. Enter the complete DCP credential prefix and number, such as HIC.0123456, then confirm current status in eLicense."
    : exact
      ? `Open exact DCP credential ${exact}. The snapshot includes HIC/new-home current-flag rows and exact-number administrative-decision index matches; other trade credentials require live eLicense verification. A decision is not proof of current license status.`
      : decision
        ? `${snapshot.decisions.length} relevant DCP administrative-decision index rows dated 2022–2026 are linked by exact printed credential number. This is not a complete complaint or enforcement census, and an index row does not establish a particular violation without the document.`
        : "Connecticut DCP publishes a daily-updated statewide eLicense dataset with separate Home Improvement Contractor, New Home Construction Contractor, salesperson and skilled-trade credential classes. Counts are credential rows by exact class and holder type, not a contractor-company total. Verify current status in eLicense.";
  return {
    version: ASK_CONTRACT_VERSION, query, mode: "guidance", supported: true, interpretation, href,
    count: null, aggregate: null, comparison: null, failMessage: null,
    changeHints: ["Use the full DCP credential prefix and number for exact lookup."],
    definition: { title: exact ? `Connecticut DCP credential ${exact}` : "Connecticut DCP contractor credential evidence", body, href },
  };
}
