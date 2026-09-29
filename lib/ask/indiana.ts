import { IN_DISCIPLINE, IN_PLUMBING_LICENSE, IN_SNAPSHOT } from "@/lib/indiana-intelligence/snapshot";
import { sha256Hex } from "@/lib/indiana-intelligence/sha256";
import { ASK_CONTRACT_VERSION, type AskInterpretation, type AskResult } from "./types";

const STATE = /\b(?:indiana|plumbing commission|ipla)\b/i;
const CITY = /\b(?:indianapolis|fort wayne|evansville|south bend)\b/i;
const TOPIC = /\b(?:contractor|plumb|electric|hvac|licen[sc]e|credential|disciplin|order|complaint|public works|prequalif)/i;
const LOCAL_TRADE = /\b(?:electric\w*|hvac|heating|air condition\w*|general contractor|builder|roof\w*|remodel\w*)\b/i;

export function indianaDisciplineRows(license: string) {
  const digest = sha256Hex(license.replace(/[\s-]+/g, "").toUpperCase());
  return IN_DISCIPLINE.rows.filter((row) => row.licenseSha256 === digest);
}

export function interpretIndiana(query: string): AskResult | null {
  if (!(STATE.test(query) || (CITY.test(query) && TOPIC.test(query)))) return null;
  const match = query.match(IN_PLUMBING_LICENSE);
  const exact = match ? `${match[1].toUpperCase()}${match[2]}` : null;
  const bare = !exact && /\b\d{3,}\b/.test(query);
  const discipline = /\b(?:disciplin\w*|enforcement|orders?|sanction\w*)\b/i.test(query);
  const complaint = /\bcomplaints?\b/i.test(query);
  const publicWorks = /\b(?:public works|prequalif\w*|pre-qualif\w*|state projects?)\b/i.test(query);
  const plumbing = /\bplumb/i.test(query);
  const localTrade = !plumbing && LOCAL_TRADE.test(query);
  const matched = exact ? indianaDisciplineRows(exact) : [];
  const finals = matched.filter((row) => row.category === "final_order").length;
  const href = exact ? `/indiana?license=${encodeURIComponent(exact)}#lookup`
    : discipline ? "/indiana#discipline"
    : complaint ? "/indiana#complaints"
    : publicWorks ? "/indiana#public-works"
    : localTrade ? "/indiana#local-licensing"
    : "/indiana#plumbing";
  const interpretation: AskInterpretation = {
    identifier: exact, entityQuery: null, location: "Indiana", trade: plumbing ? "Plumbing" : "Not specified", credentialStatus: "Not specified",
    evidenceFamily: "PLA Plumbing Commission class totals, live verification and discipline documents", entityType: "PLA plumbing credential class", sort: "Default",
    notes: ["IN-CON-001: plumbing is Indiana's only statewide construction contractor license; no roster or name-only adverse joins", ...(bare ? ["A bare number is ambiguous; use the PLA license prefix (PC, JP, PA or CO) and eight digits."] : [])],
  };
  const body = exact
    ? matched.length
      ? `${matched.length} Indiana Plumbing Commission discipline document${matched.length === 1 ? "" : "s"} dated 2022–2026 carry exactly ${exact} (${finals} final order${finals === 1 ? "" : "s"}; the rest are charging or procedural filings). Check current status in PLA Search & Verify and read the original documents.`
      : `No 2022–2026 Plumbing Commission discipline document in this snapshot carries exactly ${exact}. That is not a clearance and says nothing about current status; verify ${exact} in PLA Search & Verify.`
    : bare ? "A bare number is ambiguous. Supply the PLA plumbing license prefix and number (for example PC followed by eight digits), then verify it with PLA."
    : discipline ? `${IN_DISCIPLINE.summary.documentRows} Plumbing Commission discipline documents dated 2022–2026 were captured (${IN_DISCIPLINE.summary.rowsByCategory.final_order} final orders). Administrative complaints and procedural filings are not findings. Rows attach only by exact license number, never by name.`
    : complaint ? "PLA accepts complaints about licensed professionals. No public provider-level complaint corpus or outcomes were acquired; a complaint is not a disciplinary finding."
    : publicWorks ? "The IDOA Public Works Certification Board prequalifies contractors for state public-works contracts over $150,000. Prequalification is not a contractor license, and no prequalification rows were acquired."
    : localTrade ? "Indiana does not license electrical, HVAC or general contractors statewide; those licenses are issued by cities and counties. ContractorTrustHub has no statewide Indiana roster for them and does not publish local licensing."
    : `${IN_SNAPSHOT.structuralRule} PLA's Plumbing Commission licenses Plumbing Contractors and Journeyman Plumbers (people) and Plumbing Corporations (businesses). Verify an exact license in PLA Search & Verify; class totals are not a contractor census.`;
  return {
    version: ASK_CONTRACT_VERSION, query, mode: "guidance", supported: true, interpretation, href, count: null, aggregate: null, comparison: null, failMessage: null,
    changeHints: ["Check PLA Search & Verify for current license status."],
    definition: { title: exact ? `Indiana plumbing license ${exact}` : "Indiana contractor licensing evidence", body, href },
  };
}
