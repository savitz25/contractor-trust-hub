import "server-only";

import { CANONICAL_CA_SNAPSHOT_FINGERPRINT } from "./publication";
import { CALIFORNIA_SNAPSHOT, type CaliforniaContractorSnapshot } from "./snapshot";

export function loadCaliforniaContractorView(): CaliforniaContractorSnapshot {
  if (CALIFORNIA_SNAPSHOT.fingerprint !== CANONICAL_CA_SNAPSHOT_FINGERPRINT) {
    throw new Error("CA-CON-002 snapshot fingerprint mismatch");
  }
  return CALIFORNIA_SNAPSHOT;
}
