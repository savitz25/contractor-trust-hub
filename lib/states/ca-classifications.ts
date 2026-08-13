/**
 * California CSLB classification labels for Verify.
 */

export type CaClassInfo = {
  code: string;
  plain: string;
  chip: string;
};

export const CA_CLASS_LABELS: Record<string, CaClassInfo> = {
  A: { code: "A", plain: "General Engineering", chip: "Engineering" },
  B: { code: "B", plain: "General Building", chip: "General building" },
  B2: { code: "B2", plain: "Residential Remodeling", chip: "Remodeling" },
  C10: { code: "C10", plain: "Electrical", chip: "Electrical" },
  C20: { code: "C20", plain: "HVAC / Warm-Air Heating", chip: "HVAC" },
  C36: { code: "C36", plain: "Plumbing", chip: "Plumbing" },
  C39: { code: "C39", plain: "Roofing", chip: "Roofing" },
  C27: { code: "C27", plain: "Landscaping", chip: "Landscaping" },
  C33: { code: "C33", plain: "Painting", chip: "Painting" },
  C53: { code: "C53", plain: "Swimming Pool", chip: "Pool" },
  C46: { code: "C46", plain: "Solar", chip: "Solar" },
  C16: { code: "C16", plain: "Fire Protection", chip: "Fire protection" },
  C8: { code: "C8", plain: "Concrete", chip: "Concrete" },
  C9: { code: "C9", plain: "Drywall", chip: "Drywall" },
  C15: { code: "C15", plain: "Flooring", chip: "Flooring" },
  C29: { code: "C29", plain: "Masonry", chip: "Masonry" },
  C54: { code: "C54", plain: "Tile", chip: "Tile" },
  HAZ: { code: "HAZ", plain: "Hazardous Substance Removal", chip: "HAZ" },
  ASB: { code: "ASB", plain: "Asbestos Certification", chip: "Asbestos" },
};

export function getCaClassInfo(code: string | null | undefined): CaClassInfo {
  if (!code) {
    return {
      code: "GEN",
      plain: "California contractor license",
      chip: "CSLB",
    };
  }
  const upper = code.toUpperCase().replace(/-/g, "");
  return (
    CA_CLASS_LABELS[upper] || {
      code: upper,
      plain: `CSLB class ${upper}`,
      chip: upper,
    }
  );
}

export function caClassPlainLabel(code: string | null | undefined): string {
  return getCaClassInfo(code).plain;
}

export const CA_COVERED_COUNTIES_NOTE =
  "Top high-impact counties in the current CSLB list download set (Riverside not yet in files)";

export const CA_PILOT_COVERED = [
  "CSLB license number, business name, status",
  "Primary classification (+ multi-class codes when published)",
  "City / county / ZIP and phone when present",
  "Bond and workers’ comp fields as published in the list extract",
] as const;

export const CA_PILOT_NOT_COVERED = [
  "Every California county (current extract is high-impact counties only)",
  "Live bond / COI / workers’ comp certificate verification",
  "SOS entity auto-links or full permit history",
  "Florida-depth planning, studios, or passport journey",
] as const;
