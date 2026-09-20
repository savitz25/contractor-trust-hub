import { query } from "@/lib/db";

export type RawPermitEvidenceRow = {
  attribution_id: string;
  identity_state: string;
  identity_method: string;
  matched_contractor_id: string | null;
  matched_license_id: string | null;
  license_contractor_id: string | null;
  license_external_key: string | null;
  source_record_id: string | null;
  permit_number: string | null;
  source_system: string;
  county_slug: string | null;
  permit_type_normalized: string | null;
  work_description: string | null;
  status_normalized: string | null;
  application_date: string | null;
  issue_date: string | null;
  final_date: string | null;
  property_address: string | null;
  source_url: string | null;
  retrieved_at: string | null;
};

/**
 * EA-CT-002 QA amendment: read-only EXPLAIN ANALYZE (docs/qa/ea-ct-002/query-plan-verification.local.json)
 * found the original `WHERE a.matched_contractor_id = $1` path sequentially scanning the full
 * permit_attributions table (139,586 rows) -- 483ms for a high-volume contractor, 29ms for an ordinary
 * one. permit_attributions has no index on matched_contractor_id, but migration
 * 011_enhanced_county_foundation.sql already defines permit_attributions_license_idx ON
 * (matched_license_id) WHERE matched_license_id IS NOT NULL. Resolving the contractor's license ids
 * first (licenses_contractor_idx, initial_schema.sql) and filtering permit_attributions by
 * matched_license_id = ANY(...) lets the planner use that existing index: 14ms for the same
 * high-volume contractor, sub-millisecond for an ordinary one. matched_contractor_id is KEPT as an
 * exact equality filter in the same query -- this changes which index drives the scan, not which rows
 * qualify. No new index, no DDL, no schema change.
 */
async function licenseIdsForContractor(contractorId: string): Promise<string[]> {
  const rows = await query<{ id: string }>(`SELECT id FROM licenses WHERE contractor_id = $1`, [contractorId]);
  return rows.map((r) => r.id);
}

/**
 * SQL-level cap on how many raw candidate rows are scanned for display/dedup purposes only. This is
 * NOT the source of the displayed total count (see fetchPermitEvidenceTotal) -- it exists purely so a
 * contractor with an extreme number of confirmed permits (observed in production: a major homebuilder
 * with 2,000+) cannot make this one query pull an unbounded result set. It is generous relative to the
 * display limit (10) specifically so the pure de-duplication/most-recent-wins logic in
 * lib/contractors/permit-evidence.ts still has enough of the sorted, most-recent rows to work with even
 * if a future batch introduces duplicate attribution rows for the same permit.
 */
const CANDIDATE_SCAN_LIMIT = 500;

/**
 * EA-CT-002: candidate rows for one contractor's Evidence-Activation permit attributions.
 *
 * Filters to identity_state = CONFIRMED and identity_method = FULL_DBPR_LICENSE in SQL for clarity
 * and index use, but this is NOT the sole enforcement point -- lib/contractors/permit-evidence.ts
 * re-checks identity_state/method and contractor/license consistency in a pure, unit-tested function
 * before anything renders. Read-only. No writes, no DDL, no identity computation here: matched_*
 * columns are read exactly as the Evidence Activation batch already resolved them.
 */
export async function fetchPermitEvidenceCandidates(
  contractorId: string
): Promise<RawPermitEvidenceRow[]> {
  const licenseIds = await licenseIdsForContractor(contractorId);
  if (!licenseIds.length) return []; // No license on this profile -> no attribution can reference it. No query needed.
  return query<RawPermitEvidenceRow>(
    `
    SELECT
      a.id AS attribution_id,
      a.identity_state,
      a.identity_method,
      a.matched_contractor_id,
      a.matched_license_id,
      l.contractor_id AS license_contractor_id,
      l.external_key AS license_external_key,
      s.id AS source_record_id,
      s.permit_number,
      s.source_system,
      s.county_slug,
      s.permit_type_normalized,
      s.work_description,
      s.status_normalized,
      s.application_date::text AS application_date,
      s.issue_date::text AS issue_date,
      s.final_date::text AS final_date,
      s.property_address,
      s.source_url,
      s.retrieved_at::text AS retrieved_at
    FROM permit_attributions a
    JOIN permit_source_records s ON s.id = a.permit_source_record_id
    LEFT JOIN licenses l ON l.id = a.matched_license_id
    WHERE a.matched_license_id = ANY($1::uuid[])
      AND a.matched_contractor_id = $2
      AND a.identity_state = 'CONFIRMED'
      AND a.identity_method = 'FULL_DBPR_LICENSE'
    ORDER BY s.issue_date DESC NULLS LAST, s.permit_number DESC NULLS LAST, a.id
    LIMIT ${CANDIDATE_SCAN_LIMIT}
    `,
    [licenseIds, contractorId]
  );
}

/**
 * The TRUE confirmed-permit count for this contractor, independent of CANDIDATE_SCAN_LIMIT above.
 * Never derive the displayed total from the length of a capped row fetch -- that would silently
 * understate the true count for a high-volume contractor (observed in production).
 */
export async function fetchPermitEvidenceTotal(contractorId: string): Promise<number> {
  const licenseIds = await licenseIdsForContractor(contractorId);
  if (!licenseIds.length) return 0;
  const rows = await query<{ n: string }>(
    `
    SELECT count(*) AS n
    FROM permit_attributions a
    JOIN permit_source_records s ON s.id = a.permit_source_record_id
    LEFT JOIN licenses l ON l.id = a.matched_license_id
    WHERE a.matched_license_id = ANY($1::uuid[])
      AND a.matched_contractor_id = $2
      AND a.identity_state = 'CONFIRMED'
      AND a.identity_method = 'FULL_DBPR_LICENSE'
      AND l.contractor_id = a.matched_contractor_id
      AND l.external_key IS NOT NULL
      AND s.id IS NOT NULL
    `,
    [licenseIds, contractorId]
  );
  return Number(rows[0]?.n ?? 0);
}
