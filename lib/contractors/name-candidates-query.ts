/**
 * TH-SEARCH-R1-019B: lightweight name-candidate projection over the shared name core.
 *
 * Same predicate and rank as native Verify name search (`searchContractors`), rendered by the
 * shared core. Differences are limited to what a candidate card needs: no entity/discipline
 * enrichment, no count query, a deterministic page window across every permitted source scope.
 *
 * TIERED RETRIEVAL (the answer is the same as one statement over the semantic predicate; test 15
 * and 18 prove it): rows are ordered rank 0-3 (a source name equals / starts with the supplied
 * name) before rank 4 (contains every word). The strong tier is read first, in name order. The
 * token tier runs only when the strong tier does not fill the page, inside the time that is left.
 * If it cannot finish, the strong rows are returned and the response says the token tier was not
 * completed -- never a miss, never an exhaustive weak scan in front of a strong candidate.
 */
import { query as defaultQuery } from "@/lib/db";
import { isDbQueryTimeout } from "@/lib/db";
import { buildNameMatchSql, buildStrongNameMatchSql, prepareNameTerms, WEAKEST_NAME_RANK, type NameMatchSql, type PreparedNameTerms } from "./name-search-core";

export type NameCandidateScope = {
  /** Credential jurisdiction code, e.g. "FL". */
  code: string;
  /** licenses.source_system values permitted for this jurisdiction's native name search. */
  sources: string[];
};

export type NameCandidateDbRow = {
  id: string;
  slug: string;
  display_name: string;
  legal_name: string | null;
  dba_name: string | null;
  primary_city: string | null;
  primary_county: string | null;
  home_state: string | null;
  license_id: string;
  external_key: string | null;
  license_number: string | null;
  occupation_code: string | null;
  occupation_description: string | null;
  status_normalized: string | null;
  primary_status: string | null;
  source_system: string | null;
  license_state: string | null;
  last_verified_at: Date | string | null;
  updated_at: Date | string | null;
  licensee_name_raw: string | null;
  dba_name_raw: string | null;
  scope_code: string;
  rank_score: number;
};

export type NameCandidateDb = { query: typeof defaultQuery };

/** Budget for the single statement; stays under the consumer's per-hub deadline. */
export const NAME_CANDIDATE_STATEMENT_TIMEOUT_MS = 6_000;

/** Rows of the strong tier are never read past this (the operation's own row cap, plus a probe). */
const STRONG_TIER_COUNT_BOUND = 201;

export type NameTierState = "COMPLETED" | "NOT_NEEDED" | "NOT_COMPLETED";
export type NameCandidateQueryResult = {
  rows: NameCandidateDbRow[];
  hasMore: boolean;
  usesNameIndexes: boolean;
  tiers: { strong: NameTierState; token: NameTierState };
  queries: number;
};
type NameBuilder = (prepared: PreparedNameTerms, startIndex: number) => NameMatchSql;

function statement(match: NameMatchSql, tierFilter: string): string {
  return `
    WITH scope AS (
      SELECT code, sources FROM jsonb_to_recordset($1::jsonb) AS s(code text, sources text[])
    ),
    per_contractor AS (
      SELECT DISTINCT ON (c.id)
        c.id,
        c.slug,
        c.display_name,
        c.legal_name,
        c.dba_name,
        c.primary_city,
        c.primary_county,
        c.home_state,
        l.id AS license_id,
        l.external_key,
        l.license_number,
        l.occupation_code,
        l.occupation_description,
        l.status_normalized,
        l.primary_status,
        l.source_system,
        l.state AS license_state,
        l.last_verified_at,
        l.updated_at,
        l.licensee_name_raw,
        l.dba_name_raw,
        s.code AS scope_code,
        ${match.rankSql} AS rank_score
      FROM ${match.fromSql}
      JOIN licenses l ON l.contractor_id = c.id
      JOIN scope s ON l.source_system = ANY(s.sources) AND (c.home_state = s.code OR l.state = s.code)
      WHERE c.is_thin_profile = FALSE
        AND c.slug IS NOT NULL AND c.slug <> ''
        AND ${match.predicateSql}
      -- Representative credential row: the row with the STRONGEST name relation first, so an exact
      -- source-name row is never displaced by a weaker match; then active/current, then most recent.
      ORDER BY c.id,
        ${match.rankSql},
        CASE l.status_normalized WHEN 'active' THEN 0 WHEN 'current' THEN 1 ELSE 2 END,
        l.updated_at DESC NULLS LAST,
        l.id
    )
    SELECT *
    FROM per_contractor
    ${tierFilter}
    ORDER BY rank_score, LOWER(display_name), slug
    LIMIT $2::int OFFSET $3::int
    `;
}

/**
 * `singleStatement` is the test-oracle hook: one statement from the given builder (e.g. the
 * semantic-only builder), no tiering. Production callers never pass it.
 */
export async function queryContractorNameCandidates(
  args: { name: string; scopes: NameCandidateScope[]; limit: number; offset: number },
  db: NameCandidateDb = { query: defaultQuery },
  singleStatement?: NameBuilder
): Promise<NameCandidateQueryResult> {
  if (args.scopes.length === 0) throw new Error("name_candidates_no_scope");
  if (!Number.isInteger(args.limit) || args.limit < 1 || !Number.isInteger(args.offset) || args.offset < 0) throw new Error("name_candidates_bad_window");
  const prepared = prepareNameTerms(args.name);
  const scopesJson = JSON.stringify(args.scopes);
  const started = Date.now();
  let queries = 0;
  // $1 scopes, $2 probe limit (one extra row proves another page exists), $3 offset, then name params.
  const run = (match: NameMatchSql, tierFilter: string, limit: number, offset: number, timeoutMs: number) => {
    queries += 1;
    return db.query<NameCandidateDbRow>(statement(match, tierFilter), [scopesJson, limit, offset, ...match.params], { statementTimeoutMs: timeoutMs });
  };

  if (singleStatement) {
    const match = singleStatement(prepared, 4);
    const rows = await run(match, "", args.limit + 1, args.offset, NAME_CANDIDATE_STATEMENT_TIMEOUT_MS);
    const hasMore = rows.length > args.limit;
    return { rows: hasMore ? rows.slice(0, args.limit) : rows, hasMore, usesNameIndexes: match.usesNameIndexes, tiers: { strong: "COMPLETED", token: "COMPLETED" }, queries };
  }

  // 1. Strong tier. A failure here is a source failure: nothing has been established yet.
  const strong = buildStrongNameMatchSql(prepared, 4);
  const strongRows = await run(strong, "", args.limit + 1, args.offset, NAME_CANDIDATE_STATEMENT_TIMEOUT_MS);
  if (strongRows.length > args.limit) {
    return { rows: strongRows.slice(0, args.limit), hasMore: true, usesNameIndexes: true, tiers: { strong: "COMPLETED", token: "NOT_NEEDED" }, queries };
  }

  // 2. Token tier continues where the strong tier ended. Its offset needs the strong tier's size,
  //    which is already known unless this page starts beyond it.
  const remaining = () => NAME_CANDIDATE_STATEMENT_TIMEOUT_MS - (Date.now() - started);
  const all = buildNameMatchSql(prepared, 4);
  try {
    let strongCount = args.offset + strongRows.length;
    if (strongRows.length === 0 && args.offset > 0) {
      if (remaining() < 250) throw new TokenTierOutOfTime();
      strongCount = (await run(strong, "", STRONG_TIER_COUNT_BOUND, 0, remaining())).length;
    }
    if (remaining() < 250) throw new TokenTierOutOfTime();
    const want = args.limit - strongRows.length;
    const tokenRows = await run(all, `WHERE rank_score = ${WEAKEST_NAME_RANK}`, want + 1, Math.max(0, args.offset - strongCount), remaining());
    const hasMore = tokenRows.length > want;
    return { rows: [...strongRows, ...(hasMore ? tokenRows.slice(0, want) : tokenRows)], hasMore, usesNameIndexes: true, tiers: { strong: "COMPLETED", token: "COMPLETED" }, queries };
  } catch (error) {
    // Strong candidates are shown; the unfinished tier is declared. With nothing to show it stays a failure.
    if ((error instanceof TokenTierOutOfTime || isDbQueryTimeout(error)) && strongRows.length > 0) {
      return { rows: strongRows, hasMore: false, usesNameIndexes: true, tiers: { strong: "COMPLETED", token: "NOT_COMPLETED" }, queries };
    }
    if (error instanceof TokenTierOutOfTime) throw new Error("name_candidates_out_of_time");
    throw error;
  }
}

class TokenTierOutOfTime extends Error {}
