import accepted from "./accepted-snapshot.json";
import { CA_LOCAL_INTEL_VERSION, CA_LOCAL_PUBLIC_FINGERPRINT } from "./publication";

export type CaliforniaLocalSnapshot = typeof accepted;
export const CALIFORNIA_LOCAL_SNAPSHOT = accepted as CaliforniaLocalSnapshot;

export function assertCaliforniaLocalSnapshot(
  value: CaliforniaLocalSnapshot = CALIFORNIA_LOCAL_SNAPSHOT,
): CaliforniaLocalSnapshot {
  if (value.version !== CA_LOCAL_INTEL_VERSION) {
    throw new Error(`Unexpected CA local contract ${value.version}`);
  }
  if (value.fingerprint !== CA_LOCAL_PUBLIC_FINGERPRINT) {
    throw new Error("CA-CON-COUNTY-002 snapshot fingerprint mismatch");
  }
  if (value.san_francisco.permits.rows !== 1_294_909) {
    throw new Error("SF permit row count drifted");
  }
  if (value.los_angeles.cofo.rows !== 132_426) {
    throw new Error("LA CofO row count drifted");
  }
  if (value.publication.rankings || value.publication.trustScore) {
    throw new Error("Local publication must not rank or score");
  }
  return value;
}

export function fmtInt(n: number | null | undefined): string {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-US");
}
