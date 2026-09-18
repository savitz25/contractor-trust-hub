import accepted from "./accepted-snapshot.json";
import { OH_STATE_INTEL_VERSION, OH_STATE_PUBLIC_FINGERPRINT } from "./publication";

export const OHIO_SNAPSHOT = accepted;
export type OhioContractorSnapshot = typeof accepted;

export function assertOhioSnapshot(value: OhioContractorSnapshot = OHIO_SNAPSHOT): OhioContractorSnapshot {
  if (value.version !== OH_STATE_INTEL_VERSION) throw new Error(`Unexpected OH contract ${value.version}`);
  if (value.fingerprint !== OH_STATE_PUBLIC_FINGERPRINT) {
    throw new Error("OH-CON-001 snapshot fingerprint mismatch");
  }
  if (value.publicationPath !== "/ohio") throw new Error("Ohio path must be /ohio");
  if (value.hero.universe_value !== 9528) throw new Error("do not headline the five-trade row sum");
  if (value.ocilb.OH_OCILB_DISTINCT_LICENSE_HOLDERS !== 9528) throw new Error("numeric holder grain drifted");
  if (value.electrical.OH_OCILB_ELECTRICAL_DISTINCT_CREDENTIALS !== 4489) throw new Error("electrical drifted");
  if (value.hvac.OH_OCILB_HVAC_DISTINCT_CREDENTIALS !== 3129) throw new Error("HVAC drifted");
  if (value.hydronics.OH_OCILB_HYDRONICS_DISTINCT_CREDENTIALS !== 955) throw new Error("hydronics drifted");
  if (value.plumbing.OH_OCILB_PLUMBING_DISTINCT_CREDENTIALS !== 3063) throw new Error("plumbing drifted");
  if (value.refrigeration.OH_OCILB_REFRIGERATION_DISTINCT_CREDENTIALS !== 818) throw new Error("refrigeration drifted");
  if (value.regulatory_model.OH_GENERAL_CONTRACTOR_STATE_ROSTER_STATUS !== "UNSUPPORTED") {
    throw new Error("Ohio has no statewide GC roster");
  }
  if (value.status.OH_OCILB_ACTIVE_IN_RENEWAL_ROWS !== 975) throw new Error("ACTIVE IN RENEWAL drifted");
  if (value.fire_protection.OH_FIRE_INSTALLER_DISTINCT_CERT_IDS !== 19990) throw new Error("SFM installer drifted");
  if (value.fire_protection.OH_FIRE_COMPANY_CERT_ROWS !== 2182) throw new Error("SFM company drifted");
  if (value.fire_protection.OH_FIRE_DESIGNER_ROWS !== null) throw new Error("BBS designer bulk must stay null");
  if (value.discipline.OH_OCILB_DISCIPLINE_COVERAGE !== "OPEN_SEARCH_ONLY") {
    throw new Error("discipline must stay search-only");
  }
  if (value.unlicensed.OH_OCILB_UNLICENSED_ENFORCEMENT_ROWS !== null) {
    throw new Error("unlicensed bulk must stay null");
  }
  if (value.permits.OH_BUILDING_PERMIT_CAPABILITY !== "LOCAL_OR_FRAGMENTED") {
    throw new Error("permit capability drifted");
  }
  if (value.expansion_ledger.GRAPH_WRITES !== 0) throw new Error("no graph writes");
  if (value.expansion_ledger.CLAIM_ELIGIBILITY_BROADENED !== false) {
    throw new Error("claim eligibility unchanged");
  }
  if (!value.no_local_ohio_routes) throw new Error("no local Ohio routes");
  if (!value.no_ranking || !value.no_trust_score) throw new Error("no ranking or Trust Score");
  if (value.local_work_needed_now !== "NO") throw new Error("local work must stay NO");
  return value;
}

export function fmtInt(n: number | null | undefined): string {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-US");
}
