/**
 * Deterministic Ask interpreter. No LLM facts. Fail closed on unsupported grains.
 */
import type { ContractorHubIntelV2 } from "@/lib/home/intel-v2";
import {
  COMPLAINT_PHRASES,
  EVIDENCE_ONTOLOGY,
  GEO_ONTOLOGY,
  MOST_PHRASES,
  RATE_PHRASES,
  TRADE_ONTOLOGY,
  findLongestPhrase,
  normalizeAskText,
  phraseInText,
} from "./ontology";
import { ASK_CONTRACT_VERSION, type AskInterpretation, type AskResult } from "./types";

const EMPTY_INTERPRET: AskInterpretation = {
  location: "Not specified",
  trade: "Not specified",
  credentialStatus: "Not specified",
  evidenceFamily: "Not specified",
  entityType: "Contractor credential / identity",
  sort: "Default",
  notes: [],
};

export const ASK_EXAMPLES = [
  "Show me active roofing contractors in Broward County.",
  "Find Florida general contractors with DBPR discipline records.",
  "Which contractor trades have the most active Florida-mapped credentials?",
  "Show contractors with Florida stop-work records.",
  "Compare roofing credentials in Broward and Palm Beach.",
  "Find active HVAC contractors in Palm Beach County.",
] as const;

export const ASK_CHIPS = [
  { id: "status", label: "License status", prompt: "What does an active/current credential mean?" },
  { id: "roofing", label: "Roofing", prompt: "Show me active roofing contractors in Broward County." },
  { id: "hvac", label: "HVAC", prompt: "Find active HVAC contractors in Palm Beach County." },
  { id: "general", label: "General contractors", prompt: "Find Florida general contractors with DBPR discipline records." },
  { id: "history", label: "Regulatory history", prompt: "Show contractors with Florida stop-work records." },
  { id: "discipline", label: "DBPR discipline", prompt: "Find Florida general contractors with DBPR discipline records." },
  { id: "ula", label: "Unlicensed activity", prompt: "Show Florida unlicensed activity records." },
  { id: "stop", label: "Stop-work", prompt: "Show contractors with Florida stop-work records." },
  { id: "broward", label: "Broward", prompt: "Show me active roofing contractors in Broward County." },
  { id: "pbc", label: "Palm Beach", prompt: "Find active HVAC contractors in Palm Beach County." },
  { id: "compare", label: "Compare markets", prompt: "Compare roofing credentials in Broward and Palm Beach." },
] as const;

function includesAny(text: string, phrases: string[]): boolean {
  return phrases.some((p) => phraseInText(text, p));
}

export function interpretAskQuery(raw: string, intel: ContractorHubIntelV2): AskResult {
  const query = raw.trim();
  const text = normalizeAskText(query);
  const interpretation: AskInterpretation = { ...EMPTY_INTERPRET, notes: [] };

  if (!text) {
    return {
      version: ASK_CONTRACT_VERSION,
      query,
      mode: "fail_closed",
      supported: false,
      interpretation,
      href: null,
      count: null,
      aggregate: null,
      comparison: null,
      failMessage: "Enter a question we can map to licensing, trade, geography, or indexed regulatory evidence.",
      changeHints: ["Try an example prompt under Ask ContractorTrustHub."],
    };
  }

  if (includesAny(text, COMPLAINT_PHRASES)) {
    interpretation.evidenceFamily = "Consumer complaints (not in this hub)";
    interpretation.notes.push("Complaint datasets are not interchangeable with licensing discipline, unlicensed activity, or stop-work.");
    return {
      version: ASK_CONTRACT_VERSION,
      query,
      mode: "fail_closed",
      supported: false,
      interpretation,
      href: null,
      count: null,
      aggregate: null,
      comparison: null,
      failMessage:
        "ContractorTrustHub does not currently have a comparable consumer-complaint dataset for this query. We can search indexed licensing discipline, unlicensed-activity records, or stop-work records instead.",
      changeHints: ["DBPR discipline", "Unlicensed activity", "Stop-work"],
    };
  }

  const wantsRate = includesAny(text, RATE_PHRASES);
  const wantsMost = includesAny(text, MOST_PHRASES) && !wantsRate;
  if (wantsRate) {
    interpretation.sort = "Highest rate — not supported without a matching denominator";
    return {
      version: ASK_CONTRACT_VERSION,
      query,
      mode: "fail_closed",
      supported: false,
      interpretation,
      href: null,
      count: null,
      aggregate: null,
      comparison: null,
      failMessage:
        "This question asks for a rate (normalized against a denominator). The current snapshot does not support that denominator for the requested cohort. We can show raw indexed counts instead, if you ask for “most” rather than “highest rate.”",
      changeHints: ["Ask for raw counts (most)", "Open methodology"],
    };
  }
  if (wantsMost) interpretation.sort = "Most (raw count)";

  findLongestPhrase(text, GEO_ONTOLOGY, (i) => {
    interpretation.location = GEO_ONTOLOGY[i].label;
  });
  const geos = GEO_ONTOLOGY.filter((g) => g.phrases.some((p) => phraseInText(text, p)));
  if (geos.length > 1 && /compar/.test(text)) {
    interpretation.location = geos.map((g) => g.label).join(" vs ");
  }

  findLongestPhrase(text, TRADE_ONTOLOGY, (i) => {
    interpretation.trade = `${TRADE_ONTOLOGY[i].label} (${TRADE_ONTOLOGY[i].exactClasses.join(", ")})`;
    interpretation.notes.push(TRADE_ONTOLOGY[i].familyNote);
  });

  findLongestPhrase(text, EVIDENCE_ONTOLOGY, (i) => {
    interpretation.evidenceFamily = EVIDENCE_ONTOLOGY[i].label;
  });

  const trade = TRADE_ONTOLOGY.find((t) => t.phrases.some((p) => phraseInText(text, p)));
  const geo = GEO_ONTOLOGY.find((g) => g.phrases.some((p) => phraseInText(text, p)));
  const evidence = EVIDENCE_ONTOLOGY.find((e) => e.phrases.some((p) => phraseInText(text, p)));

  if (/\bactive\b|\bcurrent\b/.test(text)) {
    interpretation.credentialStatus = "Active/current in the indexed regulator record";
  } else if (/\blicensed\b/.test(text)) {
    interpretation.credentialStatus = "Interpreted as an indexed credential row — not TrustHub certification";
    interpretation.notes.push("“Licensed” here means a credential appears in the researched extract, not that TrustHub certified the contractor.");
  }

  if (/what does/.test(text) && /mean/.test(text) && /active|current/.test(text) && !trade && !evidence) {
    interpretation.notes.push(
      "Active/current means the credential row is currently in that status in the extract. It does not prove workmanship, insurance beyond published fields, current jobs, or service area."
    );
    return {
      version: ASK_CONTRACT_VERSION,
      query,
      mode: "entity",
      supported: true,
      interpretation,
      href: "#verify",
      count: null,
      aggregate: null,
      comparison: null,
      failMessage: null,
      changeHints: ["Research a specific contractor", "Open methodology"],
    };
  }

  const isCompare =
    /compar/.test(text) &&
    geos.some((g) => g.id === "broward") &&
    geos.some((g) => g.id === "palm-beach");
  if (isCompare) {
    interpretation.notes.push("Permit volume is not compared: the two counties do not have a shared comparable permit denominator on this homepage.");
    return {
      version: ASK_CONTRACT_VERSION,
      query,
      mode: "comparison",
      supported: true,
      interpretation,
      href: "#compare",
      count: null,
      aggregate: null,
      comparison: {
        left: { label: "Broward County Intelligence", href: "/florida/broward" },
        right: { label: "Palm Beach County Intelligence", href: "/florida/palm-beach" },
        metrics: [
          { label: "Coverage type", left: "County intelligence available", right: "County intelligence available" },
          { label: "State credential research", left: "Florida DBPR extract (mailing/HQ county is not service area)", right: "Florida DBPR extract (mailing/HQ county is not service area)" },
          { label: "Permit metrics on this page", left: "Not used for comparison", right: "Not used for comparison" },
        ],
        limitation:
          "Both counties have Intelligence pages. License mailing county is not operating territory. Permit counts are not compared here.",
      },
      failMessage: null,
      changeHints: ["Open Broward Intelligence", "Open Palm Beach Intelligence"],
    };
  }

  if (/which (contractor )?trades|most active/.test(text) && (text.includes("florida") || text.includes("trade"))) {
    const families = intel.tradeFamilies.families.filter((f) => f.activeCurrentRows > 0);
    interpretation.location = interpretation.location === "Not specified" ? "Live researched states (occupation-code families)" : interpretation.location;
    interpretation.trade = "Mapped trade families";
    interpretation.credentialStatus = "Active/current in mapped occupation codes";
    interpretation.notes.push("These are mapped occupation-code families in the live public cohort, not a complete Florida-only census.");
    return {
      version: ASK_CONTRACT_VERSION,
      query,
      mode: "aggregate",
      supported: true,
      interpretation,
      href: "#trades",
      count: null,
      aggregate: families
        .slice()
        .sort((a, b) => b.activeCurrentRows - a.activeCurrentRows)
        .map((f) => ({ label: f.label, value: f.activeCurrentRows, href: f.href })),
      comparison: null,
      failMessage: null,
      changeHints: ["Open a trade family page"],
    };
  }

  if (evidence && (text.includes("show") || text.includes("find") || text.includes("with"))) {
    const family = intel.regulatoryEvidence.byEvidenceFamily.find((f) => {
      if (evidence.id === "stop_work") return f.key === "fl_dfs_stop_work";
      if (evidence.id === "unlicensed_activity") return f.key === "fl_dbpr_unlicensed";
      if (evidence.id === "dbpr_discipline") return f.key === "fl_dbpr_discipline";
      if (evidence.id === "recovery_fund") return f.key === "fl_recovery_fund";
      return false;
    });
    return {
      version: ASK_CONTRACT_VERSION,
      query,
      mode: "evidence",
      supported: true,
      interpretation,
      href: geo?.kind === "county" ? geo.href : "/florida",
      count: family
        ? {
            value: family.rows,
            grain: "Indexed source rows in this evidence family — not contractors found guilty and not a complaint total",
            caveat: intel.regulatoryEvidence.grainNote,
          }
        : null,
      aggregate: null,
      comparison: null,
      failMessage: null,
      changeHints: ["Open Florida Intelligence"],
    };
  }

  if (
    trade &&
    (geo ||
      text.includes("florida") ||
      text.includes("active") ||
      text.includes("show") ||
      text.includes("find") ||
      /how many|count of|number of/.test(text))
  ) {
    const href = geo?.kind === "county" ? geo.href : trade.href;
    if (geo?.kind === "county") {
      interpretation.notes.push("County pages use mailing/HQ county on the credential. That is not service territory.");
    }
    const fam = intel.tradeFamilies.families.find((f) => {
      if (trade.id === "roofing") return f.id === "roofing";
      if (trade.id === "hvac") return f.id === "hvac";
      if (trade.id === "plumbing") return f.id === "plumbing";
      if (trade.id === "electrical") return f.id === "electrical";
      if (trade.id === "pool_spa") return f.id === "pool-spa";
      if (trade.id === "general" || trade.id === "building") return f.id === "general-building";
      if (trade.id === "residential") return f.id === "residential";
      return false;
    });
    const wantsHowMany = /how many|count of|number of/.test(text);
    if (wantsHowMany && fam) {
      return {
        version: ASK_CONTRACT_VERSION,
        query,
        mode: "count",
        supported: true,
        interpretation,
        href: fam.href,
        count: {
          value: fam.activeCurrentRows,
          grain: `Active/current credential rows in the mapped ${fam.label} occupation-code family in the live public cohort`,
          caveat: "Not a Florida-only census unless every contributing source is Florida. See contributing sources on the snapshot.",
        },
        aggregate: null,
        comparison: null,
        failMessage: null,
        changeHints: ["Change trade family"],
      };
    }
    return {
      version: ASK_CONTRACT_VERSION,
      query,
      mode: "entity",
      supported: true,
      interpretation,
      href,
      count: null,
      aggregate: null,
      comparison: null,
      failMessage: null,
      changeHints: ["Open Verify", "Open Florida trade page"],
    };
  }

  if (text.includes("active") && text.includes("credential") && text.includes("florida")) {
    return {
      version: ASK_CONTRACT_VERSION,
      query,
      mode: "fail_closed",
      supported: false,
      interpretation,
      href: "/florida",
      count: null,
      aggregate: null,
      comparison: null,
      failMessage:
        "This Ask path does not publish a single Florida-only active-credential total. Open Florida Intelligence for statewide trade pages, or ask about a mapped trade family.",
      changeHints: ["Open Florida Intelligence", "Ask about a trade family"],
    };
  }

  return {
    version: ASK_CONTRACT_VERSION,
    query,
    mode: "fail_closed",
    supported: false,
    interpretation,
    href: "/#verify",
    count: null,
    aggregate: null,
    comparison: null,
    failMessage:
      "We could not map that question onto a supported licensing, trade, geography, or indexed-evidence query. Try an example prompt, or search a company name / license number.",
    changeHints: ["Research a specific contractor", "Try an example question"],
  };
}
