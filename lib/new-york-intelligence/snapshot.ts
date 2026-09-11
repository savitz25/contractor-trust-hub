import accepted from "./accepted-snapshot.json";
import { NY_STATE_INTEL_VERSION, NY_STATE_PUBLIC_FINGERPRINT } from "./publication";

export const NEW_YORK_SNAPSHOT = accepted;
export type NewYorkContractorSnapshot = typeof accepted;

export function assertNewYorkSnapshot(
  value: NewYorkContractorSnapshot = NEW_YORK_SNAPSHOT,
): NewYorkContractorSnapshot {
  if (value.version !== NY_STATE_INTEL_VERSION) {
    throw new Error(`Unexpected NY contract ${value.version}`);
  }
  if (value.fingerprint !== NY_STATE_PUBLIC_FINGERPRINT) {
    throw new Error("NY-CON-001 snapshot fingerprint mismatch");
  }
  if (value.registry.parsed_rows !== 14665 || value.registry.distinct_certificate_ids !== 14665) {
    throw new Error("NY public-work registry counts drifted");
  }
  if (value.registry.rows_without_certificate_id !== 0) {
    throw new Error("Blank certificate IDs appeared");
  }
  if (value.registry.identifier_conflicts !== 0) {
    throw new Error("Certificate identifier conflicts appeared");
  }
  if (value.not_statewide_gc_or_hic_license !== true) {
    throw new Error("Registry must not be framed as a statewide GC/HIC license");
  }
  if (value.geography.did_not_filter_to_ny_addresses !== true) {
    throw new Error("Do not filter the statewide registry to NY mailing addresses");
  }
  if (value.registry.absence_ne_illegal_residential_contractor !== true) {
    throw new Error("Absence from the registry is not illegal residential work");
  }
  if (value.debarment.name_only_attachment !== "UNSAFE") {
    throw new Error("Name-only debarment attach must remain unsafe");
  }
  if (value.expansion_ledger.NET_NEW_CANONICAL_ORGANIZATIONS !== 0) {
    throw new Error("Do not mint canonical organizations");
  }
  if (value.expansion_ledger.NET_NEW_PUBLIC_CONTRACTOR_PROFILES !== 0) {
    throw new Error("Do not mint public contractor profiles");
  }
  if (value.expansion_ledger.GRAPH_WRITES !== 0) {
    throw new Error("No graph writes in this ticket");
  }
  if (value.claim_eligibility.broadened !== false) {
    throw new Error("Claim eligibility must stay unchanged");
  }
  if (value.no_local_new_york_routes !== true || value.nyc_phase.indexOf("NOT_STARTED") < 0) {
    throw new Error("NYC/local phase must remain not started");
  }
  if (!value.no_ranking || !value.no_trust_score) {
    throw new Error("No ranking or Trust Score");
  }
  if (value.mold.result !== "SOURCE_NOT_ACQUIRED" || value.asbestos.result !== "SOURCE_NOT_ACQUIRED") {
    throw new Error("Do not invent mold/asbestos bulk counts");
  }
  if (value.gate.live_cohort_not_inflated !== true) {
    throw new Error("Do not inflate live credentials from this research snapshot");
  }
  return value;
}

export function fmtInt(n: number | null | undefined): string {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-US");
}
