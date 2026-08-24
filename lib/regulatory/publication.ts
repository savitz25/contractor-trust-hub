export const PUBLIC_IDENTITY_STATES = ["EXACT", "DETERMINISTIC"] as const;

export type RegulatoryIdentityState =
  | "EXACT"
  | "DETERMINISTIC"
  | "REVIEW_REQUIRED"
  | "UNRESOLVED";

export type RegulatoryPublicationState = "INTERNAL" | "PUBLIC_ELIGIBLE" | "WITHHELD";

export type RegulatoryPublicationRecord = {
  contractorId: string | null;
  licenseId: string | null;
  identityState: RegulatoryIdentityState;
  publicationState: RegulatoryPublicationState;
  correctionHold: boolean;
  retractionHold: boolean;
};

export type PublicationEligibilityInput = RegulatoryPublicationRecord & {
  authoritativeSource: boolean;
  validLicenseContractorRelationship: boolean;
  recognizedRegulatorySemantics: boolean;
  provenanceComplete: boolean;
  sourceFresh: boolean;
  identifierConflict: boolean;
};

export function evaluatePublicationEligibility(
  input: PublicationEligibilityInput
): RegulatoryPublicationState {
  if (input.correctionHold || input.retractionHold) return "WITHHELD";
  if (
    !PUBLIC_IDENTITY_STATES.includes(
      input.identityState as (typeof PUBLIC_IDENTITY_STATES)[number]
    ) ||
    !input.contractorId ||
    !input.licenseId ||
    !input.authoritativeSource ||
    !input.validLicenseContractorRelationship ||
    !input.recognizedRegulatorySemantics ||
    !input.provenanceComplete ||
    !input.sourceFresh ||
    input.identifierConflict
  ) {
    return "INTERNAL";
  }
  return "PUBLIC_ELIGIBLE";
}

/** Mirrors the database/public-query fail-closed predicate. */
export function isRegulatoryEvidencePublic(record: RegulatoryPublicationRecord): boolean {
  return (
    record.publicationState === "PUBLIC_ELIGIBLE" &&
    PUBLIC_IDENTITY_STATES.includes(
      record.identityState as (typeof PUBLIC_IDENTITY_STATES)[number]
    ) &&
    Boolean(record.contractorId) &&
    Boolean(record.licenseId) &&
    !record.correctionHold &&
    !record.retractionHold
  );
}

/** Shared-table visibility contract used by tests and non-SQL consumers. */
export function isRegulatoryEvidenceReachable(
  sourceSystem: string,
  record: RegulatoryPublicationRecord,
  gateActive: boolean,
  sourceDataset?: string
): boolean {
  // DFS datasets have no public policy yet. Fail closed even when a caller
  // omits sourceDataset; a future DFS publication task must add an explicit,
  // reviewed allowlist before any DFS evidence can become reachable.
  if (sourceSystem === "fl_dfs") return false;
  if (sourceSystem !== "fl_dbpr") return true;
  return gateActive && isRegulatoryEvidencePublic(record);
}

/**
 * SQL fragment for the shared discipline_actions table aliased as `d`.
 * This feature gate controls Florida DBPR and DFS rows. Arizona, New Jersey,
 * and future non-FL sources retain their existing visibility behavior.
 * Stop-work evidence is dataset-excluded until separately approved.
 * Before migration/backfill activation, Florida rows are excluded without
 * referencing the Florida-v1 columns.
 */
export function publicRegulatorySqlForGate(active: boolean): string {
  return active ? `
  (
    d.source_system NOT IN ('fl_dbpr', 'fl_dfs')
    OR (
      d.source_system = 'fl_dbpr'
      AND d.publication_state = 'PUBLIC_ELIGIBLE'
      AND d.identity_state IN ('EXACT', 'DETERMINISTIC')
      AND d.contractor_id IS NOT NULL
      AND d.license_id IS NOT NULL
      AND d.correction_hold = FALSE
      AND d.retraction_hold = FALSE
    )
  )
` : "d.source_system NOT IN ('fl_dbpr', 'fl_dfs')";
}

export const REGULATORY_PUBLICATION_GATE_ACTIVE =
  process.env.REGULATORY_PUBLICATION_GATE_V1 === "1";

export const PUBLIC_REGULATORY_SQL = publicRegulatorySqlForGate(
  REGULATORY_PUBLICATION_GATE_ACTIVE
);
