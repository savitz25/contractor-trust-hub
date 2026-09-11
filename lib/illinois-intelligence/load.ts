import "server-only";
import { assertIllinoisSnapshot, ILLINOIS_SNAPSHOT, type IllinoisContractorSnapshot } from "./snapshot";

export function loadIllinoisContractorView(): IllinoisContractorSnapshot {
  return assertIllinoisSnapshot(ILLINOIS_SNAPSHOT);
}
