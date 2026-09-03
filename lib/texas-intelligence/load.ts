import "server-only";

import { CANONICAL_TX_SNAPSHOT_FINGERPRINT } from "./publication";
import { TEXAS_SNAPSHOT, type TexasContractorSnapshot } from "./snapshot";

export function loadTexasContractorView(): TexasContractorSnapshot {
  if (TEXAS_SNAPSHOT.fingerprint !== CANONICAL_TX_SNAPSHOT_FINGERPRINT) {
    throw new Error("TX-CON-001 snapshot fingerprint mismatch");
  }
  if (!TEXAS_SNAPSHOT.gate.passed) {
    throw new Error("TX-CON-001 publication gate failed");
  }
  return TEXAS_SNAPSHOT;
}
