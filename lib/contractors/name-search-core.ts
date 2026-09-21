/**
 * TH-SEARCH-R1-019B: the ONE contractor name-matching core.
 *
 * Native Verify name search (`searchContractors`) and the callable name-candidate operation
 * both render predicate, rank and access path from here, so the two cannot drift apart.
 *
 * CANDIDATE SEMANTICS -- defined here, independently of any index or access path
 * (candidate retrieval only; never identity or evidence attachment):
 *
 * A record matches when ONE actual source name field (display, legal/licensee, DBA, or the
 * credential row's source names) contains EVERY meaningful word of the supplied name, after
 * BOTH sides pass through the same normalization:
 *   - apostrophes are removed (O'NEIL == ONEIL, in both directions, at any word length);
 *   - ASCII punctuation/whitespace and common typographic dashes/quotes are word breaks
 *     (R & T == R T == R&T; A.B == A B);
 *   - letters and digits of ANY script are kept. Non-ASCII characters are never deleted into
 *     a different name (JOSÉ stays JOSÉ; it does not become JOS);
 *   - case is folded.
 * Legal-suffix words and the connector AND are dropped from the SUPPLIED name only. Initials
 * and every later word stay required. A word of three or more characters may BEGIN a source
 * word (STILW -> STILWELL); a shorter word must EQUAL one -- never a letter inside a word.
 * Words must co-occur in one field: a business-name word plus a word from another field is
 * not a source name.
 *
 * ACCESS PATH -- an optimization that must never change the answer:
 * `fromSql` narrows which rows are read. It is written on the SAME normalized expression the
 * semantics use, so it is the semantic rule itself (or, for the strong tier, a rule the rank
 * tiers 0-3 imply) -- never a separate condition on the raw text. Review 2 established that the
 * existing raw-text trigram indexes cannot serve these semantics (an apostrophe may fall between
 * any two letters of the raw value, initials have no trigram); the access path therefore needs
 * indexes on the normalized expression (NORMALIZED_NAME_INDEXES). Without them the same SQL is
 * still correct but scans. The test gate compares three things that must agree: independent
 * fixture expectations, the semantic predicate with NO access path, and the optimized query.
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

/** Words this short are initials: whole-word match only. */
export const MIN_PREFIX_WORD_LENGTH = 3;

// Apostrophe-like characters: removed (never a word break).      '  `  ‘  ’  ʼ
const APOSTROPHES_JS = /['`\u2018\u2019\u02BC]/g;
// Word breaks: every ASCII character that is not a letter or digit, plus NBSP, en/em dash and
// curly double quotes. Everything else -- including all non-ASCII letters -- is kept.
const SEPARATORS_JS = /[\u0000-\u002F\u003A-\u0040\u005B-\u0060\u007B-\u007F\u00A0\u2013\u2014\u201C\u201D]+/g;
// The same two classes for PostgreSQL advanced regular expressions.
const APOSTROPHES_SQL = "[''`\\u2018\\u2019\\u02BC]";
const SEPARATORS_SQL = "[\\x01-\\x2F\\x3A-\\x40\\x5B-\\x60\\x7B-\\x7F\\u00A0\\u2013\\u2014\\u201C\\u201D]+";

/** Normalization for comparison in JS. Same character classes as normalizedFieldSql. */
export function normalizeNameText(value: string): string {
  return value.replace(APOSTROPHES_JS, "").replace(SEPARATORS_JS, " ").toUpperCase().trim();
}

export function normalizedFieldSql(column: string): string {
  return `(' ' || btrim(regexp_replace(regexp_replace(upper(coalesce(${column}, '')), '${APOSTROPHES_SQL}', '', 'g'), '${SEPARATORS_SQL}', ' ', 'g')) || ' ')`;
}

/**
 * TH-SEARCH-R1-019B-P2D access-path separation: value-identical to normalizedFieldSql (`|| ''` is a
 * no-op on any non-null text), but a SYNTACTICALLY DISTINCT expression tree. PostgreSQL only matches
 * an expression index when the query's expression is an exact syntactic match (modulo constant
 * folding); giving the token tier's GIN index this wrapped expression, while the strong tier's
 * predicate and B-tree index stay on the bare expression, makes it structurally impossible for the
 * planner to consider the GIN index for the strong tier -- not merely more expensive, but not a
 * candidate at all. See docs/qa/th-search-r1-019b/p2d-*.local.* for the empirical proof this identity
 * holds and that the two tiers' plans are exclusive.
 */
function tokenAccessExpressionSql(column: string): string {
  return `(${normalizedFieldSql(column)} || '')`;
}

/** Upper-case ASCII only. Non-ASCII case folding is left to the database so both sides of a comparison fold identically there. */
function asciiUpper(value: string): string {
  return value.replace(/[a-z]+/g, (run) => run.toUpperCase());
}

export type PreparedNameTerms = {
  /** Supplied name, whitespace-collapsed. Never truncated. */
  supplied: string;
  /** Every required word, in order (ASCII upper-cased; other scripts as typed). */
  terms: string[];
  /** terms joined by a space: the normalized name key. */
  key: string;
  /** Words dropped as optional (legal suffixes, AND). Disclosed, never silently lost. */
  optionalWordsDropped: string[];
};

export function prepareNameTerms(raw: string): PreparedNameTerms {
  const supplied = raw.trim().replace(/\s+/g, " ");
  const words = asciiUpper(supplied.replace(DOTTED_SUFFIX, " ").replace(APOSTROPHES_JS, "").replace(SEPARATORS_JS, " ")).trim().split(" ").filter(Boolean);
  const kept = words.filter((word) => !OPTIONAL_SUPPLIED_WORDS.has(word));
  // A name made only of optional words ("The Company") keeps them: never an empty/match-all name.
  const terms = kept.length > 0 ? kept : words;
  return {
    supplied,
    terms,
    key: terms.join(" "),
    optionalWordsDropped: kept.length > 0 ? words.filter((word) => OPTIONAL_SUPPLIED_WORDS.has(word)) : [],
  };
}

export type NameMatchSql = {
  /** Parameters to append; their first index is the `startIndex` given to the builder. */
  params: unknown[];
  /** The SEMANTIC predicate over contractors `c` and licenses `l`. Contains no access-path condition. */
  predicateSql: string;
  /** Neutral string-relation rank for a (c, l) row. Lower is a stronger NAME relation; never quality. */
  rankSql: string;
  /** FROM-clause source for contractors `c`. */
  fromSql: string;
  usesNameIndexes: boolean;
};

/** "none": no access path (oracle). "all": every semantic match. "strong": rank tiers 0-3 only, readable in name order. */
type AccessPath = "none" | "all" | "strong";

function build(prepared: PreparedNameTerms, startIndex: number, access: AccessPath): NameMatchSql {
  if (prepared.terms.length === 0) throw new Error("name_terms_empty");
  const params: unknown[] = [];
  const param = (value: unknown) => { params.push(value); return `$${startIndex + params.length - 1}`; };

  // upper($n) so the database folds the supplied word exactly as it folds the column.
  const termParams = prepared.terms.map((term) => ({ term, p: `upper(${param(term)})` }));
  const keyParam = `upper(${param(prepared.key)})`;
  const wordRule = (normalized: string) =>
    termParams
      .map(({ term, p }) => ([...term].length < MIN_PREFIX_WORD_LENGTH ? `${normalized} LIKE '% ' || ${p} || ' %'` : `${normalized} LIKE '% ' || ${p} || '%'`))
      .join(" AND ");
  const qualified = (field: NameMatchField) => (CONTRACTOR_FIELDS.includes(field) ? `c.${field}` : `l.${field}`);

  const predicateSql = `(
          ${NAME_MATCH_FIELDS.map((field) => `(${wordRule(normalizedFieldSql(qualified(field)))})`).join("\n          OR ")}
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

  const usesNameIndexes = access !== "none";
  let fromSql = "contractors c";
  if (usesNameIndexes) {
    // "all": the word rule itself, per column (trigram index on the normalized expression).
    // "strong": the normalized field starts with the whole key -- exactly rank tiers 0-3, and a
    // range of the ordered (text_pattern_ops) index on the normalized expression. No new parameter
    // and no condition on raw text in either mode.
    const tierRule = (column: string) =>
      // `IS NOT NULL` changes nothing (a NULL name matches no word); it lets the planner use partial indexes.
      // The token tier's access-path expression is deliberately distinct from the strong tier's (see
      // tokenAccessExpressionSql) so the two tiers' index candidates never overlap; the value is identical.
      access === "strong"
        ? `(${column} IS NOT NULL AND ${normalizedFieldSql(column)} LIKE ' ' || ${keyParam} || '%')`
        : `(${column} IS NOT NULL AND ${wordRule(tokenAccessExpressionSql(column))})`;
    const fieldRule = (column: string) => tierRule(column);
    // TH-SEARCH-R1-019B-P2J: the candidate-ID prefilter's own cardinality is grossly overestimated
    // by the planner (UNION + Bitmap-Or + HashAggregate across two relations; real Production EXPLAIN:
    // estimated ~13,595 rows against an actual of ~3 -- see docs/qa/th-search-r1-019b/p2i-post-analyze-
    // explain-fullplans.local.json). A plain JOIN back to contractors lets that bad estimate drive a
    // Hash Join whose build/probe side is a Parallel Seq Scan of contractors. LATERAL forms an
    // optimizer boundary: for EACH candidate id the planner must produce a single row through
    // `contractors_pkey`, so hydration is structurally PK-driven regardless of how badly the
    // prefilter's row count is estimated. `LIMIT 1` is semantically a no-op (contractors.id is the
    // primary key, so at most one row can ever match) -- its only purpose is to force that per-row
    // boundary; it changes no answer. Value-identical to the prior `JOIN contractors c ON c.id =
    // name_prefilter.id`, syntactically a LATERAL correlated subquery.
    fromSql = `(
        SELECT id FROM contractors
        WHERE ${CONTRACTOR_FIELDS.map((field) => fieldRule(field)).join(" OR ")}
        UNION
        SELECT contractor_id FROM licenses
        WHERE ${CREDENTIAL_FIELDS.map((field) => fieldRule(field)).join(" OR ")}
      ) name_prefilter
      CROSS JOIN LATERAL (
        SELECT * FROM contractors WHERE contractors.id = name_prefilter.id LIMIT 1
      ) c`;
  }
  return { params, predicateSql, rankSql, fromSql, usesNameIndexes };
}

/** Every semantic match, reached through the normalized expression. */
export function buildNameMatchSql(prepared: PreparedNameTerms, startIndex: number): NameMatchSql {
  return build(prepared, startIndex, "all");
}

/**
 * Strong tier only: rows whose best name relation is rank 0-3 (a source name equals or starts with
 * the supplied name). Same predicate and rank; the caller adds nothing. Rank-4 rows are NOT here.
 */
export function buildStrongNameMatchSql(prepared: PreparedNameTerms, startIndex: number): NameMatchSql {
  return build(prepared, startIndex, "strong");
}

/** Lowest rank the strong tier cannot produce; the token tier is `rank = WEAKEST_NAME_RANK`. */
export const WEAKEST_NAME_RANK = 4;

/**
 * The semantic predicate ALONE: no access path, no access-path parameters, no index condition of
 * any kind. Test oracle: the optimized query must return exactly what this returns.
 */
export function buildSemanticNameMatchSql(prepared: PreparedNameTerms, startIndex: number): NameMatchSql {
  return build(prepared, startIndex, "none");
}

/**
 * PROPOSED, NOT APPLIED ANYWHERE BUT DISPOSABLE TEST FIXTURES: the indexes the access path needs.
 * Rendered from the same expression as the predicate so the two cannot drift. `ordered` serves the
 * strong tier (equality/prefix in name order); `words` serves every-word matching.
 */
export const NORMALIZED_NAME_INDEXES: Array<{ name: string; table: "contractors" | "licenses"; kind: "ordered" | "words"; ddl: string }> = NAME_MATCH_FIELDS.flatMap((field) => {
  const table = CONTRACTOR_FIELDS.includes(field) ? ("contractors" as const) : ("licenses" as const);
  const expr = normalizedFieldSql(field);
  // "words" (GIN) is built on the token access-path expression (value-identical, syntactically
  // distinct -- see tokenAccessExpressionSql) so it can never be matched against the strong tier's
  // bare-expression predicate, and the strong tier's B-tree can never be matched against the token
  // tier's wrapped predicate. Structural separation, not a cost-based preference.
  const tokenExpr = tokenAccessExpressionSql(field);
  return [
    { name: `${table}_${field}_nameorder_idx`, table, kind: "ordered" as const, ddl: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${table}_${field}_nameorder_idx ON ${table} (${expr} text_pattern_ops) WHERE ${field} IS NOT NULL` },
    { name: `${table}_${field}_namewords_idx`, table, kind: "words" as const, ddl: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${table}_${field}_namewords_idx ON ${table} USING gin (${tokenExpr} gin_trgm_ops) WHERE ${field} IS NOT NULL` },
  ];
});

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
 * Row-level evidence derived from the values the row itself returned, using the SEMANTIC rule
 * only (never the access path). It is an independent check that the predicate ran: a row with
 * no derivable evidence must be treated as a source failure by the caller, never displayed.
 */
export function deriveNameMatchEvidence(
  suppliedName: string,
  fields: Partial<Record<NameMatchField, string | null>>
): NameMatchEvidence | null {
  const prepared = prepareNameTerms(suppliedName);
  if (prepared.terms.length === 0) return null;
  const terms = prepared.terms.map((term) => term.toUpperCase());
  const key = terms.join(" ");
  const found: NameMatchEvidence[] = [];

  for (const field of NAME_MATCH_FIELDS) {
    const raw = fields[field];
    if (!raw) continue;
    const value = raw.trim().replace(/\s+/g, " ");
    const sourceWords = normalizeNameText(raw).split(" ").filter(Boolean);
    const matchedWords: Array<{ supplied: string; source: string }> = [];
    const everyWord = terms.every((term) => {
      const source = sourceWords.find((word) => ([...term].length < MIN_PREFIX_WORD_LENGTH ? word === term : word.startsWith(term)));
      if (source) matchedWords.push({ supplied: term, source });
      return Boolean(source);
    });
    if (!everyWord) continue;

    const label = FIELD_LABEL[field];
    const alias = ALIAS_FIELDS.has(field);
    const sameName = stripTrailingSuffixWords(sourceWords).join(" ") === key;
    if (value === prepared.supplied) {
      found.push({ field, value, matchedWords, method: alias ? "DOCUMENTED_ALIAS" : "EXACT_SOURCE_NAME", explanation: `The ${label} is exactly the supplied name.` });
    } else if (sameName) {
      found.push({ field, value, matchedWords, method: alias ? "DOCUMENTED_ALIAS" : "NORMALIZED_NAME", explanation: `The ${label} equals the supplied name after case, punctuation, apostrophe and legal-suffix normalization.` });
    } else {
      found.push({ field, value, matchedWords, method: "PREFIX_OR_TOKEN", explanation: `The ${label} contains every required supplied word (${terms.join(", ")}); each one begins or equals a word of that name.` });
    }
  }
  if (found.length === 0) return null;
  found.sort((a, b) => METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method) || NAME_MATCH_FIELDS.indexOf(a.field) - NAME_MATCH_FIELDS.indexOf(b.field));
  return found[0];
}
