import "server-only";
import {
  assertArizonaSnapshot,
  ARIZONA_SNAPSHOT,
  type ArizonaContractorSnapshot,
} from "./snapshot";

export function loadArizonaContractorView(): ArizonaContractorSnapshot {
  return assertArizonaSnapshot(ARIZONA_SNAPSHOT);
}
