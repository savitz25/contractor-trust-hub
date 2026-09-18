/**
 * TH-SEARCH-R1-019B: the ONE contractor name-matching core.
 *
 * Native Verify name search (`searchContractors`) and the callable name-candidate
 * operation both render their SQL from these fragments, so the two surfaces cannot
 * drift into separate matchers. Normalization stays in `search-normalize.ts`.
 */
import { prepareNameSearch, type PreparedNameSearch } from "./search-normalize";

export const NAME_MATCH_FIELDS = [
  "display_name",
  "legal_name",
  "dba_name",
  "licensee_name_raw",
  "dba_name_raw",
] as const;
export type NameMatchField = (typeof NAME_MATCH_FIELDS)[number];

/** Trigram indexes cannot serve patterns shorter than this. */
export const MIN_INDEXED_WORD_LENGTH = 3;

/**
 * Which of the (up to four) required-word slots can drive the trigram indexes.
 * Slots are positions in `paddedTokenLikes`; words under three characters are skipped
 * (dropping a conjunct only widens the prefilter, so it stays safe).
 */
export function indexedWordSlots(prepared: PreparedNameSearch): number[] {
  return prepared.tokens
    .slice(0, 4)
    .map((token, slot) => ({ token, slot }))
    .filter(({ token }) => token.length >= MIN_INDEXED_WORD_LENGTH)
    .map(({ slot }) => slot);
}

/** Four token patterns; unused slots are "%" so they always match (existing native behavior). */
export function paddedTokenLikes(prepared: PreparedNameSearch): [string, string, string, string] {
  const tokenLikes = prepared.tokenLikes.slice(0, 4);
  while (tokenLikes.length < 4) tokenLikes.push("%");
  return tokenLikes as [string, string, string, string];
}

const NAME_FIELD_SQL: Record<NameMatchField, string> = {
  display_name: "c.display_name",
  legal_name: "c.legal_name",
  dba_name: "c.dba_name",
  licensee_name_raw: "l.licensee_name_raw",
  dba_name_raw: "l.dba_name_raw",
};

export type NamePredicateParamIndexes = {
  likeOriginal: number;
  likeStripped: number;
  tokens: [number, number, number, number];
};

/**
 * The name predicate. Aliases: contractors `c`, licenses `l`.
 *
 * A record matches when ONE name field contains the supplied name, or contains it after
 * punctuation / legal-suffix normalization, or contains every required word. Words must
 * co-occur in a single name field: a word on the business name plus another on a different
 * field (e.g. a qualifying individual's name) is not a name match.
 */
export function nameMatchPredicateSql(ix: NamePredicateParamIndexes): string {
  const o = `$${ix.likeOriginal}`;
  const s = `$${ix.likeStripped}`;
  const perField = NAME_MATCH_FIELDS.map((field) => {
    const column = NAME_FIELD_SQL[field];
    const allWords = ix.tokens.map((n) => `${column} ILIKE $${n}`).join(" AND ");
    return `${column} ILIKE ${o}
          OR ${column} ILIKE ${s}
          OR (${allWords})`;
  });
  return `(
          ${perField.join("\n          OR ")}
        )`;
}

/** Neutral relevance rank (string relation only; never provider quality). */
export function nameRankCaseSql(ix: { prefixStripped: number; likeStripped: number }): string {
  const p = `$${ix.prefixStripped}`;
  const s = `$${ix.likeStripped}`;
  return `CASE
          WHEN c.display_name ILIKE ${p} THEN 0
          WHEN c.dba_name ILIKE ${p} THEN 1
          WHEN c.legal_name ILIKE ${p} THEN 2
          WHEN c.display_name ILIKE ${s} THEN 3
          WHEN c.dba_name ILIKE ${s} OR c.legal_name ILIKE ${s} THEN 4
          WHEN l.licensee_name_raw ILIKE ${s} THEN 5
          ELSE 6
        END`;
}

/**
 * FROM-clause source for contractors `c`: an index-driven candidate prefilter.
 *
 * The predicate's OR spans two tables, which no single index can serve, so unaided it
 * scans every contractor/license pair until the statement timeout. Every row the predicate
 * admits has ONE name field containing every required word, so "some name field contains
 * every indexable required word" is an exact superset: it changes which rows are scanned,
 * never which match. Putting all words on the same column lets one trigram index scan
 * intersect them on the rarest trigram before any heap row is rechecked.
 *
 * With no indexable word (all under three characters) this is the legacy unfiltered scan.
 */
export function namePrefilteredContractorsFromSql(tokenParamIndexes: number[]): string {
  if (tokenParamIndexes.length === 0) return "contractors c";
  const allWordsIn = (column: string) => `(${tokenParamIndexes.map((n) => `${column} ILIKE $${n}`).join(" AND ")})`;
  return `(
        SELECT id FROM contractors
        WHERE ${allWordsIn("display_name")} OR ${allWordsIn("legal_name")} OR ${allWordsIn("dba_name")}
        UNION
        SELECT contractor_id FROM licenses
        WHERE ${allWordsIn("licensee_name_raw")} OR ${allWordsIn("dba_name_raw")}
      ) name_prefilter
      JOIN contractors c ON c.id = name_prefilter.id`;
}

export type NameMatchMethod =
  | "EXACT_SOURCE_NAME"
  | "NORMALIZED_NAME"
  | "DOCUMENTED_ALIAS"
  | "PREFIX_OR_TOKEN"
  | "NAME_CONTAINS";

export type NameMatchEvidence = {
  field: string;
  value: string;
  method: NameMatchMethod;
  explanation: string;
};

const METHOD_ORDER: NameMatchMethod[] = [
  "EXACT_SOURCE_NAME",
  "NORMALIZED_NAME",
  "DOCUMENTED_ALIAS",
  "PREFIX_OR_TOKEN",
  "NAME_CONTAINS",
];

function collapse(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** The engine's own normalization (suffix/punctuation/case), applied to a stored value. */
function engineNormalized(value: string): string {
  return prepareNameSearch(value).stripped.toLowerCase();
}

const FIELD_LABEL: Record<NameMatchField, string> = {
  display_name: "public display name",
  legal_name: "recorded legal/licensee name (in some sources this is the qualifying individual)",
  dba_name: "documented DBA name",
  licensee_name_raw: "source licensee name on the credential row",
  dba_name_raw: "source DBA name on the credential row",
};

const ALIAS_FIELDS = new Set<NameMatchField>(["dba_name", "dba_name_raw"]);

/**
 * Row-level evidence, derived from the values the row itself returned. It is an
 * independent check that the SQL predicate ran: a row with no derivable evidence means
 * the predicate did not hold for what was returned, and callers must treat that as a
 * source failure rather than display it.
 */
export function deriveNameMatchEvidence(
  supplied: string,
  fields: Partial<Record<NameMatchField, string | null>>
): NameMatchEvidence | null {
  const prepared = prepareNameSearch(supplied);
  const original = collapse(supplied);
  const normalizedSupplied = prepared.stripped.toLowerCase();
  const tokens = prepared.tokens.slice(0, 4).map((t) => t.toLowerCase());
  const found: NameMatchEvidence[] = [];

  for (const field of NAME_MATCH_FIELDS) {
    const raw = fields[field];
    if (!raw) continue;
    const value = collapse(raw);
    const lower = value.toLowerCase();
    const normalizedValue = engineNormalized(value);
    const alias = ALIAS_FIELDS.has(field);
    const label = FIELD_LABEL[field];
    if (value === original) {
      found.push({ field, value, method: alias ? "DOCUMENTED_ALIAS" : "EXACT_SOURCE_NAME", explanation: `The ${label} is exactly the supplied name.` });
    } else if (normalizedValue === normalizedSupplied) {
      found.push({ field, value, method: alias ? "DOCUMENTED_ALIAS" : "NORMALIZED_NAME", explanation: `The ${label} equals the supplied name after case, punctuation and legal-suffix normalization.` });
    } else if (normalizedValue.startsWith(`${normalizedSupplied} `) || (tokens.length > 0 && tokens.every((t) => lower.includes(t)) && lower.includes(normalizedSupplied) === false)) {
      found.push({ field, value, method: "PREFIX_OR_TOKEN", explanation: `The ${label} starts with or contains every supplied word.` });
    } else if (lower.includes(original.toLowerCase()) || normalizedValue.includes(normalizedSupplied) || lower.includes(normalizedSupplied)) {
      found.push({ field, value, method: "NAME_CONTAINS", explanation: `The ${label} contains the supplied name.` });
    }
  }
  if (found.length > 0) {
    found.sort((a, b) => METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method));
    return found[0];
  }

  return null;
}
