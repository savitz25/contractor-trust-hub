import accepted from "./accepted-snapshot.json";
import { NV_STATE_INTEL_VERSION, NV_STATE_PUBLIC_FINGERPRINT } from "./publication";

export const NEVADA_SNAPSHOT = accepted;
export type NevadaContractorSnapshot = typeof accepted;

export function assertNevadaSnapshot(value: NevadaContractorSnapshot = NEVADA_SNAPSHOT): NevadaContractorSnapshot {
  if (value.contract_name !== NV_STATE_INTEL_VERSION) throw new Error(`Unexpected NV contract ${value.contract_name}`);
  if (value.fingerprint !== NV_STATE_PUBLIC_FINGERPRINT) throw new Error("NV-CON-001 snapshot fingerprint mismatch");
  if (value.path !== "/nevada") throw new Error("Nevada path must be /nevada");
  if (value.license_model.classes.map((c) => c.id).join(",") !== "A,B,AB,C,E") throw new Error("A, B, AB, C, and E stay separate");
  const c = value.contractor_licenses;
  if (c.distinctLicenseNumbers !== 19213) throw new Error("NSCB active directory drifted");
  if (c.addressIsNotServiceArea !== true || c.statusIsAsPublished !== true) throw new Error("Address and status semantics");
  const k = value.classifications;
  if (k.relationshipsAreNotContractors !== true || k.relationships === c.distinctLicenseNumbers) throw new Error("Classification relationships are not licenses");
  if (value.monetary_limits.monetaryLimitIsNotRevenueOrQuality !== true) throw new Error("Monetary limit is a regulatory limit");
  const q = value.qualified_individuals;
  if (q.namesPublished !== false || q.notContractors !== true || q.acquired !== "NOT_ACQUIRED") throw new Error("Qualified individuals are people, not contractors, and are not named");
  const d = value.discipline;
  if (d.rows !== 609 || d.coverage !== "PARTIAL") throw new Error("Discipline window drifted");
  if (d.nameOnlyAttachment !== false || d.databaseProfileAttachments !== 0) throw new Error("Discipline attaches by exact license number only");
  if (value.net_new.NEW_PROFILES !== 0 || value.net_new.DATABASE_WRITES !== 0) throw new Error("No new profiles or database writes");
  if (value.capability_matrix.find((r) => r.capability.startsWith("Combined"))?.state !== "UNSUPPORTED") {
    throw new Error("Combined Nevada contractor total is unsupported");
  }
  return value;
}
