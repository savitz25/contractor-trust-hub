import accepted from "./accepted-snapshot.json";
import { CO_STATE_INTEL_VERSION, CO_STATE_PUBLIC_FINGERPRINT } from "./publication";

export const COLORADO_SNAPSHOT = accepted;
export type ColoradoContractorSnapshot = typeof accepted;

export function assertColoradoSnapshot(
  value: ColoradoContractorSnapshot = COLORADO_SNAPSHOT,
): ColoradoContractorSnapshot {
  if (value.version !== CO_STATE_INTEL_VERSION) {
    throw new Error(`Unexpected CO contract ${value.version}`);
  }
  if (value.fingerprint !== CO_STATE_PUBLIC_FINGERPRINT) {
    throw new Error("CO-CON-001 snapshot fingerprint mismatch");
  }
  if (value.no_statewide_general_contractor_universe !== true) {
    throw new Error("Colorado must not claim a statewide GC universe");
  }
  if (value.business_credentials.do_not_headline_ec_plus_pc_as_colorado_contractors !== true) {
    throw new Error("EC+PC must not be headlined as Colorado contractors");
  }
  if (value.identity.license_number_alone_not_globally_unique !== true) {
    throw new Error("licenseNumber alone is not a global identity");
  }
  if (value.discipline.name_only !== "UNSAFE") {
    throw new Error("Name-only discipline attach must be unsafe");
  }
  if (value.discipline.row_ne_case !== true) {
    throw new Error("Discipline row must not equal case");
  }
  if (value.bond_insurance.missing_ne_zero !== true) {
    throw new Error("Missing bond/insurance is not zero");
  }
  if (value.permits.denver_ingested !== false || value.permits.local_routes !== false) {
    throw new Error("Denver/local routes are forbidden in CO-CON-001");
  }
  if (value.apprentices.publication !== "INTERNAL") {
    throw new Error("Apprentices must remain internal");
  }
  if (value.aels.not_general_contractors !== true) {
    throw new Error("AELS must not be treated as general contractors");
  }
  if (value.expansion_ledger.NET_NEW_CANONICAL_ORGANIZATIONS !== 0) {
    throw new Error("Do not claim EC/PC rows as net-new companies");
  }
  if (!value.no_ranking || !value.no_trust_score) {
    throw new Error("Colorado publication must not rank or score");
  }
  if (!value.gate.passed) {
    throw new Error("CO-CON-001 publication gate failed");
  }
  return value;
}

export function fmtInt(n: number | null | undefined): string {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-US");
}
