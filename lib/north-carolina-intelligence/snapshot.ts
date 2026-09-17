import accepted from "./accepted-snapshot.json";
import { NC_STATE_INTEL_VERSION, NC_STATE_PUBLIC_FINGERPRINT } from "./publication";

export const NORTH_CAROLINA_SNAPSHOT = accepted;
export type NorthCarolinaContractorSnapshot = typeof accepted;

export function assertNorthCarolinaSnapshot(
  value: NorthCarolinaContractorSnapshot = NORTH_CAROLINA_SNAPSHOT,
): NorthCarolinaContractorSnapshot {
  if (value.version !== NC_STATE_INTEL_VERSION) throw new Error(`Unexpected NC contract ${value.version}`);
  if (value.fingerprint !== NC_STATE_PUBLIC_FINGERPRINT) {
    throw new Error("NC-CON-001 snapshot fingerprint mismatch");
  }
  if (value.publicationPath !== "/north-carolina") throw new Error("North Carolina path must be /north-carolina");
  if (value.nclbgc.NC_NCLBGC_ROSTER_STATUS !== "OPEN_SEARCH_ONLY") {
    throw new Error("NCLBGC bulk must remain OPEN_SEARCH_ONLY");
  }
  if (value.nclbgc.NC_NCLBGC_ROWS !== null) throw new Error("NCLBGC rows must be null, not zero");
  if (value.hero.universe_value !== null) throw new Error("do not headline a manufactured NC contractor census");
  if (value.hero.universe_value === 38523) throw new Error("do not headline 38,523 as active");
  if (value.nclbgc.threshold_usd !== 40000) throw new Error("GC threshold drifted");
  if (value.limitations.Limited.single_project_ceiling_usd !== 750000) throw new Error("Limited ceiling drifted");
  if (value.limitations.Intermediate.single_project_ceiling_usd !== 1500000) {
    throw new Error("Intermediate ceiling drifted");
  }
  if (value.limitations.Unlimited.single_project_ceiling_usd !== null) throw new Error("Unlimited must stay unrestricted");
  if (value.doa_debarment.NC_DOA_DEBARRED_VENDOR_ROWS !== 236) throw new Error("DOA debarment drifted");
  if (value.licensed_summaries.NC_NCLBGC_LICENSED_CASE_SUMMARY_ROWS !== 49) {
    throw new Error("licensed summaries drifted");
  }
  if (value.unlicensed.NC_NCLBGC_UNLICENSED_UNIQUE_CASES !== 43) throw new Error("unlicensed cases drifted");
  if (value.phfs_attorney.NC_PHFS_ATTORNEY_REPORT_ROWS !== 91) throw new Error("PHFS attorney rows drifted");
  if (value.electrical.NC_ELECTRICAL_ROSTER_STATUS !== "OPEN_SEARCH_ONLY") {
    throw new Error("electrical roster must stay search-only");
  }
  if (value.phfs.NC_PHFS_ROSTER_STATUS !== "OPEN_SEARCH_ONLY") throw new Error("PHFS roster must stay search-only");
  if (value.permits.NC_BUILDING_PERMIT_CAPABILITY !== "LOCAL_OR_FRAGMENTED") {
    throw new Error("permit capability drifted");
  }
  if (value.identity.EXACT_PROFILE_ATTACHMENTS !== 0) throw new Error("no profile attachments");
  if (value.expansion_ledger.GRAPH_WRITES !== 0) throw new Error("no graph writes");
  if (value.expansion_ledger.CLAIM_ELIGIBILITY_BROADENED !== false) {
    throw new Error("claim eligibility unchanged");
  }
  if (!value.no_local_north_carolina_routes) throw new Error("no local North Carolina routes");
  if (!value.no_ranking || !value.no_trust_score) throw new Error("no ranking or Trust Score");
  if (value.local_work_needed_now !== "NO") throw new Error("local work must stay NO");
  return value;
}

export function fmtInt(n: number | null | undefined): string {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-US");
}
