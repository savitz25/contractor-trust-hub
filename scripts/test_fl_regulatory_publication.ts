import assert from "node:assert/strict";
import {
  evaluatePublicationEligibility,
  isRegulatoryEvidencePublic,
  PUBLIC_REGULATORY_SQL,
  REGULATORY_PUBLICATION_GATE_ACTIVE,
} from "../lib/regulatory/publication.ts";

const base = {
  contractorId: "contractor",
  licenseId: "license",
  identityState: "EXACT" as const,
  publicationState: "PUBLIC_ELIGIBLE" as const,
  correctionHold: false,
  retractionHold: false,
};

assert.equal(isRegulatoryEvidencePublic(base), true);
assert.equal(isRegulatoryEvidencePublic({ ...base, publicationState: "INTERNAL" }), false);
assert.equal(isRegulatoryEvidencePublic({ ...base, identityState: "REVIEW_REQUIRED" }), false);
assert.equal(isRegulatoryEvidencePublic({ ...base, identityState: "UNRESOLVED" }), false);
assert.equal(isRegulatoryEvidencePublic({ ...base, publicationState: "WITHHELD" }), false);
assert.equal(isRegulatoryEvidencePublic({ ...base, contractorId: null }), false);
assert.equal(isRegulatoryEvidencePublic({ ...base, licenseId: null }), false);
assert.equal(isRegulatoryEvidencePublic({ ...base, correctionHold: true }), false);
assert.equal(isRegulatoryEvidencePublic({ ...base, retractionHold: true }), false);

const eligibility = {
  ...base,
  authoritativeSource: true,
  validLicenseContractorRelationship: true,
  recognizedRegulatorySemantics: true,
  provenanceComplete: true,
  sourceFresh: true,
  identifierConflict: false,
};
assert.equal(evaluatePublicationEligibility(eligibility), "PUBLIC_ELIGIBLE");
assert.equal(evaluatePublicationEligibility({ ...eligibility, recognizedRegulatorySemantics: false }), "INTERNAL");
assert.equal(evaluatePublicationEligibility({ ...eligibility, provenanceComplete: false }), "INTERNAL");
assert.equal(evaluatePublicationEligibility({ ...eligibility, sourceFresh: false }), "INTERNAL");
assert.equal(evaluatePublicationEligibility({ ...eligibility, identifierConflict: true }), "INTERNAL");
assert.equal(evaluatePublicationEligibility({ ...eligibility, retractionHold: true }), "WITHHELD");
assert.equal(REGULATORY_PUBLICATION_GATE_ACTIVE, false);
assert.equal(PUBLIC_REGULATORY_SQL, "d.source_system <> 'fl_dbpr'");

console.log("Florida regulatory publication invariants: PASS");
