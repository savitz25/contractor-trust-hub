import accepted from "./accepted-snapshot.json";
import { TX_AUSTIN_INTEL_VERSION, TX_AUSTIN_PUBLIC_FINGERPRINT } from "./publication";

export type TexasAustinLocalSnapshot = typeof accepted;
export const TEXAS_AUSTIN_LOCAL_SNAPSHOT = accepted as TexasAustinLocalSnapshot;

export function assertTexasAustinLocalSnapshot(
  value: TexasAustinLocalSnapshot = TEXAS_AUSTIN_LOCAL_SNAPSHOT,
): TexasAustinLocalSnapshot {
  if (value.version !== TX_AUSTIN_INTEL_VERSION) {
    throw new Error(`Unexpected TX Austin local contract ${value.version}`);
  }
  if (value.fingerprint !== TX_AUSTIN_PUBLIC_FINGERPRINT) {
    throw new Error("TX-CON-LOCAL-002 snapshot fingerprint mismatch");
  }
  if (value.austin.rows !== 2_373_854) {
    throw new Error("Austin permit row count drifted");
  }
  if (value.austin.exact_state_credential !== 0) {
    throw new Error("Austin source has no exact state credential IDs");
  }
  if (!value.austin.high_confidence_is_not_license_verification) {
    throw new Error("HIGH_CONFIDENCE must not be treated as license verification");
  }
  if (value.publication.rankings || value.publication.trustScore) {
    throw new Error("Austin publication must not rank or score");
  }
  if (value.publication.dedicated.length !== 1 || value.publication.dedicated[0] !== "/texas/austin") {
    throw new Error("Austin is the only Texas local page");
  }
  return value;
}

export function fmtInt(n: number | null | undefined): string {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-US");
}
