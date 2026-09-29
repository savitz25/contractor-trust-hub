import { WI_SNAPSHOT } from "@/lib/wisconsin-intelligence/snapshot";
import { ASK_CONTRACT_VERSION, type AskInterpretation, type AskResult } from "./types";

const STATE = /\b(?:wisconsin|wi\s+dsps|dsps)\b/i;
const CITY = /\b(?:milwaukee|madison|green bay|kenosha)\b/i;
const TOPIC = /\b(?:contractor|dwelling|electric|plumb|hvac|license|credential|disciplin|order|complaint)\b/i;
const LABELED = /\b(?:DSPS|Wisconsin)\s+(?:credential|license)\s*(?:#|number|no\.?|:)?\s*(\d{2,10})\s*-\s*(DC|DCR|DCQ|EC|HVACCONT|HVACQ|ME|JE|PM)\b/i;

export function interpretWisconsin(query: string): AskResult | null {
  if (!(STATE.test(query) || CITY.test(query) && TOPIC.test(query))) return null;
  const match = query.match(LABELED);
  const exact = match ? `${match[1]} - ${match[2].toUpperCase()}` : null;
  const bare = !exact && /\b\d{3,}\b/.test(query);
  const discipline = /\b(?:disciplin|enforcement|order)\b/i.test(query);
  const complaint = /\bcomplaints?\b/i.test(query);
  const href = exact ? `/wisconsin?credential=${encodeURIComponent(exact)}#lookup` : discipline ? "/wisconsin#discipline" : complaint ? "/wisconsin#complaints" : "/wisconsin#credentials";
  const interpretation: AskInterpretation = { identifier: exact, entityQuery: null, location: "Wisconsin", trade: "Not specified", credentialStatus: "Not specified", evidenceFamily: "DSPS monthly class totals and live verification", entityType: "DSPS credential class", sort: "Default", notes: ["No provider roster or exact adverse attachment", ...(bare ? ["A bare number is ambiguous; use the DSPS credential suffix."] : [])] };
  const body = bare ? "A bare number is ambiguous. Supply the exact DSPS credential number and class suffix, then verify its current status with DSPS."
    : exact ? `Verify ${exact} in DSPS LicensE. The published monthly counts are class totals, not licensee rows; no order has been attached to this identifier.`
    : discipline ? "DSPS Search Orders is public, but a bounded 2022–2026 construction-order corpus was not acquired. Not every order is formal discipline; check the original document and current credential status."
    : complaint ? "DSPS accepts trade complaints. No public provider-level complaint corpus or outcomes were acquired; a complaint is not a disciplinary finding."
    : `DSPS publishes separate Dwelling Contractor, Electrical Contractor, HVAC Contractor, qualifier and individual trade classes. The ${WI_SNAPSHOT.sourceDate} class counts are not a deduplicated business directory. Verify the exact credential in LicensE.`;
  return { version: ASK_CONTRACT_VERSION, query, mode: "guidance", supported: true, interpretation, href, count: null, aggregate: null, comparison: null, failMessage: null, changeHints: ["Check DSPS LicensE for current credential status."], definition: { title: exact ? `Wisconsin DSPS credential ${exact}` : "Wisconsin DSPS contractor and trade evidence", body, href } };
}
