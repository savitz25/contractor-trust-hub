import "server-only";
import { assertOregonSnapshot, OREGON_SNAPSHOT, type OregonContractorSnapshot } from "./snapshot";

export function loadOregonContractorView(): OregonContractorSnapshot {
  return assertOregonSnapshot(OREGON_SNAPSHOT);
}
