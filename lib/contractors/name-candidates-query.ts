/**
 * TH-SEARCH-R1-019B: lightweight name-candidate projection over the shared name core.
 *
 * Same predicate, rank and normalization as native Verify name search
 * (`searchContractors`), rendered from `name-search-core.ts`. Differences are limited to
 * what a candidate card needs: no entity/discipline enrichment, no count query, a
 * deterministic page window, and one statement across every permitted source scope.
 */
import { query as defaultQuery } from "@/lib/db";
import { prepareNameSearch } from "./search-normalize";
import {
  indexedWordSlots,
  nameMatchPredicateSql,
  namePrefilteredContractorsFromSql,
  nameRankCaseSql,
  paddedTokenLikes,
} from "./name-search-core";

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
  db: NameCandidateDb = { query: defaultQuery }
): Promise<{ rows: NameCandidateDbRow[]; hasMore: boolean; prefiltered: boolean }> {
  if (args.scopes.length === 0) throw new Error("name_candidates_no_scope");
  const prepared = prepareNameSearch(args.name);
  const tokenLikes = paddedTokenLikes(prepared);
  // Token patterns are $4-$7; only indexable words drive the candidate prefilter.
  const prefilterParams = indexedWordSlots(prepared).map((slot) => 4 + slot);

  const params: unknown[] = [
    prepared.prefixStripped, // $1
    prepared.likeStripped, // $2
    prepared.likeOriginal, // $3
    tokenLikes[0], // $4
    tokenLikes[1], // $5
    tokenLikes[2], // $6
    tokenLikes[3], // $7
    JSON.stringify(args.scopes), // $8
    args.limit + 1, // $9 -- one probe row proves whether another page exists
    args.offset, // $10
  ];

  const rows = await db.query<NameCandidateDbRow>(
    `
    WITH scope AS (
      SELECT code, sources FROM jsonb_to_recordset($8::jsonb) AS s(code text, sources text[])
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
        ${nameRankCaseSql({ prefixStripped: 1, likeStripped: 2 })} AS rank_score
      FROM ${namePrefilteredContractorsFromSql(prefilterParams)}
      JOIN licenses l ON l.contractor_id = c.id
      JOIN scope s ON l.source_system = ANY(s.sources) AND (c.home_state = s.code OR l.state = s.code)
      WHERE c.is_thin_profile = FALSE
        AND c.slug IS NOT NULL AND c.slug <> ''
        AND ${nameMatchPredicateSql({ likeOriginal: 3, likeStripped: 2, tokens: [4, 5, 6, 7] })}
      ORDER BY c.id,
        CASE l.status_normalized WHEN 'active' THEN 0 WHEN 'current' THEN 1 ELSE 2 END,
        l.updated_at DESC NULLS LAST
    )
    SELECT *
    FROM per_contractor
    ORDER BY rank_score, LOWER(display_name), slug
    LIMIT $9::int OFFSET $10::int
    `,
    params,
    { statementTimeoutMs: NAME_CANDIDATE_STATEMENT_TIMEOUT_MS }
  );

  const hasMore = rows.length > args.limit;
  return { rows: hasMore ? rows.slice(0, args.limit) : rows, hasMore, prefiltered: prefilterParams.length > 0 };
}
