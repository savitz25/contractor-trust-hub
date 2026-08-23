/**
 * Occupation-code → Ask discovery category.
 * Codes only — never business-name keywords.
 */

export const ASK_CONTRACTOR_CATEGORIES = [
  "roofing",
  "plumbing",
  "hvac",
  "electrical",
  "general_contractor",
  "pool",
  "solar",
] as const;

export type AskContractorCategory = (typeof ASK_CONTRACTOR_CATEGORIES)[number];

export type TradeReadiness = "READY" | "SOFT" | "UNSUPPORTED";

/** Primary FL CILB / peer board codes that are class-backed (not name-assist). */
export const OCCUPATION_TO_CATEGORY: Record<string, AskContractorCategory> = {
  CCC: "roofing",
  RR: "roofing",
  CFC: "plumbing",
  CAC: "hvac",
  CPC: "pool",
  CGC: "general_contractor",
  // NJ
  PLB: "plumbing",
  HVAC: "hvac",
  ELE: "electrical",
  TEL: "electrical",
  HIC: "general_contractor",
  GEN: "general_contractor",
  // TX specialty (if present)
  TEC: "electrical",
  TES: "electrical",
  TAC: "hvac",
  TRMP: "plumbing",
  TMP: "plumbing",
};

export const ASK_TRADE_META: Record<
  AskContractorCategory,
  { readiness: TradeReadiness; sourceTrades: string; notes: string }
> = {
  roofing: {
    readiness: "READY",
    sourceTrades: "FL CCC/RR; discovery slug roofers",
    notes: "Florida CILB roofing occupation pages are live.",
  },
  plumbing: {
    readiness: "READY",
    sourceTrades: "FL CFC; NJ PLB",
    notes: "Occupation-code backed.",
  },
  hvac: {
    readiness: "READY",
    sourceTrades: "FL CAC (air-conditioning); NJ HVAC",
    notes: "CMC mechanical is a separate FL class — not mapped to HVAC.",
  },
  electrical: {
    readiness: "SOFT",
    sourceTrades: "NJ ELE/TEL; TX TEC family. FL electrical is name-assist only.",
    notes: "Florida CILB extract has no electrical occupation page; FL electrical is not exported.",
  },
  general_contractor: {
    readiness: "READY",
    sourceTrades: "FL CGC; NJ HIC/GEN",
    notes: "CBC/CRC are not CGC and are not mapped to general_contractor.",
  },
  pool: {
    readiness: "READY",
    sourceTrades: "FL CPC",
    notes: "Florida pool/spa occupation.",
  },
  solar: {
    readiness: "UNSUPPORTED",
    sourceTrades: "FL name-assist only",
    notes: "Not exported (no occupation-code directory).",
  },
};

export const UNSUPPORTED_ASK_TRADES = [
  "kitchen_remodeling",
  "bathroom_remodeling",
  "painting",
  "flooring",
  "home_inspector",
  "home inspector",
] as const;

export function categoriesFromOccupationCodes(codes: string[]): AskContractorCategory[] {
  const out = new Set<AskContractorCategory>();
  for (const raw of codes) {
    const cat = OCCUPATION_TO_CATEGORY[raw.trim().toUpperCase()];
    if (cat && ASK_TRADE_META[cat].readiness !== "UNSUPPORTED") {
      if (cat === "electrical" && ASK_TRADE_META.electrical.readiness === "SOFT") {
        // NJ/TX codes only — still export when the row actually has ELE/TEL/TEC.
        out.add(cat);
      } else if (cat !== "solar") {
        out.add(cat);
      }
    }
  }
  return [...out].sort();
}

export function isUnsupportedAskTrade(raw: string): boolean {
  const n = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return (UNSUPPORTED_ASK_TRADES as readonly string[]).some(
    (t) => t.replace(/[\s-]+/g, "_") === n
  );
}
