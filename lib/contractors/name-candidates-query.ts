/**
 * TH-SEARCH-R1-019B: lightweight name-candidate projection over the shared name core.
 *
 * Same predicate, rank and index prefilter as native Verify name search
 * (`searchContractors`), rendered by `buildNameMatchSql`. Differences are limited to what a
 * candidate card needs: no entity/discipline enrichment, no count query, a deterministic
 * page window, and one statement across every permitted source scope.
 */
import { query as defaultQuery } from "@/lib/db";
import { buildNameMatchSql, prepareNameTerms, type NameMatchSql, type PreparedNameTerms } from "./name-search-core";

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

export async function queryContractorNameCandidates(
  args: { name: string; scopes: NameCandidateScope[]; limit: number; offset: number },
  db: NameCandidateDb = { query: defaultQuery },
  /** Test oracle hook: swap in the unprefiltered builder to prove the prefilter drops nothing. */
  build: (prepared: PreparedNameTerms, startIndex: number) => NameMatchSql = buildNameMatchSql
): Promise<{ rows: NameCandidateDbRow[]; hasMore: boolean; usesNameIndexes: boolean }> {
  if (args.scopes.length === 0) throw new Error("name_candidates_no_scope");
  if (!Number.isInteger(args.limit) || args.limit < 1 || !Number.isInteger(args.offset) || args.offset < 0) throw new Error("name_candidates_bad_window");
  // $1 scopes, $2 probe limit (one extra row proves another page exists), $3 offset, then name params.
  const match = build(prepareNameTerms(args.name), 4);
  const params: unknown[] = [JSON.stringify(args.scopes), args.limit + 1, args.offset, ...match.params];

  const rows = await db.query<NameCandidateDbRow>(
    `
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
    ORDER BY rank_score, LOWER(display_name), slug
    LIMIT $2::int OFFSET $3::int
    `,
    params,
    { statementTimeoutMs: NAME_CANDIDATE_STATEMENT_TIMEOUT_MS }
  );

  const hasMore = rows.length > args.limit;
  return { rows: hasMore ? rows.slice(0, args.limit) : rows, hasMore, usesNameIndexes: match.usesNameIndexes };
}
