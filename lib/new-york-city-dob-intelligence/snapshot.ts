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
