import accepted from "./accepted-snapshot.json";
import { NYC_DCWP_INTEL_VERSION, NYC_DCWP_PUBLIC_FINGERPRINT } from "./publication";

export const NYC_SNAPSHOT = accepted;
export type NycContractorSnapshot = typeof accepted;

export function assertNycSnapshot(value: NycContractorSnapshot = NYC_SNAPSHOT): NycContractorSnapshot {
  if (value.version !== NYC_DCWP_INTEL_VERSION) throw new Error(`Unexpected NYC contract ${value.version}`);
  if (value.fingerprint !== NYC_DCWP_PUBLIC_FINGERPRINT) throw new Error("NYC-CON-001 snapshot fingerprint mismatch");
  if (value.licenses.hic_business_category !== "Home Improvement Contractor") {
    throw new Error("HIC category must remain the official Issued Licenses value");
  }
  if (value.licenses.active_distinct_license_ids !== 13385) throw new Error("Active HIC license IDs drifted");
  if (value.licenses.distinct_license_ids !== 18931) throw new Error("HIC license IDs drifted");
  if (value.licenses.rows_without_license_nbr !== 0) throw new Error("Blank license numbers appeared");
  if (value.expansion_ledger.NET_NEW_CANONICAL_ORGANIZATIONS !== 0) throw new Error("Do not mint canonical organizations");
  if (value.expansion_ledger.NET_NEW_PUBLIC_CONTRACTOR_PROFILES !== 0) throw new Error("Do not mint public profiles");
  if (value.expansion_ledger.GRAPH_WRITES !== 0) throw new Error("No graph writes");
  if (value.expansion_ledger.EXACT_PROFILE_ATTACHMENTS !== 0) throw new Error("No public profile attachments");
  if (value.identity.name_only !== "UNSAFE") throw new Error("Name-only must remain unsafe");
  if (value.no_borough_pages !== true) throw new Error("No borough pages");
  if (value.not_statewide_nysdol_public_work !== true) throw new Error("NYC HIC is not NYSDOL public work");
  if (!value.no_ranking || !value.no_trust_score) throw new Error("No ranking or Trust Score");
  if (value.claim_eligibility.broadened !== false) throw new Error("Claim eligibility must stay unchanged");
  if (value.gate.live_cohort_not_inflated !== true) throw new Error("Do not inflate live credentials");
  return value;
}

export function fmtInt(n: number | null | undefined): string {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-US");
}
