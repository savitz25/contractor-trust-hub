import accepted from "./accepted-snapshot.json";
import { VA_STATE_INTEL_VERSION, VA_STATE_PUBLIC_FINGERPRINT } from "./publication";

export const VIRGINIA_SNAPSHOT = accepted;
export type VirginiaContractorSnapshot = typeof accepted;

export function assertVirginiaSnapshot(
  value: VirginiaContractorSnapshot = VIRGINIA_SNAPSHOT,
): VirginiaContractorSnapshot {
  if (value.version !== VA_STATE_INTEL_VERSION) {
    throw new Error(`Unexpected VA contract ${value.version}`);
  }
  if (value.fingerprint !== VA_STATE_PUBLIC_FINGERPRINT) {
    throw new Error("VA-CON-001 snapshot fingerprint mismatch");
  }
  if (value.statewide_contractor_business_licensing !== true) {
    throw new Error("Virginia must be modeled as a statewide contractor-business licensing system");
  }
  if (value.identity.contractor_business_ne_tradesman_person !== true) {
    throw new Error("Tradesmen must not be contractor businesses");
  }
  if (value.license_class.class_a_ne_best !== true || value.license_class.class_c_ne_worse !== true) {
    throw new Error("Class A/B/C must not be treated as quality");
  }
  if (value.license_class.class_ne_classification !== true) {
    throw new Error("Class must remain distinct from classification/specialty");
  }
  if (value.business_roster.do_not_sum_specialty_tokens_as_contractors !== true) {
    throw new Error("Specialty tokens must not be summed as contractors");
  }
  if (value.discipline.name_only !== "UNSAFE") {
    throw new Error("Name-only discipline attach must be unsafe");
  }
  if (value.discipline.row_ne_case !== true) {
    throw new Error("Discipline row must not equal case");
  }
  if (value.recovery_fund.filing_ne_payment !== true) {
    throw new Error("Recovery Fund filing is not payment");
  }
  if (value.bond_insurance.no_boolean_bonded_from_license_status !== true) {
    throw new Error("Do not invent bonded/insured booleans");
  }
  if (value.expansion_ledger.NET_NEW_CANONICAL_ORGANIZATIONS !== 0) {
    throw new Error("Do not auto-publish Virginia licenses as canonical organizations");
  }
  if (value.expansion_ledger.NET_NEW_PUBLIC_CONTRACTOR_PROFILES !== 0) {
    throw new Error("Do not auto-publish Virginia public contractor profiles");
  }
  if (value.permits.local_routes !== false) {
    throw new Error("Virginia local routes are forbidden in VA-CON-001A");
  }
  if (!value.no_ranking || !value.no_trust_score) {
    throw new Error("Virginia publication must not rank or score");
  }
  if (!value.gate.passed) {
    throw new Error("VA-CON-001A publication gate failed");
  }
  return value;
}

export function fmtInt(n: number | null | undefined): string {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-US");
}
