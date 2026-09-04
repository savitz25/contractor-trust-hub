import accepted from "./accepted-snapshot.json";
import { WA_STATE_INTEL_VERSION, WA_STATE_PUBLIC_FINGERPRINT } from "./publication";

export type WashingtonContractorSnapshot = typeof accepted;
export const WASHINGTON_SNAPSHOT = accepted as WashingtonContractorSnapshot;

export function assertWashingtonSnapshot(
  value: WashingtonContractorSnapshot = WASHINGTON_SNAPSHOT,
): WashingtonContractorSnapshot {
  if (value.version !== WA_STATE_INTEL_VERSION) {
    throw new Error(`Unexpected WA contract ${value.version}`);
  }
  if (value.fingerprint !== WA_STATE_PUBLIC_FINGERPRINT) {
    throw new Error("WA-CON-001 snapshot fingerprint mismatch");
  }
  if (value.general.rows !== value.general.distinct_registration_ids) {
    throw new Error("WA general grain is not unique ContractorLicenseNumber");
  }
  if (!value.no_ranking || !value.no_trust_score) {
    throw new Error("Washington publication must not rank or score");
  }
  if (!value.bond.no_row_ne_unbonded || !value.insurance.no_row_ne_uninsured) {
    throw new Error("Missing bond/insurance rows must not be treated as unbonded/uninsured");
  }
  if (!value.gate.passed) {
    throw new Error("WA-CON-001 publication gate failed");
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
