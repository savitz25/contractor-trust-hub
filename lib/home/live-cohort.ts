/**
 * Canonical public live-state / license-source cohort.
 * Derived from lib/states/config — same list as Verify tabs and homepage tiles.
 */
import {
  getLiveStateCount,
  getLiveStates,
  licenseSourcesFor,
  type EvidenceState,
} from "@/lib/states/config";

export function liveEvidenceStates(): EvidenceState[] {
  return getLiveStates();
}

export function liveLicenseSourceSystems(): string[] {
  const set = new Set<string>();
  for (const state of getLiveStates()) {
    for (const src of licenseSourcesFor(state)) {
      set.add(src);
    }
  }
  return [...set].sort();
}

export function liveStateCount(): number {
  return getLiveStateCount();
}

export function liveStatesBySource(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const state of getLiveStates()) {
    for (const src of licenseSourcesFor(state)) {
      if (!out[src]) out[src] = [];
      if (!out[src].includes(state.code)) out[src].push(state.code);
    }
  }
  return out;
}
