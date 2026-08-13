/**
 * Consumer name-search helpers.
 * More forgiving than entity linking — legal suffixes and punctuation are stripped
 * for matching only. High-confidence Sunbiz rules stay unchanged.
 */

const LEGAL_SUFFIX =
  /\b(INCORPORATED|INC|LLC|L\.?L\.?C\.?|CORPORATION|CORP|COMPANY|CO|LTD|LIMITED|PLLC|P\.?A\.?|PA|LP|LLP|THE)\b/gi;

export type PreparedNameSearch = {
  /** Trimmed original query */
  original: string;
  /** Suffixes/punctuation stripped, single-spaced */
  stripped: string;
  /** Significant tokens (len >= 2), max 6 */
  tokens: string[];
  /** SQL LIKE patterns (escaped) */
  likeOriginal: string;
  likeStripped: string;
  prefixStripped: string;
  tokenLikes: string[];
};

function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, "\\$&");
}

export function prepareNameSearch(raw: string): PreparedNameSearch {
  const original = raw.trim().replace(/\s+/g, " ");
  const stripped = original
    .replace(/[.,'"/\\&()+-]+/g, " ")
    .replace(LEGAL_SUFFIX, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = (stripped || original)
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, 6);

  const likeBase = stripped.length >= 2 ? stripped : original;

  return {
    original,
    stripped: likeBase,
    tokens: tokens.length > 0 ? tokens : [likeBase].filter((t) => t.length >= 2),
    likeOriginal: `%${escapeLike(original)}%`,
    likeStripped: `%${escapeLike(likeBase)}%`,
    prefixStripped: `${escapeLike(likeBase)}%`,
    tokenLikes: (tokens.length > 0 ? tokens : [likeBase])
      .filter((t) => t.length >= 2)
      .map((t) => `%${escapeLike(t)}%`),
  };
}

/**
 * True when input looks like a board license / registration id:
 * - Florida style CBC015082
 * - Numeric core (TX TDLR numbers, FL cores)
 * - Explicit TX-TDLR:… product keys
 * - NJ HIC / NJ-… registration keys
 */
export function looksLikeLicenseKey(q: string): boolean {
  const trimmed = q.trim();
  if (/^TX-TDLR:/i.test(trimmed)) return true;
  if (/^TX-TSBPE:/i.test(trimmed)) return true;
  if (/^OR-CCB:/i.test(trimmed)) return true;
  if (/^NJ-/i.test(trimmed)) return true;
  if (/^HIC[-_]?/i.test(trimmed)) return true;
  if (/^(ELE|PLB|HVAC|GEN)-NJ-/i.test(trimmed)) return true;
  const compact = trimmed.replace(/[\s\-_.]/g, "");
  // NJ DCA registration ids often start with digits then letters, e.g. 13VH13621300, 34EB00138000
  if (/^\d{2}[A-Za-z]{2}\d{5,}$/i.test(compact)) {
    return true;
  }
  // Mixed alphanumerics common in NJ registration ids (e.g. HIC13VH00012300)
  if (/^[A-Za-z]{2,6}\d{2,}[A-Za-z0-9]{2,}$/i.test(compact) && compact.length >= 8) {
    return true;
  }
  return /^[A-Za-z]{2,5}\d{4,}$/.test(compact) || /^\d{4,}$/.test(compact);
}

export function normalizeLicenseKey(q: string): string {
  const trimmed = q.trim();
  if (/^TX-TDLR:/i.test(trimmed) || /^TX-TSBPE:/i.test(trimmed) || /^OR-CCB:/i.test(trimmed)) {
    return trimmed.toUpperCase().replace(/\s+/g, "");
  }
  if (/^NJ-/i.test(trimmed) || /^HIC/i.test(trimmed) || /-(NJ|HIC)/i.test(trimmed)) {
    // Keep structure for NJ product keys; strip spaces only
    return trimmed.toUpperCase().replace(/\s+/g, "");
  }
  return trimmed.replace(/[\s\-_.]/g, "").toUpperCase();
}
