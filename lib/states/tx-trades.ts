/**
 * Plain-language Texas TDLR specialty trade labels for Verify UI.
 * Not a GC taxonomy — specialty contractor classes only.
 */

export type TxTradeInfo = {
  /** Occupation code from adapter (e.g. TAC) */
  code: string;
  /** Homeowner-friendly primary label */
  plain: string;
  /** Official TDLR license type wording when it differs from plain */
  official: string;
  /** Short chip for cards */
  chip: string;
  /** One-line scope note (honest, not a full scope of work) */
  scopeNote: string;
};

const BY_CODE: Record<string, Omit<TxTradeInfo, "code">> = {
  TAC: {
    plain: "Air Conditioning Contractor",
    official: "A/C Contractor",
    chip: "Air conditioning",
    scopeNote:
      "TDLR specialty for air conditioning work — not a statewide general contractor license.",
  },
  TEC: {
    plain: "Electrical Contractor",
    official: "Electrical Contractor",
    chip: "Electrical",
    scopeNote:
      "TDLR specialty for electrical contractor work — not a statewide general contractor license.",
  },
  TES: {
    plain: "Electrical Sign Contractor",
    official: "Electrical Sign Contractor",
    chip: "Electrical sign",
    scopeNote:
      "TDLR specialty for electrical sign work — not general construction or building GC.",
  },
  TAP: {
    plain: "Appliance Installation Contractor",
    official: "Appliance Installation Contractor",
    chip: "Appliance install",
    scopeNote:
      "TDLR specialty for appliance installation contractors — limited trade scope.",
  },
  TEL: {
    plain: "Elevator Contractor",
    official: "Elevator Contractor",
    chip: "Elevator",
    scopeNote: "TDLR specialty for elevator contractors — limited trade scope.",
  },
  TWW: {
    plain: "Water Well Driller / Pump Installer",
    official: "Water Well Driller/Pump Installer",
    chip: "Water well",
    scopeNote:
      "TDLR specialty for water well and pump work — not general construction.",
  },
  TME: {
    plain: "Master Electrician",
    official: "Master Electrician",
    chip: "Master electrician",
    scopeNote: "Individual TDLR electrical credential — not a general contractor license.",
  },
  TJE: {
    plain: "Journeyman Electrician",
    official: "Journeyman Electrician",
    chip: "Journeyman electrician",
    scopeNote: "Individual TDLR electrical credential — not a general contractor license.",
  },
  TAE: {
    plain: "Apprentice Electrician",
    official: "Apprentice Electrician",
    chip: "Apprentice electrician",
    scopeNote: "Individual TDLR electrical credential — not a general contractor license.",
  },
  TAI: {
    plain: "Appliance Installer",
    official: "Appliance Installer",
    chip: "Appliance installer",
    scopeNote: "Individual TDLR appliance credential — not a general contractor license.",
  },
  TRMP: {
    plain: "Plumbing — Responsible Master Plumber",
    official: "Responsible Master Plumber",
    chip: "Plumbing (RMP)",
    scopeNote:
      "TSBPE Responsible Master Plumber — the credential that may offer and contract plumbing to the public. Not a statewide general contractor license.",
  },
  TMP: {
    plain: "Plumbing — Master Plumber",
    official: "Master Plumber",
    chip: "Master plumber",
    scopeNote:
      "TSBPE Master Plumber license. Contracting with the public typically requires a Responsible Master Plumber and insurance on file with TSBPE.",
  },
  TJP: {
    plain: "Plumbing — Journeyman Plumber",
    official: "Journeyman Plumber",
    chip: "Journeyman plumber",
    scopeNote:
      "Individual TSBPE journeyman credential — not by itself a public-facing contracting license.",
  },
  TTP: {
    plain: "Plumbing — Tradesman Plumber-Limited",
    official: "Tradesman Plumber-Limited",
    chip: "Tradesman plumber",
    scopeNote:
      "Limited TSBPE tradesman credential — not a statewide general contractor license.",
  },
};

/** Covered specialty contractor types (Verify v1 default ingest). */
export const TX_COVERED_TRADES_PLAIN = [
  "Air conditioning",
  "Electrical",
  "Electrical sign",
  "Appliance installation",
  "Elevator",
  "Water well / pump",
  "Plumbing (TSBPE)",
] as const;

export function getTxTradeInfo(code: string | null | undefined): TxTradeInfo | null {
  if (!code) return null;
  const upper = code.toUpperCase();
  const row = BY_CODE[upper];
  if (!row) return null;
  return { code: upper, ...row };
}

/**
 * Primary display label for cards and headers.
 * Prefer plain language; keep official TDLR wording available separately.
 */
export function txTradePlainLabel(code: string | null | undefined): string {
  const info = getTxTradeInfo(code);
  if (info) return info.plain;
  if (!code) return "Texas specialty license";
  return `Texas specialty (${code.toUpperCase()})`;
}

export function txTradeChipLabel(code: string | null | undefined): string {
  return getTxTradeInfo(code)?.chip ?? "Texas specialty";
}

/** Official line when it differs from plain, else null (avoid redundancy). */
export function txTradeOfficialSuffix(code: string | null | undefined): string | null {
  const info = getTxTradeInfo(code);
  if (!info) return null;
  if (info.plain.toLowerCase() === info.official.toLowerCase()) return null;
  return info.official;
}
