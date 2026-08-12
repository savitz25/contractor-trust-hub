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

/** True when input looks like a FL license id (CBC015082) or long numeric core. */
export function looksLikeLicenseKey(q: string): boolean {
  const compact = q.replace(/[\s\-_.]/g, "");
  return /^[A-Za-z]{2,5}\d{4,}$/.test(compact) || /^\d{5,}$/.test(compact);
}

export function normalizeLicenseKey(q: string): string {
  return q.replace(/[\s\-_.]/g, "").toUpperCase();
}
