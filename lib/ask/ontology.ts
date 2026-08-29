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
  | "mechanical"
  | "plumbing"
  | "electrical"
  | "pool_spa"
  | "solar"
  | "underground"
  | "specialty";

export const CLASS_LABELS: Record<string, string> = {
  CGC: "Certified General Contractor",
  RG: "Registered General Contractor",
  CBC: "Certified Building Contractor",
  RB: "Registered Building Contractor",
  CRC: "Certified Residential Contractor",
  RR: "Registered Residential Contractor",
  CCC: "Certified Roofing Contractor",
  RC: "Registered Roofing Contractor",
  CAC: "Certified Air Conditioning Contractor",
  RA: "Registered Air Conditioning Contractor",
  CMC: "Certified Mechanical Contractor",
  RM: "Registered Mechanical Contractor",
  CFC: "Certified Plumbing Contractor",
  RF: "Registered Plumbing Contractor",
  CPC: "Certified Pool / Spa Contractor",
  RP: "Registered Pool / Spa Contractor",
  CUC: "Certified Underground Utility Contractor",
  RU: "Registered Underground Utility Contractor",
  SCC: "Certified Specialty Structure Contractor",
  RX: "Registered Specialty Structure Contractor",
  CVC: "Certified Solar Contractor",
  RV: "Registered Solar Contractor",
};

export const TRADE_TO_DISCOVERY_SLUG: Record<TradeFamilyId, string | null> = {
  roofing: "roofers",
  general: "general-contractors",
  building: "building-contractors",
  residential: "residential-contractors",
  hvac: "air-conditioning",
  mechanical: "mechanical",
  plumbing: "plumbing",
  electrical: null,
  pool_spa: "pool-spa",
  solar: "solar",
  underground: "underground-utility",
  specialty: "specialty-structures",
};

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
    phrases: ["hvac", "ac", "a/c", "air conditioning", "air conditioner"],
    exactClasses: ["CAC", "RA"],
    familyNote: "Florida air-conditioning class is CAC/RA. Mechanical (CMC/RM) is a distinct class.",
    href: "/florida/air-conditioning",
  },
  {
    id: "mechanical",
    label: "Mechanical",
    phrases: ["mechanical contractor", "mechanical contractors", "mechanical"],
    exactClasses: ["CMC", "RM"],
    familyNote: "Florida mechanical class is CMC/RM, distinct from air-conditioning CAC/RA.",
    href: "/florida/mechanical",
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
  {
    id: "solar",
    label: "Solar",
    phrases: ["solar", "solar contractor", "solar contractors"],
    exactClasses: ["CVC", "RV"],
    familyNote: "Florida solar class is CVC/RV. Sheet metal CSC is not solar.",
    href: "/florida/solar",
  },
  {
    id: "underground",
    label: "Underground utility",
    phrases: ["underground utility", "underground", "utility contractor"],
    exactClasses: ["CUC", "RU"],
    familyNote: "Florida underground utility class is CUC/RU.",
    href: "/florida/underground-utility",
  },
  {
    id: "specialty",
    label: "Specialty structures",
    phrases: ["specialty structure", "specialty structures", "screen enclosure"],
    exactClasses: ["SCC", "RX"],
    familyNote: "Florida specialty structure class is SCC/RX.",
    href: "/florida/specialty-structures",
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

export const RATE_PHRASES = ["highest rate", "rate of", "per contractor", "normalized", "share of", "discipline rate"];
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
