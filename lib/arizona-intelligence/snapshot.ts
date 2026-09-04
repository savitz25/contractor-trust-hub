import accepted from "./accepted-snapshot.json";
import { AZ_STATE_INTEL_VERSION, AZ_STATE_PUBLIC_FINGERPRINT } from "./publication";

export type ArizonaContractorSnapshot = typeof accepted;
export const ARIZONA_SNAPSHOT = accepted as ArizonaContractorSnapshot;

export function assertArizonaSnapshot(
  value: ArizonaContractorSnapshot = ARIZONA_SNAPSHOT,
): ArizonaContractorSnapshot {
  if (value.version !== AZ_STATE_INTEL_VERSION) {
    throw new Error(`Unexpected AZ contract ${value.version}`);
  }
  if (value.fingerprint !== AZ_STATE_PUBLIC_FINGERPRINT) {
    throw new Error("AZ-CON-001 snapshot fingerprint mismatch");
  }
  if (value.current_posting.files_are_not_additive !== true) {
    throw new Error("Commercial/Residential/Dual files must not be additive");
  }
  if (value.identity.license_row_ne_unique_company !== true) {
    throw new Error("License row must not be treated as a unique company");
  }
  if (value.expansion_ledger.NET_NEW_CANONICAL_ORGANIZATIONS !== 0) {
    throw new Error("Do not claim the current posting as net-new companies");
  }
  if (!value.no_ranking || !value.no_trust_score) {
    throw new Error("Arizona publication must not rank or score");
  }
  if (!value.gate.passed) {
    throw new Error("AZ-CON-001 publication gate failed");
  }
  return value;
}

export function fmtInt(n: number | null | undefined): string {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-US");
}

export function fmtHero(value: string | number): string {
  if (typeof value === "number") return fmtInt(value);
  return value;
}
