import accepted from "./accepted-snapshot.json";
import { TN_STATE_INTEL_VERSION, TN_STATE_PUBLIC_FINGERPRINT } from "./publication";

export const TENNESSEE_SNAPSHOT = accepted;
export type TennesseeContractorSnapshot = typeof accepted;

export function assertTennesseeSnapshot(
  value: TennesseeContractorSnapshot = TENNESSEE_SNAPSHOT,
): TennesseeContractorSnapshot {
  if (value.contract_name !== TN_STATE_INTEL_VERSION) throw new Error(`Unexpected TN contract ${value.contract_name}`);
  if (value.fingerprint !== TN_STATE_PUBLIC_FINGERPRINT) throw new Error("TN-CON-001 snapshot fingerprint mismatch");
  if (value.path !== "/tennessee") throw new Error("Tennessee path must be /tennessee");
  const ids = value.credential_rules.map((r) => r.id).join(",");
  if (ids !== "contractor,home-improvement,lle,llp") throw new Error("Contractor, HIC, LLE, and LLP stay separate");
  if (value.credential_rules.filter((r) => r.id !== "contractor").some((r) => r.bulk !== "NOT_ACQUIRED")) {
    throw new Error("HIC, LLE, and LLP rosters were not acquired");
  }
  const c = value.contractor_licenses;
  if (c.distinctLicenseNumbers !== 29096 || c.exportRows !== 33994) throw new Error("Contractor export drifted");
  if (c.homeImprovementLleLlpInExport !== false) throw new Error("The export holds Contractor licenses only");
  if (c.monetaryLimitIsNotRevenueOrQuality !== true || c.addressIsNotServiceArea !== true) throw new Error("Limit and address semantics");
  const q = value.qualifying_agents;
  if (q.namesPublished !== false || q.notContractors !== true) throw new Error("Qualifying agents are people, not contractors, and are not named");
  if (Number(q.relationships) === Number(c.distinctLicenseNumbers)) throw new Error("QA relationships are not licenses");
  const d = value.discipline;
  if (d.rows !== 679 || d.coverage !== "PARTIAL") throw new Error("Discipline window drifted");
  if (d.profileAttachments !== 0 || d.licenseNumbersPrinted !== 0) throw new Error("Discipline stays standalone");
  if (value.net_new.NEW_PROFILES !== 0 || value.net_new.PROFILE_ATTACHMENTS !== 0) throw new Error("No new profiles or attachments");
  if (value.capability_matrix.find((r) => r.capability.startsWith("Combined"))?.state !== "UNSUPPORTED") {
    throw new Error("Combined Tennessee contractor total is unsupported");
  }
  return value;
}
