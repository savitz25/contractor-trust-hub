import "server-only";
import {
  assertNewYorkSnapshot,
  NEW_YORK_SNAPSHOT,
  type NewYorkContractorSnapshot,
} from "./snapshot";

export function loadNewYorkContractorView(): NewYorkContractorSnapshot {
  return assertNewYorkSnapshot(NEW_YORK_SNAPSHOT);
}
