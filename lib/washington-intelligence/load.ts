import "server-only";

import { lookupWashingtonIdentities, type WaLookupResult } from "./lookup";
import {
  assertWashingtonSnapshot,
  WASHINGTON_SNAPSHOT,
  type WashingtonContractorSnapshot,
} from "./snapshot";

export function loadWashingtonContractorView(): WashingtonContractorSnapshot {
  return assertWashingtonSnapshot(WASHINGTON_SNAPSHOT);
}

export function loadWashingtonIdentityLookup(input: {
  q?: string | null;
  registration?: string | null;
  ubi?: string | null;
  city?: string | null;
  zip?: string | null;
  type?: string | null;
  specialty?: string | null;
  status?: string | null;
}): WaLookupResult {
  return lookupWashingtonIdentities(input);
}
