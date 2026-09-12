import accepted from "./accepted-snapshot.json";
import { NYC_ACRIS_INTEL_VERSION, NYC_ACRIS_PUBLIC_FINGERPRINT } from "./publication";

export const NYC_ACRIS_SNAPSHOT = accepted;
export type NycAcrisSnapshot = typeof accepted;

export function assertNycAcrisSnapshot(value: NycAcrisSnapshot = NYC_ACRIS_SNAPSHOT): NycAcrisSnapshot {
  if (value.version !== NYC_ACRIS_INTEL_VERSION) throw new Error(`Unexpected ACRIS contract ${value.version}`);
  if (value.fingerprint !== NYC_ACRIS_PUBLIC_FINGERPRINT) throw new Error("NYC-CON-003 snapshot fingerprint mismatch");
  if (value.master.parsed_rows !== 581566) throw new Error("ACRIS master window rows drifted");
  if (value.master.parsed_rows === value.legals.parsed_rows) throw new Error("Do not treat master rows as legal rows");
  if (value.expansion_ledger.NET_NEW_CANONICAL_ORGANIZATIONS !== 0) throw new Error("Do not mint canonical organizations");
  if (value.expansion_ledger.GRAPH_WRITES !== 0) throw new Error("No graph writes");
  if (value.expansion_ledger.EXACT_PROFILE_ATTACHMENTS !== 0) throw new Error("No public profile attachments");
  if (value.identity.name_only !== "UNSAFE") throw new Error("Name-only must remain unsafe");
  if (value.coverage.state !== "PARTIAL") throw new Error("Staten Island coverage must remain partial");
  if (value.not_a_second_nyc_page !== true) throw new Error("Do not create a second NYC page");
  if (!value.no_title_chain || !value.no_beneficial_ownership) throw new Error("No title-chain or beneficial ownership");
  return value;
}

export function fmtInt(n: number | null | undefined): string {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-US");
}
