/**
 * Arizona ROC classification / category labels for Verify UI.
 * Official codes stay visible; plain labels are for homeowner-facing copy.
 */

export const AZ_ROC_SEARCH_URL =
  "https://azroc.my.site.com/AZRoc/s/contractor-search";

export const AZ_ROC_POSTING_LIST_URL = "https://roc.az.gov/posting-list";

/** Category buckets from Class Type */
export const AZ_CATEGORY_LABELS: Record<string, string> = {
  Residential: "Residential",
  Commercial: "Commercial",
  Dual: "Dual (residential + commercial)",
};

/** Common class codes → short plain labels (not exhaustive). */
export const AZ_CLASS_LABELS: Record<string, string> = {
  A: "General Engineering",
  B: "General Residential",
  "B-1": "General Commercial",
  "B-2": "General Small Commercial",
  "B-3": "General Remodeling and Repair",
  "KB-1": "Dual Building Contractor",
  "KB-2": "Dual Residential and Small Commercial",
  "CR-11": "Electrical (dual specialty)",
  "CR-39": "Air Conditioning / Refrigeration",
  "CR-37": "Plumbing / Warm Air Heating",
  "CR-21": "Hardscape / Landscape",
  "CR-42": "Roofing",
  "CR-14": "Fencing",
  "CR-3": "Awnings / Canopies / Patio Covers",
  "R-11": "Electrical (residential)",
  "C-11": "Electrical (commercial)",
};

export function azClassPlainLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  const raw = code.trim();
  const upper = raw.toUpperCase();
  return (
    AZ_CLASS_LABELS[raw] ||
    AZ_CLASS_LABELS[upper] ||
    AZ_CLASS_LABELS[upper.replace(/\s+/g, "")] ||
    null
  );
}

export function azCategoryFromSecondary(secondary: string | null | undefined): string | null {
  if (!secondary) return null;
  const m = secondary.match(/Category:\s*(Residential|Commercial|Dual)/i);
  if (m) return m[1];
  const s = secondary.toLowerCase();
  if (s.includes("dual")) return "Dual";
  if (s.includes("residential")) return "Residential";
  if (s.includes("commercial")) return "Commercial";
  return null;
}

export const AZ_PILOT_COVERED = [
  "Statewide Arizona ROC licensing (current active posting list)",
  "License number, business name, class code + class detail",
  "Residential / commercial / dual category when Class Type is published",
  "City, address, issued and expiration dates when present",
  "ROC disciplinary actions posting list (Suspended / Revoked + case number when linked)",
] as const;

export function azRocCategoryFromSecondary(secondary: string | null | undefined) {
  const cat = azCategoryFromSecondary(secondary);
  if (!cat) return null;
  return { chip: cat, official: cat, scopeNote: `Arizona ROC class type: ${cat}.` };
}

export function azRocDisplayLabel(code: string | null | undefined): string {
  return azClassPlainLabel(code) || (code ? `Class ${code}` : "Arizona ROC contractor");
}

export function getAzRocClassInfo(code: string | null | undefined) {
  const plain = azClassPlainLabel(code);
  if (!code && !plain) return null;
  return {
    code: (code || "").toUpperCase(),
    chip: plain || code || "ROC",
    official: code || "ROC",
    plain: azRocDisplayLabel(code),
    scopeNote: "Arizona ROC class as published on the current posting list.",
  };
}

export const AZ_PILOT_NOT_COVERED = [
  "Full historical inactive archive beyond disciplinary + current active lists",
  "Full case narrative / findings text (disciplinary CSV is status-word level)",
  "Live bond / insurance certificate verification",
  "Automatic ACC / SOS entity linkage",
  "Florida-depth planning, studios, or passport journey",
] as const;
