import "server-only";

import { CANONICAL_NJ_SNAPSHOT_FINGERPRINT } from "./publication";
import { NEW_JERSEY_SNAPSHOT, type NewJerseyContractorSnapshot } from "./snapshot";

export function loadNewJerseyContractorView(): NewJerseyContractorSnapshot {
  if (NEW_JERSEY_SNAPSHOT.fingerprint !== CANONICAL_NJ_SNAPSHOT_FINGERPRINT) {
    throw new Error("NJ-CON-004 snapshot fingerprint mismatch");
  }
  return NEW_JERSEY_SNAPSHOT;
}
