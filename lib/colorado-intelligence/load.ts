import "server-only";
import {
  assertColoradoSnapshot,
  COLORADO_SNAPSHOT,
  type ColoradoContractorSnapshot,
} from "./snapshot";
import { lookupColoradoBusinessCredentials, type CoLookupResult } from "./lookup";

export function loadColoradoContractorView(): ColoradoContractorSnapshot {
  return assertColoradoSnapshot(COLORADO_SNAPSHOT);
}

export function loadColoradoIdentityLookup(input: {
  q?: string | null;
  prefix?: string | null;
  number?: string | null;
  city?: string | null;
  status?: string | null;
}): CoLookupResult {
  return lookupColoradoBusinessCredentials(input);
}
