import { assertNycDobSnapshot, NYC_DOB_SNAPSHOT, type NycDobPlutoSnapshot } from "./snapshot";

export function loadNycDobPlutoView(): NycDobPlutoSnapshot {
  return assertNycDobSnapshot(NYC_DOB_SNAPSHOT);
}
