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

export const REGULATORY_PUBLICATION_GATE_ACTIVE =
  process.env.REGULATORY_PUBLICATION_GATE_V1 === "1";

/**
 * SQL fragment for discipline_actions aliased as `d`.
 * Before migration/backfill activation the predicate is literal FALSE, which is
 * compatible with the old schema and guarantees zero adverse exposure.
 */
export const PUBLIC_REGULATORY_SQL = REGULATORY_PUBLICATION_GATE_ACTIVE ? `
  d.publication_state = 'PUBLIC_ELIGIBLE'
  AND d.identity_state IN ('EXACT', 'DETERMINISTIC')
  AND d.contractor_id IS NOT NULL
  AND d.license_id IS NOT NULL
  AND d.correction_hold = FALSE
  AND d.retraction_hold = FALSE
` : "FALSE";
