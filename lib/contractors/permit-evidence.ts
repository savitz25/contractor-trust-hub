/**
 * EA-CT-002 — activate confirmed dual-linked DBPR permit evidence on Trust Reports.
 *
 * Identity rule (deterministic, already resolved by the Evidence Activation batch, never
 * re-derived or loosened here): a permit renders on a contractor's Trust Report ONLY when
 * permit_attributions.identity_state = 'CONFIRMED' AND identity_method = 'FULL_DBPR_LICENSE'
 * AND matched_contractor_id is exactly this contractor's id AND the matched license's OWN
 * contractor_id independently agrees. No name-only or address-only attachment, no fuzzy
 * matching, no assumption that a permit applicant is the licensee unless the source says so
 * (identity_method already encodes that distinction upstream) -- fail closed on anything else.
 *
 * selectConfirmedPermitEvidence is a pure function so every identity edge case is deterministically
 * testable without a database (see scripts/test_permit_evidence.mjs).
 */
import {
  fetchPermitEvidenceCandidates,
  fetchPermitEvidenceTotal,
  type RawPermitEvidenceRow,
} from "@/lib/property/permit-evidence-db";

export type PermitEvidenceRow = {
  /** Stable key = the permit's own source_record_id -- one row per real-world permit, never per attribution attempt. */
  id: string;
  permitNumber: string | null;
  permitType: string | null;
  workDescription: string | null;
  status: string | null;
  statusLabel: string;
  applicationDate: string | null;
  issueDate: string | null;
  finalDate: string | null;
  jurisdictionLabel: string;
  worksiteAddress: string | null;
  licenseExternalKey: string;
  sourceLabel: string;
  sourceUrl: string | null;
  retrievedAt: string | null;
};

export type PermitEvidenceState =
  | { status: "unavailable" }
  | {
      status: "available";
      rows: PermitEvidenceRow[];
      totalCount: number;
      hasMore: boolean;
      sourceLabel: string;
      retrievedAt: string | null;
    };

const CONFIRMED_STATE = "CONFIRMED";
const CONFIRMED_METHOD = "FULL_DBPR_LICENSE";

const STATUS_LABELS: Record<string, string> = {
  applied: "Applied",
  under_review: "Under review",
  ready_for_issuance: "Ready for issuance",
  issued: "Issued",
  active: "Active",
  inactive: "Inactive",
  expired: "Expired",
  stop_issue: "Stop issue",
  cancelled: "Cancelled",
  final: "Final",
  closed: "Closed",
  unknown: "Status not recorded",
};

const JURISDICTION_LABELS: Record<string, string> = {
  "miami-dade": "Miami-Dade County, FL",
};

const SOURCE_LABELS: Record<string, string> = {
  mdc_opendata_issued: "Miami-Dade County Open Data — Building Permits",
};

/**
 * Pure identity + grain filter/shape. No DB, no I/O.
 *
 * A row renders ONLY when ALL of:
 *  - identity_state === CONFIRMED (never HIGH_CONFIDENCE / REVIEW_REQUIRED / UNRESOLVED);
 *  - identity_method === FULL_DBPR_LICENSE (the exact-license-number bridge only);
 *  - matched_contractor_id === the requested contractor's id (never any other contractor,
 *    including one that merely shares a display name);
 *  - the matched license's OWN contractor_id independently agrees (defense against a stale or
 *    inconsistent attribution row -- fails closed rather than trusting one FK alone);
 *  - a license_external_key and a source_record_id are actually present (a missing/dangling
 *    bridge -- e.g. the matched license row was deleted -- fails closed, never renders a
 *    partial/unresolved reference).
 *
 * Grain: de-duplicated by source_record_id (the permit's own natural identity), so if a future
 * batch ever produces more than one attribution row for the same permit (re-attribution, a
 * lifecycle re-evaluation, etc.) it still displays as exactly one permit, keeping the most
 * recently retrieved version. This does not depend on permit_lifecycle_events existing or being
 * empty -- it is a property of the permit's own identity, not of whether history rows exist.
 */
export function selectConfirmedPermitEvidence(
  rows: readonly RawPermitEvidenceRow[],
  contractorId: string
): PermitEvidenceRow[] {
  const byPermit = new Map<string, RawPermitEvidenceRow>();
  for (const r of rows) {
    if (r.identity_state !== CONFIRMED_STATE) continue;
    if (r.identity_method !== CONFIRMED_METHOD) continue;
    if (!r.matched_contractor_id || r.matched_contractor_id !== contractorId) continue;
    if (!r.license_contractor_id || r.license_contractor_id !== contractorId) continue;
    if (!r.license_external_key) continue;
    if (!r.source_record_id) continue;

    const existing = byPermit.get(r.source_record_id);
    if (!existing || (r.retrieved_at ?? "") > (existing.retrieved_at ?? "")) {
      byPermit.set(r.source_record_id, r);
    }
  }

  return [...byPermit.values()]
    .sort((a, b) => {
      const issueDiff = (b.issue_date ?? "").localeCompare(a.issue_date ?? "");
      if (issueDiff !== 0) return issueDiff;
      const numberDiff = (b.permit_number ?? "").localeCompare(a.permit_number ?? "");
      if (numberDiff !== 0) return numberDiff;
      return (a.source_record_id ?? "").localeCompare(b.source_record_id ?? "");
    })
    .map((r) => ({
      id: r.source_record_id as string,
      permitNumber: r.permit_number,
      permitType: r.permit_type_normalized,
      workDescription: r.work_description,
      status: r.status_normalized,
      statusLabel:
        (r.status_normalized && STATUS_LABELS[r.status_normalized]) || "Status not recorded",
      applicationDate: r.application_date,
      issueDate: r.issue_date,
      finalDate: r.final_date,
      jurisdictionLabel:
        (r.county_slug && JURISDICTION_LABELS[r.county_slug]) ||
        r.county_slug ||
        "Jurisdiction not recorded",
      worksiteAddress: r.property_address,
      licenseExternalKey: r.license_external_key as string,
      sourceLabel: SOURCE_LABELS[r.source_system] || r.source_system,
      sourceUrl: r.source_url,
      retrievedAt: r.retrieved_at,
    }));
}

/**
 * Async orchestrator: fetch candidates + the true total, apply the pure identity filter, shape into
 * display state. `fetchCandidates`/`fetchTotal` are injectable so every identity edge case is
 * testable without a database.
 *
 * `totalCount` always comes from a real count, never from the length of a bounded row fetch -- a
 * capped candidate scan is fine for producing the displayed rows (they are sorted most-recent-first,
 * so the top `limit` of a bounded scan are still the true top `limit` overall) but would silently
 * UNDERSTATE the total for a very high-volume contractor if used as the headline count.
 *
 * Never returns totalCount: 0 for "no confirmed evidence" -- that would assert a completed search
 * against a denominator (all permits everywhere) this dataset does not cover. Absence of confirmed
 * evidence renders as "unavailable", the same honest non-claim pattern already used by
 * lib/contractors/activity-signals.ts.
 */
export async function getConfirmedDbprPermitEvidence(
  contractorId: string,
  options: {
    limit?: number;
    fetchCandidates?: (contractorId: string) => Promise<RawPermitEvidenceRow[]>;
    fetchTotal?: (contractorId: string) => Promise<number>;
  } = {}
): Promise<PermitEvidenceState> {
  const limit = options.limit ?? 10;
  const fetchCandidates = options.fetchCandidates ?? fetchPermitEvidenceCandidates;
  const fetchTotal = options.fetchTotal ?? fetchPermitEvidenceTotal;

  let candidates: RawPermitEvidenceRow[];
  let total: number;
  try {
    [candidates, total] = await Promise.all([fetchCandidates(contractorId), fetchTotal(contractorId)]);
  } catch {
    return { status: "unavailable" };
  }

  const rows = selectConfirmedPermitEvidence(candidates, contractorId);
  if (!rows.length || total <= 0) return { status: "unavailable" };

  let retrievedAt: string | null = null;
  for (const r of rows) {
    if (r.retrievedAt && (!retrievedAt || r.retrievedAt > retrievedAt)) retrievedAt = r.retrievedAt;
  }

  return {
    status: "available",
    rows: rows.slice(0, limit),
    totalCount: total,
    hasMore: total > limit,
    sourceLabel: rows[0].sourceLabel,
    retrievedAt,
  };
}
