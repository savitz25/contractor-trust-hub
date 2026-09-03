import "server-only";
import {
  assertCaliforniaLocalSnapshot,
  CALIFORNIA_LOCAL_SNAPSHOT,
  type CaliforniaLocalSnapshot,
} from "./snapshot";
import { lookupExactLocalActivity, type ExactLocalActivity } from "./lookup";

export function loadCaliforniaLocalSnapshot(): CaliforniaLocalSnapshot {
  return assertCaliforniaLocalSnapshot(CALIFORNIA_LOCAL_SNAPSHOT);
}

export function loadExactLocalActivity(raw: string | null | undefined): ExactLocalActivity | null {
  return lookupExactLocalActivity(raw);
}
