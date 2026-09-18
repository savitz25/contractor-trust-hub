import "server-only";
import { assertOhioSnapshot, OHIO_SNAPSHOT, type OhioContractorSnapshot } from "./snapshot";

export function loadOhioContractorView(): OhioContractorSnapshot {
  return assertOhioSnapshot(OHIO_SNAPSHOT);
}
