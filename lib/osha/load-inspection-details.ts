import "server-only";
import type { QueryResultRow } from "pg";
import { query } from "@/lib/db";
import { isOshaDetailEnabled } from "./flag";
import {
  decodeOshaInspectionCursor,
  encodeOshaInspectionCursor,
  isPublicOshaDetailParentAllowed,
  OshaDetailUnavailableError,
} from "./inspection-detail-adapter";
import type { OshaCitationDetail, OshaInspectionDetail, OshaInspectionDetailsPage } from "./inspection-details";
import { OSHA_INSPECTION_DETAILS_PAGE_SIZE } from "./inspection-details";
import { OSHA_DETAIL_HELD_LICENSE_KEYS } from "./public-record";

type MatchRow = QueryResultRow & {
  id: string; contractor_id: string; state: string; license_key: string; match_tier: string;
  n_citation_items: number; osha_activity_nrs: string | null;
};
type InspectionRow = QueryResultRow & {
  id: string; activity_nr: string; open_date: string | null; site_city: string | null;
  site_state: string | null; inspection_type: string | null; close_date: string | null;
  closing_conference_date: string | null; citations_verified: boolean;
};
type CitationRow = QueryResultRow & {
  inspection_id: string; citation_id: string; standard: string; viol_type: "S" | "W" | "R" | "O" | "U";
  current_penalty: string | number; contest_date: string | null; final_order_date: string | null;
};

const CITATION_TYPE = { S: "Serious", W: "Willful", R: "Repeat", O: "Other", U: "Unclassified" } as const;

/** Detail reads are entirely separate from the live aggregate gate and query path. */
export async function loadPublicOshaInspectionDetails(input: {
  contractorId: string; publicMatchId: string; state: string; licenseKey: string; cursor?: string | null;
}): Promise<OshaInspectionDetailsPage> {
  if (!isOshaDetailEnabled()) throw new OshaDetailUnavailableError("weak_or_unmatched");
  if (!input.contractorId || !["FL", "NJ"].includes(input.state) || !input.licenseKey.trim()) {
    throw new OshaDetailUnavailableError("weak_or_unmatched");
  }
  if (OSHA_DETAIL_HELD_LICENSE_KEYS.has(`${input.state}:${input.licenseKey}`)) {
    throw new OshaDetailUnavailableError("weak_or_unmatched");
  }
  const cursor = decodeOshaInspectionCursor(input.cursor);

  const matches = await query<MatchRow>(
    `SELECT id, contractor_id, state, license_key, match_tier, n_citation_items, osha_activity_nrs
       FROM contractor_osha_license_matches
      WHERE id = $1::uuid AND contractor_id = $2::uuid AND state = $3 AND license_key = $4
        AND match_tier IN ('exact', 'strong')
      LIMIT 1`,
    [input.publicMatchId, input.contractorId, input.state, input.licenseKey],
  );
  const match = matches[0];
  if (!isPublicOshaDetailParentAllowed({
    parent: match ? {
      id: match.id,
      contractorId: match.contractor_id,
      state: match.state,
      licenseKey: match.license_key,
      matchTier: match.match_tier,
    } : null,
    request: input,
  })) throw new OshaDetailUnavailableError("weak_or_unmatched");

  const counts = await query<QueryResultRow & { count: string }>(
    `SELECT count(*)::text AS count
       FROM contractor_osha_citations c
       JOIN contractor_osha_inspections i ON i.id = c.inspection_id
       JOIN contractor_osha_license_matches m ON m.id = i.public_match_id
      WHERE i.public_match_id = $1::uuid AND i.contractor_id = $2::uuid
        AND i.state = $3 AND i.license_key = $4
        AND c.activity_nr = i.activity_nr
        AND i.activity_nr = ANY(string_to_array(replace(m.osha_activity_nrs, ' ', ''), ';'))`,
    [match.id, input.contractorId, input.state, input.licenseKey],
  );
  const detailCitationItems = Number(counts[0]?.count ?? "0");
  if (!Number.isSafeInteger(detailCitationItems) || detailCitationItems !== Number(match.n_citation_items)) {
    console.error("[osha] detail aggregate reconciliation failed", {
      state: input.state, licenseKey: input.licenseKey,
      expected: Number(match.n_citation_items), actual: detailCitationItems,
    });
    throw new OshaDetailUnavailableError("reconciliation_failed");
  }

  const rows = await query<InspectionRow>(
    `SELECT id, activity_nr, to_char(open_date, 'YYYY-MM-DD') AS open_date,
            site_city, site_state, inspection_type,
            to_char(close_date, 'YYYY-MM-DD') AS close_date,
            to_char(closing_conference_date, 'YYYY-MM-DD') AS closing_conference_date,
            citations_verified
       FROM contractor_osha_inspections
      WHERE public_match_id = $1::uuid AND contractor_id = $2::uuid
        AND state = $3 AND license_key = $4
        AND activity_nr = ANY(string_to_array(replace($5::text, ' ', ''), ';'))
        AND (
          NOT $6::boolean
          OR ($7::date IS NOT NULL AND (open_date < $7::date OR (open_date = $7::date AND activity_nr < $8::text) OR open_date IS NULL))
          OR ($7::date IS NULL AND open_date IS NULL AND activity_nr < $8::text)
        )
      ORDER BY open_date DESC NULLS LAST, activity_nr DESC
      LIMIT $9`,
    [match.id, input.contractorId, input.state, input.licenseKey, matches[0].osha_activity_nrs, cursor !== null, cursor?.openDate ?? null, cursor?.activityNumber ?? null, OSHA_INSPECTION_DETAILS_PAGE_SIZE + 1],
  );
  const inspectionCounts = await query<QueryResultRow & { count: string }>(
    `SELECT count(*)::text AS count FROM contractor_osha_inspections
      WHERE public_match_id = $1::uuid AND contractor_id = $2::uuid
        AND state = $3 AND license_key = $4
        AND activity_nr = ANY(string_to_array(replace($5::text, ' ', ''), ';'))`,
    [match.id, input.contractorId, input.state, input.licenseKey, matches[0].osha_activity_nrs],
  );
  const hasMore = rows.length > OSHA_INSPECTION_DETAILS_PAGE_SIZE;
  const pageRows = rows.slice(0, OSHA_INSPECTION_DETAILS_PAGE_SIZE);
  const ids = pageRows.map((row) => row.id);
  const citationRows = ids.length ? await query<CitationRow>(
    `SELECT c.inspection_id, c.citation_id, c.standard, c.viol_type, c.current_penalty,
            to_char(c.contest_date, 'YYYY-MM-DD') AS contest_date,
            to_char(c.final_order_date, 'YYYY-MM-DD') AS final_order_date
       FROM contractor_osha_citations c
       JOIN contractor_osha_inspections i ON i.id = c.inspection_id
       JOIN contractor_osha_license_matches m ON m.id = i.public_match_id
      WHERE c.inspection_id = ANY($1::uuid[]) AND i.public_match_id = $2::uuid
        AND i.contractor_id = $3::uuid AND i.state = $4 AND i.license_key = $5
        AND c.activity_nr = i.activity_nr
        AND i.activity_nr = ANY(string_to_array(replace(m.osha_activity_nrs, ' ', ''), ';'))
      ORDER BY c.inspection_id, c.citation_id`,
    [ids, match.id, input.contractorId, input.state, input.licenseKey],
  ) : [];
  const citationsByInspection = new Map<string, OshaCitationDetail[]>();
  for (const citation of citationRows) {
    const list = citationsByInspection.get(citation.inspection_id) ?? [];
    list.push({
      citationId: citation.citation_id,
      standard: citation.standard,
      citationType: CITATION_TYPE[citation.viol_type],
      currentPenalty: Number(citation.current_penalty),
      contestDate: citation.contest_date,
      finalOrderDate: citation.final_order_date,
    });
    citationsByInspection.set(citation.inspection_id, list);
  }
  const inspections: OshaInspectionDetail[] = pageRows.map((row) => ({
    activityNumber: row.activity_nr,
    openDate: row.open_date,
    city: row.site_city ?? undefined,
    state: row.site_state ?? undefined,
    inspectionType: row.inspection_type ?? undefined,
    closeDate: row.close_date,
    closingConferenceDate: row.closing_conference_date,
    citations: row.citations_verified ? citationsByInspection.get(row.id) ?? [] : null,
  }));
  return {
    inspections,
    totalInspections: Number(inspectionCounts[0]?.count ?? "0"),
    nextCursor: hasMore && pageRows.length
      ? encodeOshaInspectionCursor({
          openDate: pageRows[pageRows.length - 1].open_date,
          activityNumber: pageRows[pageRows.length - 1].activity_nr,
        })
      : null,
    reconciliation: {
      expectedCitationItems: Number(match.n_citation_items),
      detailCitationItems,
    },
  };
}
