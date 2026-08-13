/**
 * California CSLB classification labels for Verify.
 * Display uses familiar board style (C-10, C-36) with plain-language names.
 */

export type CaClassInfo = {
  code: string;
  /** Board-style code for chips (e.g. C-10) */
  boardCode: string;
  plain: string;
  chip: string;
};

/** Normalize any CSLB code to storage form without hyphens (C10, B, HAZ). */
export function normalizeCaClassCode(code: string | null | undefined): string {
  return (code || "").toUpperCase().replace(/-/g, "").trim();
}

/** Format storage code for display: C10 → C-10, B → B, HAZ → HAZ */
export function formatCaBoardCode(code: string): string {
  const u = normalizeCaClassCode(code);
  if (!u) return "";
  const m = u.match(/^([A-Z]+)(\d+)$/);
  if (m) return `${m[1]}-${m[2]}`;
  return u;
}

const LABELS: Record<string, { plain: string; chip: string }> = {
  A: { plain: "General Engineering", chip: "Engineering" },
  B: { plain: "General Building", chip: "General building" },
  B2: { plain: "Residential Remodeling", chip: "Remodeling" },
  C2: { plain: "Insulation and Acoustical", chip: "Insulation" },
  C4: { plain: "Boiler / Hot Water / Steam Fitting", chip: "Boiler" },
  C5: { plain: "Framing and Rough Carpentry", chip: "Framing" },
  C6: { plain: "Cabinet / Millwork / Finish Carpentry", chip: "Cabinetry" },
  C7: { plain: "Low Voltage Systems", chip: "Low voltage" },
  C8: { plain: "Concrete", chip: "Concrete" },
  C9: { plain: "Drywall", chip: "Drywall" },
  C10: { plain: "Electrical", chip: "Electrical" },
  C11: { plain: "Elevator", chip: "Elevator" },
  C12: { plain: "Earthwork and Paving", chip: "Earthwork" },
  C13: { plain: "Fencing", chip: "Fencing" },
  C15: { plain: "Flooring and Floor Covering", chip: "Flooring" },
  C16: { plain: "Fire Protection", chip: "Fire protection" },
  C17: { plain: "Glazing", chip: "Glazing" },
  C20: { plain: "Warm-Air Heating, Ventilating and Air-Conditioning", chip: "HVAC" },
  C21: { plain: "Building Moving / Demolition", chip: "Demolition" },
  C22: { plain: "Asbestos Abatement", chip: "Asbestos" },
  C23: { plain: "Ornamental Metal", chip: "Ornamental metal" },
  C27: { plain: "Landscaping", chip: "Landscaping" },
  C28: { plain: "Lock and Security Equipment", chip: "Security" },
  C29: { plain: "Masonry", chip: "Masonry" },
  C31: { plain: "Construction Zone Traffic Control", chip: "Traffic control" },
  C32: { plain: "Parking and Highway Improvement", chip: "Highway" },
  C33: { plain: "Painting and Decorating", chip: "Painting" },
  C34: { plain: "Pipeline", chip: "Pipeline" },
  C35: { plain: "Lathing and Plastering", chip: "Plastering" },
  C36: { plain: "Plumbing", chip: "Plumbing" },
  C38: { plain: "Refrigeration", chip: "Refrigeration" },
  C39: { plain: "Roofing", chip: "Roofing" },
  C42: { plain: "Sanitation System", chip: "Sanitation" },
  C43: { plain: "Sheet Metal", chip: "Sheet metal" },
  C45: { plain: "Sign", chip: "Sign" },
  C46: { plain: "Solar", chip: "Solar" },
  C47: { plain: "General Manufactured Housing", chip: "Manufactured housing" },
  C50: { plain: "Reinforcing Steel", chip: "Rebar" },
  C51: { plain: "Structural Steel", chip: "Structural steel" },
  C53: { plain: "Swimming Pool", chip: "Pool" },
  C54: { plain: "Tile (Ceramic and Mosaic)", chip: "Tile" },
  C55: { plain: "Water Conditioning", chip: "Water conditioning" },
  C57: { plain: "Well Drilling", chip: "Well drilling" },
  C60: { plain: "Welding", chip: "Welding" },
  C61: { plain: "Limited Specialty", chip: "Limited specialty" },
  ASB: { plain: "Asbestos Certification", chip: "Asbestos cert" },
  HAZ: { plain: "Hazardous Substance Removal", chip: "HAZ" },
};

export const CA_CLASS_LABELS: Record<string, CaClassInfo> = Object.fromEntries(
  Object.entries(LABELS).map(([code, v]) => [
    code,
    {
      code,
      boardCode: formatCaBoardCode(code),
      plain: `${formatCaBoardCode(code)} — ${v.plain}`,
      chip: v.chip,
    },
  ])
);

export function getCaClassInfo(code: string | null | undefined): CaClassInfo {
  if (!code) {
    return {
      code: "GEN",
      boardCode: "CSLB",
      plain: "California contractor license",
      chip: "CSLB",
    };
  }
  const upper = normalizeCaClassCode(code);
  if (CA_CLASS_LABELS[upper]) return CA_CLASS_LABELS[upper];
  const board = formatCaBoardCode(upper);
  return {
    code: upper,
    boardCode: board,
    plain: `CSLB class ${board}`,
    chip: board,
  };
}

/** Plain label only for known CSLB codes — null so other states can resolve their labels. */
export function caClassPlainLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  const upper = normalizeCaClassCode(code);
  if (!LABELS[upper] && !CA_CLASS_LABELS[upper]) return null;
  return getCaClassInfo(code).plain;
}

/** Short chip text: "C-10 Electrical" */
export function caClassChipLabel(code: string | null | undefined): string {
  const info = getCaClassInfo(code);
  if (info.code === "GEN") return info.chip;
  const base = LABELS[info.code]?.chip || info.chip;
  return `${info.boardCode} ${base}`;
}

export const CA_COMMON_CLASS_EXAMPLES = [
  "B — General Building",
  "C-10 — Electrical",
  "C-36 — Plumbing",
  "C-39 — Roofing",
  "C-20 — HVAC",
  "A — General Engineering",
] as const;

export const CA_COVERED_COUNTIES_NOTE =
  "High-impact counties from official CSLB list extracts (includes Riverside; not every CA county)";

export const CA_PILOT_COVERED = [
  "California statewide CSLB licensing (this extract prioritizes top high-impact counties)",
  "License number, business name, CLEAR status, primary + multi-class codes",
  "City / county / ZIP and phone when present",
  "Bond and workers’ comp fields as published in the list extract",
] as const;

export const CA_PILOT_NOT_COVERED = [
  "Complete statewide file for every California county (smaller counties may still be missing)",
  "Personnel / qualifier roster depth beyond the public list columns",
  "Live bond / COI / workers’ comp certificate verification",
  "Discipline / enforcement history (not in these list files)",
  "Florida-depth planning, studios, or passport journey",
] as const;
