import accepted from "./accepted-snapshot.json";
import { NYC_DOB_PLUTO_INTEL_VERSION, NYC_DOB_PLUTO_PUBLIC_FINGERPRINT } from "./publication";

export const NYC_DOB_SNAPSHOT = accepted;
export type NycDobPlutoSnapshot = typeof accepted;

export function assertNycDobSnapshot(value: NycDobPlutoSnapshot = NYC_DOB_SNAPSHOT): NycDobPlutoSnapshot {
  if (value.version !== NYC_DOB_PLUTO_INTEL_VERSION) throw new Error(`Unexpected DOB/PLUTO contract ${value.version}`);
  if (value.fingerprint !== NYC_DOB_PLUTO_PUBLIC_FINGERPRINT) throw new Error("NYC-CON-002 snapshot fingerprint mismatch");
  if (value.dob_now.parsed_rows !== 337613) throw new Error("DOB NOW window rows drifted");
  if (value.pluto.release !== "26v2") throw new Error("PLUTO release drifted");
  if (value.pluto.no_bin_column !== true) throw new Error("PLUTO has no BIN column");
  if (value.expansion_ledger.NET_NEW_CANONICAL_ORGANIZATIONS !== 0) throw new Error("Do not mint canonical organizations");
  if (value.expansion_ledger.GRAPH_WRITES !== 0) throw new Error("No graph writes");
  if (value.expansion_ledger.EXACT_PROFILE_ATTACHMENTS !== 0) throw new Error("No public profile attachments");
  const ledger = value.expansion_ledger;
  if (ledger.REVIEW_REQUIRED_DOB_ACTOR_ASSOCIATIONS === value.dob_now.parsed_rows) {
    throw new Error("Permit observation rows must not be labeled review-required actor associations");
  }
  if (ledger.PLUTO_MATCHED_BBL_IDENTITIES === ledger.NET_NEW_LOCAL_BBL_IDENTITIES) {
    throw new Error("PLUTO match count must not be labeled as all BBL identities");
  }
  if ("NET_NEW_LOCAL_PROPERTY_IDENTITIES" in ledger) {
    throw new Error("Do not publish a combined property-identity headline");
  }
  if ("NET_NEW_LOCAL_PERMIT_IDENTITIES" in ledger) {
    throw new Error("DOB NOW permits must not be labeled as all acquired permit identities");
  }
  if (!("NET_NEW_LEGACY_BIS_PERMIT_IDENTITIES" in ledger)) {
    throw new Error("Legacy BIS permit identities must be a separate grain");
  }
  if ("EXACT_DOB_BIN_ASSOCIATIONS" in ledger) {
    throw new Error("Distinct BIN identities must not be labeled as cross-dataset associations");
  }
  if (ledger.NET_NEW_LOCAL_BBL_IDENTITIES !== 66923) throw new Error("Union BBL identities drifted");
  if (ledger.NET_NEW_LOCAL_BIN_IDENTITIES !== 73682) throw new Error("Union BIN identities drifted");
  if (ledger.DOB_BBLS_WITHOUT_PLUTO_MATCH !== 398) throw new Error("Unmatched permit BBLs drifted");
  if (ledger.NET_NEW_DOBNOW_PERMIT_IDENTITIES !== 228515) throw new Error("DOB NOW permit identities drifted");
  if (ledger.NET_NEW_LEGACY_BIS_PERMIT_IDENTITIES !== 18858) throw new Error("Legacy permit identities drifted");
  if (ledger.NYC_DOBNOW_DISTINCT_BIN_IDENTITIES !== 70797) throw new Error("DOB NOW BIN identities drifted");
  if (ledger.EXACT_DCWP_DOB_BIN_ASSOCIATIONS !== 29) throw new Error("DCWP-DOB BIN association drifted");
  if (value.identity.name_only !== "UNSAFE") throw new Error("Name-only must remain unsafe");
  if (value.not_a_second_nyc_page !== true) throw new Error("Do not create a second NYC page");
  if (!value.no_ranking || !value.no_trust_score) throw new Error("No ranking or Trust Score");
  if (value.no_acris !== true) throw new Error("ACRIS must remain not started");
  return value;
}

export function fmtInt(n: number | null | undefined): string {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-US");
}
