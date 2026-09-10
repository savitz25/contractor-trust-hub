import "server-only";
import {
  assertVirginiaSnapshot,
  VIRGINIA_SNAPSHOT,
  type VirginiaContractorSnapshot,
} from "./snapshot";

export function loadVirginiaContractorView(): VirginiaContractorSnapshot {
  return assertVirginiaSnapshot(VIRGINIA_SNAPSHOT);
}
