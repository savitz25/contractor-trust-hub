import accepted from "./accepted-snapshot.json";
import { OR_STATE_INTEL_VERSION, OR_STATE_PUBLIC_FINGERPRINT } from "./publication";

export const OREGON_SNAPSHOT = accepted;
export type OregonContractorSnapshot = typeof accepted;

export function assertOregonSnapshot(
  value: OregonContractorSnapshot = OREGON_SNAPSHOT,
): OregonContractorSnapshot {
  if (value.version !== OR_STATE_INTEL_VERSION) throw new Error(`Unexpected OR contract ${value.version}`);
  if (value.fingerprint !== OR_STATE_PUBLIC_FINGERPRINT) throw new Error("OR-CON-001 snapshot fingerprint mismatch");
  if (value.ccb.SOURCE_ROWS !== 56172) throw new Error("CCB source rows drifted");
  if (value.ccb.DISTINCT_NONEMPTY_LICENSE_IDS !== 45501) throw new Error("CCB distinct IDs drifted");
  if (value.hero.universe_value !== 45501) throw new Error("headline must be distinct CCB license IDs");
  if (Number(value.hero.universe_value) === Number(value.ccb.SOURCE_ROWS)) {
    throw new Error("do not headline source rows");
  }
  if (value.bcd.ENTITY_GRAIN_DISTINCT_IDS.BUSINESS !== 5562) throw new Error("BCD business IDs drifted");
  if (value.bcd.not_added_to_ccb_denominator !== true) throw new Error("BCD must not be added to CCB");
  if (value.expansion_ledger.NET_NEW_CANONICAL_ORGANIZATIONS !== 0) throw new Error("no canonical writes");
  if (value.expansion_ledger.GRAPH_WRITES !== 0) throw new Error("no graph writes");
  if (value.claimEligibilityBroadened !== false) throw new Error("claim eligibility unchanged");
  if (value.no_portland_page !== true) throw new Error("no Portland page");
  if (!value.no_ranking || !value.no_trust_score) throw new Error("no ranking or Trust Score");
  if (value.gate.live_cohort_not_inflated !== true) throw new Error("do not inflate live credentials");
  if (value.adverse.ccb_public_contract_ineligibility.PUBLICATION_STATUS !== "SOURCE_CURRENTLY_LISTS_NONE") {
    throw new Error("public-contract list observation drifted");
  }
  return value;
}

export function fmtInt(n: number | null | undefined): string {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-US");
}
