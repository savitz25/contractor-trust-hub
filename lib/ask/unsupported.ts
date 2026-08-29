import { phraseInText } from "./ontology";

export const COMPLAINT_UNSUPPORTED = [
  "complaint",
  "complaints",
  "consumer complaint",
  "bbb",
  "better business",
];

export const QUALITY_UNSUPPORTED = [
  "cheapest",
  "lowest price",
  "most affordable",
  "best contractor",
  "best contractors",
  "highest quality",
  "best quality",
  "top contractor",
  "top contractors",
  "safest",
  "fastest",
  "best reviews",
  "google reviews",
  "yelp",
];

export const SERVICE_AREA_UNSUPPORTED = [
  "serve my neighborhood",
  "serves my",
  "who serve",
  "service area",
  "serving broward",
  "serving palm",
  "contractors who serve",
];

export const INSURANCE_UNSUPPORTED = ["insured contractors", "bonded and insured", "has insurance"];

export const PERMIT_VOLUME_UNSUPPORTED = ["permit volume", "most permits", "compare permits"];

export function detectUnsupportedConcept(text: string): { key: string; message: string; alternatives: string[] } | null {
  if (QUALITY_UNSUPPORTED.some((p) => phraseInText(text, p) || text.includes(p))) {
    return {
      key: "quality",
      message:
        "ContractorTrustHub does not rank contractors by price, quality, speed, reviews, or safety. Those properties are not in the licensing extract.",
      alternatives: [
        "Show active roofing contractors in Broward County.",
        "Find Florida general contractors with DBPR discipline records.",
      ],
    };
  }
  if (SERVICE_AREA_UNSUPPORTED.some((p) => text.includes(p))) {
    return {
      key: "service_area",
      message:
        "Indexed address county is not service territory. We can show contractors whose licensing record lists a county address, but we cannot search who serves a neighborhood.",
      alternatives: [
        "Show active roofing contractors in Broward County.",
        "Find active HVAC contractors in Palm Beach County.",
      ],
    };
  }
  if (INSURANCE_UNSUPPORTED.some((p) => text.includes(p))) {
    return {
      key: "insurance",
      message:
        "This Ask path does not have a comparable live insurance-certificate dataset. Bond/insurance fields exist only as published on some board extracts and are not a current certificate check.",
      alternatives: ["Show active roofing contractors in Broward County.", "Open a contractor research report after you have a name or license number."],
    };
  }
  if (PERMIT_VOLUME_UNSUPPORTED.some((p) => text.includes(p))) {
    return {
      key: "permits",
      message:
        "Permit volume is not compared here. Broward and Palm Beach do not share a comparable permit denominator on this Ask path.",
      alternatives: ["Compare contractor research in Broward and Palm Beach."],
    };
  }
  return null;
}

export function detectContradiction(text: string, countyCount: number, isCompare: boolean): string | null {
  const wantsActive = /\bactive\b|\bcurrent\b/.test(text);
  const wantsExpired = /\bexpired\b/.test(text);
  if (wantsActive && wantsExpired) {
    return "Your query includes both Active/current and Expired credential status. Choose one or search both explicitly.";
  }
  if (countyCount > 1 && !isCompare) {
    return "Your query names more than one county. Choose one county, or ask to compare counties.";
  }
  return null;
}
