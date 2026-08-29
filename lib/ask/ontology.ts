/**
 * Maintainable synonym layer for Ask ContractorTrustHub.
 * Maps consumer phrases to documented families or exact classes.
 * Does not collapse legally distinct board classes.
 */

export type TradeFamilyId =
  | "roofing"
  | "general"
  | "building"
  | "residential"
  | "hvac"
  | "plumbing"
  | "electrical"
  | "pool_spa";

export const TRADE_ONTOLOGY: Array<{
  id: TradeFamilyId;
  label: string;
  phrases: string[];
  exactClasses: string[];
  familyNote: string;
  href: string;
}> = [
  {
    id: "roofing",
    label: "Roofing",
    phrases: ["roofing", "roofer", "roofers", "roof contractor", "roofing contractor", "certified roofing"],
    exactClasses: ["CCC", "RC"],
    familyNote: "Florida CILB roofing is CCC (certified) and RC (registered). RR is registered residential, not roofing.",
    href: "/florida/roofers",
  },
  {
    id: "general",
    label: "General contractor",
    phrases: ["general contractor", "general contractors", "gc", "general contracting", "general"],
    exactClasses: ["CGC", "RG"],
    familyNote: "Florida CILB general is CGC/RG. Not every state has a statewide GC class.",
    href: "/florida/general-contractors",
  },
  {
    id: "building",
    label: "Building contractor",
    phrases: ["building contractor", "building contractors"],
    exactClasses: ["CBC", "RB"],
    familyNote: "Florida CILB building class (CBC/RB), distinct from general (CGC) and residential (CRC).",
    href: "/florida/building-contractors",
  },
  {
    id: "residential",
    label: "Residential contractor",
    phrases: ["residential contractor", "residential contractors", "residential"],
    exactClasses: ["CRC", "RR"],
    familyNote: "Florida residential class is CRC/RR. RR is not roofing.",
    href: "/florida/residential-contractors",
  },
  {
    id: "hvac",
    label: "HVAC / air conditioning",
    phrases: ["hvac", "ac", "a/c", "air conditioning", "air conditioner", "mechanical"],
    exactClasses: ["CAC", "RA", "CMC", "RM"],
    familyNote: "Maps to Florida CAC/RA (air conditioning) and CMC/RM (mechanical) where asked as HVAC.",
    href: "/florida/air-conditioning",
  },
  {
    id: "plumbing",
    label: "Plumbing",
    phrases: ["plumbing", "plumber", "plumbers"],
    exactClasses: ["CFC", "RF"],
    familyNote: "Florida plumbing class CFC/RF. Other states use different boards.",
    href: "/florida/plumbing",
  },
  {
    id: "electrical",
    label: "Electrical",
    phrases: ["electrical", "electrician", "electricians"],
    exactClasses: ["TEC", "TES", "ELE", "EC"],
    familyNote: "No Florida CILB electrical occupation page in this extract. Verify uses specialty-state class chips.",
    href: "/verify?work=electrical",
  },
  {
    id: "pool_spa",
    label: "Pool / spa",
    phrases: ["pool", "spa", "pool contractor", "pool/spa"],
    exactClasses: ["CPC", "RP"],
    familyNote: "Florida pool/spa class CPC/RP.",
    href: "/florida/pool-spa",
  },
];

export const GEO_ONTOLOGY: Array<{
  id: string;
  label: string;
  phrases: string[];
  href: string;
  kind: "state" | "county";
  intelligence: "state_intelligence" | "county_intelligence" | "verification";
}> = [
  {
    id: "fl",
    label: "Florida",
    phrases: ["florida", "fl", "statewide florida"],
    href: "/florida",
    kind: "state",
    intelligence: "state_intelligence",
  },
  {
    id: "broward",
    label: "Broward County, Florida",
    phrases: ["broward", "broward county", "fort lauderdale"],
    href: "/florida/broward",
    kind: "county",
    intelligence: "county_intelligence",
  },
  {
    id: "palm-beach",
    label: "Palm Beach County, Florida",
    phrases: ["palm beach", "palm beach county", "west palm"],
    href: "/florida/palm-beach",
    kind: "county",
    intelligence: "county_intelligence",
  },
  {
    id: "miami-dade",
    label: "Miami-Dade County, Florida",
    phrases: ["miami-dade", "miami dade", "miami"],
    href: "/florida/miami-dade",
    kind: "county",
    intelligence: "county_intelligence",
  },
];

export const EVIDENCE_ONTOLOGY: Array<{
  id: string;
  label: string;
  phrases: string[];
  failIfComplaint: boolean;
}> = [
  {
    id: "dbpr_discipline",
    label: "Florida DBPR licensing discipline",
    phrases: ["dbpr discipline", "licensing discipline", "disciplinary", "discipline records"],
    failIfComplaint: false,
  },
  {
    id: "unlicensed_activity",
    label: "Florida DBPR unlicensed activity",
    phrases: ["unlicensed activity", "unlicensed", "ula"],
    failIfComplaint: false,
  },
  {
    id: "stop_work",
    label: "Florida DFS workers' compensation stop-work",
    phrases: ["stop-work", "stop work", "stopwork", "swa"],
    failIfComplaint: false,
  },
  {
    id: "recovery_fund",
    label: "Florida Construction Recovery Fund",
    phrases: ["recovery fund", "crf"],
    failIfComplaint: false,
  },
];

export const COMPLAINT_PHRASES = [
  "complaint",
  "complaints",
  "consumer complaint",
  "bbb",
  "better business",
];

export const RATE_PHRASES = ["highest rate", "rate of", "per contractor", "normalized", "share of"];
export const MOST_PHRASES = ["most", "largest number", "highest count"];

export function normalizeAskText(q: string): string {
  return q
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9/+\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Short tokens ("ac", "gc", "fl") must be whole words so "active" ≠ HVAC. */
export function phraseInText(text: string, phrase: string): boolean {
  const p = phrase.trim();
  if (!p) return false;
  if (p.length <= 3) {
    const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|\\s)${escaped}(?=\\s|$)`).test(text);
  }
  return text.includes(p);
}

export function findLongestPhrase(
  haystack: string,
  items: Array<{ phrases: string[] }>,
  pick: (i: number) => void
): void {
  const ranked = items
    .map((item, idx) => ({
      idx,
      len: Math.max(0, ...item.phrases.map((p) => (phraseInText(haystack, p) ? p.length : 0))),
    }))
    .filter((x) => x.len > 0)
    .sort((a, b) => b.len - a.len);
  if (ranked[0]) pick(ranked[0].idx);
}
