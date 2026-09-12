import { assertNycSnapshot, NYC_SNAPSHOT, type NycContractorSnapshot } from "./snapshot";

export function loadNycContractorView(): NycContractorSnapshot {
  return assertNycSnapshot(NYC_SNAPSHOT);
}
