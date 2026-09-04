import "server-only";

import { lookupAustinIdentities, type AustinLookupResult } from "./lookup";
import {
  assertTexasAustinLocalSnapshot,
  TEXAS_AUSTIN_LOCAL_SNAPSHOT,
  type TexasAustinLocalSnapshot,
} from "./snapshot";

export function loadTexasAustinLocalSnapshot(): TexasAustinLocalSnapshot {
  return assertTexasAustinLocalSnapshot(TEXAS_AUSTIN_LOCAL_SNAPSHOT);
}

export function loadAustinIdentityLookup(input: {
  company?: string | null;
  phone?: string | null;
  permit?: string | null;
  trade?: string | null;
  zip?: string | null;
}): AustinLookupResult {
  return lookupAustinIdentities(input);
}
