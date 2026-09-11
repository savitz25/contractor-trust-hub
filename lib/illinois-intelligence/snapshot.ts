import accepted from "./accepted-snapshot.json";
import { IL_STATE_INTEL_VERSION, IL_STATE_PUBLIC_FINGERPRINT } from "./publication";

export const ILLINOIS_SNAPSHOT = accepted;
export type IllinoisContractorSnapshot = typeof accepted;

export function assertIllinoisSnapshot(
  value: IllinoisContractorSnapshot = ILLINOIS_SNAPSHOT,
): IllinoisContractorSnapshot {
  if (value.version !== IL_STATE_INTEL_VERSION) throw new Error(`Unexpected IL contract ${value.version}`);
  if (value.fingerprint !== IL_STATE_PUBLIC_FINGERPRINT) throw new Error("IL-CON-001 snapshot fingerprint mismatch");
  if (value.roofing.source_rows !== 33891) throw new Error("roofing source rows drifted");
  if (value.roofing.distinct_license_ids !== 33290) throw new Error("distinct roofing IDs drifted");
  if (value.business_licenses.active_business_y_distinct_license_ids !== 4675) {
    throw new Error("active business license IDs drifted");
  }
  if (value.hero.universe_value !== value.business_licenses.active_business_y_distinct_license_ids) {
    throw new Error("headline must be distinct active business licenses, not matching rows");
  }
  if (value.hero.universe_value === value.business_licenses.active_business_y_rows) {
    throw new Error("do not headline the matching-row count");
  }
  if (value.qualifying_parties.not_added_to_business_denominator !== true) {
    throw new Error("qualifying parties must not be added to business licenses");
  }
  if (value.expansion_ledger.NET_NEW_CANONICAL_ORGANIZATIONS !== 0) throw new Error("no canonical writes");
  if (value.expansion_ledger.GRAPH_WRITES !== 0) throw new Error("no graph writes");
  if (value.claim_eligibility.broadened !== false) throw new Error("claim eligibility unchanged");
  if (value.no_local_illinois_routes !== true) throw new Error("no local Illinois routes");
  if (!value.no_ranking || !value.no_trust_score) throw new Error("no ranking or Trust Score");
  if (value.gate.live_cohort_not_inflated !== true) throw new Error("do not inflate live credentials");
  if (value.discipline.not_master_dataset_discipline_counts !== true) {
    throw new Error("do not import master-dataset discipline totals");
  }
  return value;
}

export function fmtInt(n: number | null | undefined): string {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-US");
}
