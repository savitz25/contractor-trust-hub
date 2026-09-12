import { assertNycAcrisSnapshot, NYC_ACRIS_SNAPSHOT, type NycAcrisSnapshot } from "./snapshot";

export function loadNycAcrisView(): NycAcrisSnapshot {
  return assertNycAcrisSnapshot(NYC_ACRIS_SNAPSHOT);
}
