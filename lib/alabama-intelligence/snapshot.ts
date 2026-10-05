import { createHash } from "node:crypto";
import accepted from "./accepted-snapshot.json";
import { AL_STATE_INTEL_VERSION } from "./publication";

export const AL_SNAPSHOT = accepted;
export type AlabamaContractorSnapshot = typeof accepted;

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) out[key] = sortValue((value as Record<string, unknown>)[key]);
    return out;
  }
  return value;
}

export function alabamaSnapshotFingerprint(value: AlabamaContractorSnapshot = AL_SNAPSHOT): string {
  const { fingerprint, generatedAt, ...rest } = value;
  void fingerprint;
  void generatedAt;
  return createHash("sha256").update(JSON.stringify(sortValue(rest))).digest("hex");
}

export function assertAlabamaSnapshot(value: AlabamaContractorSnapshot = AL_SNAPSHOT): AlabamaContractorSnapshot {
  if (value.contract_name !== AL_STATE_INTEL_VERSION) throw new Error(`Unexpected AL contract ${value.contract_name}`);
  if (value.fingerprint !== alabamaSnapshotFingerprint(value)) throw new Error("AL-CON-001 snapshot fingerprint mismatch");
  if (value.path !== "/alabama") throw new Error("Alabama path must be /alabama");
  if (value.rows !== 8848 || value.distinctLicenses !== 8848) throw new Error("ALBGC parsed rows drifted");
  if (value.source.parsedRows !== value.rows || value.source.lineScanDataRows !== value.rows) throw new Error("Parsed rows and line scan diverged");
  if (value.duplicateLicenses !== 0 || value.emptyLicenses !== 0) throw new Error("License numbers are not one row each");
  if (value.explicitSubcontractorSpecialtyRows !== 3312) throw new Error("Source-labelled subcontractor specialty rows drifted");
  if (value.inactiveSpecialtyRows !== 76 || value.otherSpecialtyRows !== 5460 || value.unclassifiedRows !== 5536) {
    throw new Error("Unclassified specialty buckets drifted");
  }
  if (value.explicitSubcontractorSpecialtyRows + value.unclassifiedRows !== value.rows) throw new Error("Specialty buckets do not cover every row");
  if (value.prefixCounts["S-"] !== 3312 || value.prefixCounts["IA-"] !== 76 || value.prefixCounts.numeric !== 5460) {
    throw new Error("License prefix counts drifted");
  }
  if (value.primeContractorLabel !== "NOT_IN_SOURCE") throw new Error("The source does not label a prime-contractor class");
  if (value.businessPersonGrain !== "NOT_LABELED") throw new Error("The Name column is not a business/person grain");
  if (value.statusColumn !== "NOT_IN_SOURCE" || value.expirationIsNotStatus !== true) throw new Error("There is no status column");
  if (value.bidLimitIsLicenseClass !== false) throw new Error("Bid limit is an attribute");
  if (value.bidLimits.reduce((sum, row) => sum + row.count, 0) !== value.rows) throw new Error("Bid limit counts must cover every row");
  if (value.nameOnlySubcontractorText.length !== 3) throw new Error("Three company names contain SUBCONTRACTOR without that specialty label");
  if (value.nameOnlySubcontractorText.some((row) => /SUBCONTRACTOR/i.test(row.specialty))) {
    throw new Error("Name-only rows are not specialty-labelled subcontractors");
  }
  if (value.mailingAddressStateIsNotLicensingState !== true || value.addressIsNotServiceArea !== true) throw new Error("Address semantics");
  if (value.otherBoards.some((board) => board.bulkRoster !== "NOT_ACQUIRED" || board.rows !== null)) {
    throw new Error("Other statewide boards were not acquired");
  }
  if (value.existingMatches !== 0 || value.netNewCanonicalEntities !== 0 || value.newProfiles !== 0 || value.profileAttachments !== 0) {
    throw new Error("No canonical entities or profile attachments");
  }
  if (value.unresolvedIdentities !== value.rows || value.graphWrites !== 0 || value.claimEligibilityBroadened !== false || value.nameOnlyAdverseJoins !== 0) {
    throw new Error("Identities stay unresolved");
  }
  if (value.countyOrLocalRoutes !== 0) throw new Error("No county or local routes");
  if (value.source.sourceAsOf !== null) throw new Error("The file prints no as-of date");
  return value;
}
