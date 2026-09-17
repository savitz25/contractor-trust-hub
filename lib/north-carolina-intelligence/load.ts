import "server-only";
import {
  assertNorthCarolinaSnapshot,
  NORTH_CAROLINA_SNAPSHOT,
  type NorthCarolinaContractorSnapshot,
} from "./snapshot";

export function loadNorthCarolinaContractorView(): NorthCarolinaContractorSnapshot {
  return assertNorthCarolinaSnapshot(NORTH_CAROLINA_SNAPSHOT);
}
