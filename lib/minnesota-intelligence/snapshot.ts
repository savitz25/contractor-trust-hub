import accepted from "./accepted-snapshot.json";
import { MN_STATE_INTEL_VERSION, MN_STATE_PUBLIC_FINGERPRINT } from "./publication";

export const MINNESOTA_SNAPSHOT = accepted;
export type MinnesotaContractorSnapshot = typeof accepted;

export function assertMinnesotaSnapshot(value: MinnesotaContractorSnapshot = MINNESOTA_SNAPSHOT): MinnesotaContractorSnapshot {
  if (value.contract_name !== MN_STATE_INTEL_VERSION) throw new Error(`Unexpected MN contract ${value.contract_name}`);
  if (value.fingerprint !== MN_STATE_PUBLIC_FINGERPRINT) throw new Error("MN-CON-001 snapshot fingerprint mismatch");
  if (value.path !== "/minnesota") throw new Error("Minnesota path must be /minnesota");
  const x = value.statewide_export;
  if (x.rows !== 280548 || x.distinctCredentialNumbers !== 280548) throw new Error("DLI export drifted");
  if (x.asOfPrintedByDli !== null) throw new Error("DLI prints no as-of date; none is invented");
  if (x.busPers.Business + x.busPers.Personal !== x.rows) throw new Error("Every row is business or person");
  const r = value.residential_contractors.businessClasses.map((c) => c.subtype).join(",");
  if (!r.startsWith("Residential Building Contractor,Residential Remodeler Contractor,Residential Roofer Contractor")) {
    throw new Error("Residential building contractor, remodeler, and roofer stay separate");
  }
  if (value.residential_contractors.qualifyingPersons.some((c) => c.grain !== "person")) throw new Error("Qualifying persons are people");
  if (value.electrical.businessClasses.some((c) => c.grain !== "business") || value.electrical.personClasses.some((c) => c.grain !== "person")) {
    throw new Error("Electrical business != electrician");
  }
  if (value.plumbing.businessClasses.some((c) => c.grain !== "business") || value.plumbing.personClasses.some((c) => c.grain !== "person")) {
    throw new Error("Plumbing business != plumber");
  }
  const p = value.person_credentials;
  if (p.namePublished !== false || p.cityPublished !== false || p.notContractors !== true) throw new Error("Person credentials are number-only");
  const e = value.enforcement;
  if (e.rows !== 511 || e.coverage !== "PARTIAL") throw new Error("Enforcement window drifted");
  if (e.nameOnlyAttachment !== false || e.databaseProfileAttachments !== 0) throw new Error("Enforcement attaches by exact credential number only");
  if (value.net_new.NEW_PROFILES !== 0 || value.net_new.DATABASE_WRITES !== 0) throw new Error("No new profiles or database writes");
  if (value.existing_coverage.databaseModified !== false) throw new Error("Production was read only");
  if (value.capability_matrix.find((c) => c.capability.startsWith("Combined"))?.state !== "UNSUPPORTED") {
    throw new Error("Combined Minnesota contractor total is unsupported");
  }
  return value;
}
