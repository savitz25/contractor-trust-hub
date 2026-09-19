/**
 * TH-SEARCH-R1-019B: the ONE contractor name-matching core.
 *
 * Native Verify name search (`searchContractors`) and the callable name-candidate operation
 * both render predicate, rank and index prefilter from here, so the two cannot drift into
 * separate matchers.
 *
 * NAME SEMANTICS (candidate retrieval only -- never identity or evidence attachment)
 *
 * A record matches when ONE actual source name field (display, legal/licensee, DBA, or the
 * credential row's source names) contains EVERY meaningful word of the supplied name:
 *   - both sides are normalized the same way: ASCII upper-case, apostrophes removed
 *     (O'BRIEN == OBRIEN), every other non-alphanumeric run becomes a word break;
 *   - legal-suffix words and the connector AND are dropped from the SUPPLIED name only, so
 *     the customer never has to type LLC/Inc, and "Brown and Root" finds "BROWN & ROOT";
 *   - initials and every later word stay required. Nothing is truncated to "the first four";
 *   - a word of three or more characters matches a source word it begins (STILW -> STILWELL);
 *     a shorter word (an initial) must equal a whole source word -- never a letter inside one.
 * Words must co-occur in one field: a business-name word plus a word from a different field
 * (e.g. the qualifying individual) is not a source name and is not a match.
 */

export const NAME_MATCH_FIELDS = [
  "display_name",
  "legal_name",
  "dba_name",
  "licensee_name_raw",
  "dba_name_raw",
] as const;
export type NameMatchField = (typeof NAME_MATCH_FIELDS)[number];

const CONTRACTOR_FIELDS: NameMatchField[] = ["display_name", "legal_name", "dba_name"];
const CREDENTIAL_FIELDS: NameMatchField[] = ["licensee_name_raw", "dba_name_raw"];

/** Words a customer should not have to type. Dropped from the supplied name only. */
const OPTIONAL_SUPPLIED_WORDS = new Set([
  "INCORPORATED", "INC", "LLC", "CORPORATION", "CORP", "COMPANY", "CO", "LTD", "LIMITED", "PLLC", "PA", "LP", "LLP", "THE", "AND",
]);
/** Dotted suffix forms, removed before punctuation becomes word breaks (L.L.C. must not become initials). */
const DOTTED_SUFFIX = /\b(L\.\s?L\.\s?C\.?|L\.\s?L\.\s?P\.?|P\.\s?L\.\s?L\.\s?C\.?|P\.\s?A\.?|L\.\s?P\.?)(?=[\s,;)]|$)/gi;
/** Suffix tokens as they appear in a NORMALIZED source field (dots already turned into breaks). */
const SUFFIX_TAIL_REGEX = "( (INCORPORATED|INC|LLC|L L C|CORPORATION|CORP|COMPANY|CO|LTD|LIMITED|PLLC|P L L C|P A|PA|LP|L P|LLP|L L P))*";

/** Words this short are initials: whole-word match only, and they cannot drive a trigram index. */
export const MIN_PREFIX_WORD_LENGTH = 3;

/** Identical in effect to normalizedFieldSql below. */
export function normalizeNameText(value: string): string {
  return value
    .replace(/['`‘’]/g, "")
    .replace(/[^\x00-\x7F]/g, " ")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function normalizedFieldSql(column: string): string {
  // Non-ASCII characters fall outside [A-Z0-9] and become breaks, exactly as in normalizeNameText.
  return `(' ' || btrim(regexp_replace(regexp_replace(upper(coalesce(${column}, '')), '[''\`‘’]', '', 'g'), '[^A-Z0-9]+', ' ', 'g')) || ' ')`;
}

export type PreparedNameTerms = {
  /** Supplied name, whitespace-collapsed. Never truncated. */
  supplied: string;
  /** Every required word, in order. */
  terms: string[];
  /** terms joined by a space: the normalized name key. */
  key: string;
  /** Words dropped as optional (legal suffixes, AND). Disclosed, never silently lost. */
  optionalWordsDropped: string[];
  /** Raw-text fragments that drive the trigram indexes (see indexFragmentFor). */
  indexFragments: string[];
  /** LIKE pattern for the raw supplied name; the index rule when no word can drive an index. */
  rawContainsLike: string;
};

function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, "\\$&");
}

/**
 * Index-driving fragment for one supplied word. A fragment must be guaranteed to appear
 * CONTIGUOUSLY in the raw source text whenever the word matches, otherwise the prefilter
 * would drop a legitimate match. Apostrophes are the only characters removed inside a word.
 *   - The customer typed the apostrophe (O'NEIL): the longest piece (NEIL) is present whether
 *     the source writes O'NEIL or ONEIL.
 *   - No apostrophe typed, six or more letters (OBRIEN, MCDONALDS): the interior (BRIE) survives
 *     a source apostrophe after the first letter or before the last.
 *   - Shorter words are used whole, so an untyped apostrophe is not bridged for them
 *     (ONEIL does not find O'NEIL; O'NEIL and O NEIL do). A three-letter interior is too
 *     unselective to drive an index.
 * Because the final predicate contains this same rule, these limits are exact, not leaks.
 */
const MIN_INTERIOR_WORD_LENGTH = 6;
function indexFragmentFor(term: string, typedPieces: string[]): string | null {
  if (term.length < MIN_PREFIX_WORD_LENGTH) return null;
  if (typedPieces.length > 1) {
    const longest = [...typedPieces].sort((x, y) => y.length - x.length)[0];
    return longest.length >= MIN_PREFIX_WORD_LENGTH ? longest : null;
  }
  return term.length >= MIN_INTERIOR_WORD_LENGTH ? term.slice(1, -1) : term;
}

export function prepareNameTerms(raw: string): PreparedNameTerms {
  const supplied = raw.trim().replace(/\s+/g, " ");
  // Same normalization as normalizeNameText, but apostrophes are kept long enough to learn where
  // the customer typed them.
  const typedWords = supplied
    .replace(DOTTED_SUFFIX, " ")
    .replace(/[`‘’]/g, "'")
    .replace(/[^\x00-\x7F]/g, " ")
    .toUpperCase()
    .replace(/[^A-Z0-9']+/g, " ")
    .split(" ")
    .map((word) => ({ term: word.replace(/'/g, ""), pieces: word.split("'").filter(Boolean) }))
    .filter(({ term }) => term.length > 0);
  const kept = typedWords.filter(({ term }) => !OPTIONAL_SUPPLIED_WORDS.has(term));
  // A name made only of optional words ("The Company") keeps them: never an empty/match-all name.
  const used = kept.length > 0 ? kept : typedWords;
  const terms = used.map(({ term }) => term);
  const fragments = [...new Set(used.map(({ term, pieces }) => indexFragmentFor(term, pieces)).filter((f): f is string => f !== null))];
  return {
    supplied,
    terms,
    key: terms.join(" "),
    optionalWordsDropped: kept.length > 0 ? typedWords.map(({ term }) => term).filter((term) => OPTIONAL_SUPPLIED_WORDS.has(term)) : [],
    indexFragments: fragments,
    rawContainsLike: `%${escapeLike(supplied)}%`,
  };
}

export type NameMatchSql = {
  /** Parameters to append; their first index is the `startIndex` given to buildNameMatchSql. */
  params: unknown[];
  /** Predicate over contractors `c` and licenses `l`. */
  predicateSql: string;
  /** Neutral string-relation rank for a (c, l) row. Lower is a stronger NAME relation; never quality. */
  rankSql: string;
  /** FROM-clause source for contractors `c`, driven by the trigram indexes. */
  fromSql: string;
  usesNameIndexes: boolean;
};

/**
 * Render predicate, rank and prefilter for one supplied name.
 *
 * Per field:   indexRule(raw column)  AND  wordRule(normalized column)
 * Prefilter:   some field satisfies indexRule
 * The prefilter is a superset of the predicate BY CONSTRUCTION -- the predicate contains the
 * very rule the prefilter applies -- so it can change which rows are scanned, never which match.
 * All fragments sit on the same column so one index scan intersects them on the rarest trigram.
 */
export function buildNameMatchSql(prepared: PreparedNameTerms, startIndex: number): NameMatchSql {
  if (prepared.terms.length === 0) throw new Error("name_terms_empty");
  const params: unknown[] = [];
  const param = (value: unknown) => { params.push(value); return `$${startIndex + params.length - 1}`; };

  const termParams = prepared.terms.map((term) => ({ term, p: param(term) }));
  const usesNameIndexes = prepared.indexFragments.length > 0;
  const indexParams = usesNameIndexes
    ? prepared.indexFragments.map((fragment) => param(`%${fragment}%`))
    : [param(prepared.rawContainsLike)];
  const keyParam = param(prepared.key);

  const indexRule = (column: string) => `(${indexParams.map((p) => `${column} ILIKE ${p}`).join(" AND ")})`;
  const wordRule = (normalized: string) =>
    termParams
      .map(({ term, p }) => (term.length < MIN_PREFIX_WORD_LENGTH ? `${normalized} LIKE '% ' || ${p} || ' %'` : `${normalized} LIKE '% ' || ${p} || '%'`))
      .join(" AND ");
  const qualified = (field: NameMatchField) => (CONTRACTOR_FIELDS.includes(field) ? `c.${field}` : `l.${field}`);

  const predicateSql = `(
          ${NAME_MATCH_FIELDS.map((field) => `(${indexRule(qualified(field))} AND ${wordRule(normalizedFieldSql(qualified(field)))})`).join("\n          OR ")}
        )`;

  const equalsName = (field: NameMatchField) => `${normalizedFieldSql(qualified(field))} ~ ('^ ' || ${keyParam} || '${SUFFIX_TAIL_REGEX} $')`;
  // Word-prefix aware: "stilw" ranks a display name STILWELL ... above a licensee-field match.
  const startsWithName = (field: NameMatchField) => `${normalizedFieldSql(qualified(field))} LIKE ' ' || ${keyParam} || '%'`;
  const others: NameMatchField[] = ["dba_name", "legal_name", "licensee_name_raw", "dba_name_raw"];
  const rankSql = `CASE
          WHEN ${equalsName("display_name")} THEN 0
          WHEN ${others.map(equalsName).join(" OR ")} THEN 1
          WHEN ${startsWithName("display_name")} THEN 2
          WHEN ${others.map(startsWithName).join(" OR ")} THEN 3
          ELSE 4
        END`;

  // Each branch applies the FULL per-field rule (index rule AND word rule), not just the index
  // rule: candidates that only share common words ("GENERAL CONSTRUCTION") are discarded at the
  // bitmap heap scan, before the contractor/credential joins multiply their cost.
  const fieldRule = (column: string) => `(${indexRule(column)} AND ${wordRule(normalizedFieldSql(column))})`;
  const fromSql = `(
        SELECT id FROM contractors
        WHERE ${CONTRACTOR_FIELDS.map((field) => fieldRule(field)).join(" OR ")}
        UNION
        SELECT contractor_id FROM licenses
        WHERE ${CREDENTIAL_FIELDS.map((field) => fieldRule(field)).join(" OR ")}
      ) name_prefilter
      JOIN contractors c ON c.id = name_prefilter.id`;

  return { params, predicateSql, rankSql, fromSql, usesNameIndexes };
}

/** The same predicate with NO prefilter. Test oracle only: proves the prefilter never drops a match. */
export function buildUnprefilteredNameMatchSql(prepared: PreparedNameTerms, startIndex: number): NameMatchSql {
  return { ...buildNameMatchSql(prepared, startIndex), fromSql: "contractors c" };
}

export type NameMatchMethod = "EXACT_SOURCE_NAME" | "NORMALIZED_NAME" | "DOCUMENTED_ALIAS" | "PREFIX_OR_TOKEN";

export type NameMatchEvidence = {
  field: NameMatchField;
  value: string;
  method: NameMatchMethod;
  /** The source word that satisfied each supplied word, in supplied order. */
  matchedWords: Array<{ supplied: string; source: string }>;
  explanation: string;
};

const METHOD_ORDER: NameMatchMethod[] = ["EXACT_SOURCE_NAME", "NORMALIZED_NAME", "DOCUMENTED_ALIAS", "PREFIX_OR_TOKEN"];

const FIELD_LABEL: Record<NameMatchField, string> = {
  display_name: "public display name",
  legal_name: "recorded legal/licensee name (in some sources this is the qualifying individual, not the business)",
  dba_name: "documented DBA name",
  licensee_name_raw: "source licensee name on the credential row",
  dba_name_raw: "source DBA name on the credential row",
};
const ALIAS_FIELDS = new Set<NameMatchField>(["dba_name", "dba_name_raw"]);
const SUFFIX_WORDS = new Set(["INCORPORATED", "INC", "LLC", "CORPORATION", "CORP", "COMPANY", "CO", "LTD", "LIMITED", "PLLC", "PA", "LP", "LLP"]);

function stripTrailingSuffixWords(words: string[]): string[] {
  const out = [...words];
  // Dotted forms normalize to single letters (L L C, P A): fold them before comparing.
  const joinedTail = (n: number) => out.slice(-n).join("");
  for (;;) {
    if (out.length > 1 && SUFFIX_WORDS.has(out[out.length - 1])) out.pop();
    else if (out.length > 3 && ["LLC", "LLP"].includes(joinedTail(3))) out.splice(-3);
    else if (out.length > 4 && joinedTail(4) === "PLLC") out.splice(-4);
    else if (out.length > 2 && ["PA", "LP"].includes(joinedTail(2))) out.splice(-2);
    else return out;
  }
}

/**
 * Row-level evidence derived from the values the row itself returned, using the SAME rules as
 * the SQL (word rule on the normalized field AND index rule on the raw field). It is an
 * independent check that the predicate ran: a row with no derivable evidence must be treated
 * as a source failure by the caller, never displayed.
 */
export function deriveNameMatchEvidence(
  suppliedName: string,
  fields: Partial<Record<NameMatchField, string | null>>
): NameMatchEvidence | null {
  const prepared = prepareNameTerms(suppliedName);
  if (prepared.terms.length === 0) return null;
  const found: NameMatchEvidence[] = [];

  for (const field of NAME_MATCH_FIELDS) {
    const raw = fields[field];
    if (!raw) continue;
    const value = raw.trim().replace(/\s+/g, " ");
    const rawLower = raw.toLowerCase();
    const indexRuleHolds = prepared.indexFragments.length > 0
      ? prepared.indexFragments.every((fragment) => rawLower.includes(fragment.toLowerCase()))
      : rawLower.includes(prepared.supplied.toLowerCase());
    if (!indexRuleHolds) continue;

    const sourceWords = normalizeNameText(raw).split(" ").filter(Boolean);
    const matchedWords: Array<{ supplied: string; source: string }> = [];
    const everyWord = prepared.terms.every((term) => {
      const source = sourceWords.find((word) => (term.length < MIN_PREFIX_WORD_LENGTH ? word === term : word.startsWith(term)));
      if (source) matchedWords.push({ supplied: term, source });
      return Boolean(source);
    });
    if (!everyWord) continue;

    const label = FIELD_LABEL[field];
    const alias = ALIAS_FIELDS.has(field);
    const sameName = stripTrailingSuffixWords(sourceWords).join(" ") === prepared.key;
    if (value === prepared.supplied) {
      found.push({ field, value, matchedWords, method: alias ? "DOCUMENTED_ALIAS" : "EXACT_SOURCE_NAME", explanation: `The ${label} is exactly the supplied name.` });
    } else if (sameName) {
      found.push({ field, value, matchedWords, method: alias ? "DOCUMENTED_ALIAS" : "NORMALIZED_NAME", explanation: `The ${label} equals the supplied name after case, punctuation, apostrophe and legal-suffix normalization.` });
    } else {
      found.push({ field, value, matchedWords, method: "PREFIX_OR_TOKEN", explanation: `The ${label} contains every required supplied word (${prepared.terms.join(", ")}); each one begins or equals a word of that name.` });
    }
  }
  if (found.length === 0) return null;
  found.sort((a, b) => METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method) || NAME_MATCH_FIELDS.indexOf(a.field) - NAME_MATCH_FIELDS.indexOf(b.field));
  return found[0];
}
