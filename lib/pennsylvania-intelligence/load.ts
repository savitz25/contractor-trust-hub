import "server-only";
import {
  assertPennsylvaniaSnapshot,
  PENNSYLVANIA_SNAPSHOT,
  type PennsylvaniaContractorSnapshot,
} from "./snapshot";

export function loadPennsylvaniaContractorView(): PennsylvaniaContractorSnapshot {
  return assertPennsylvaniaSnapshot(PENNSYLVANIA_SNAPSHOT);
}
