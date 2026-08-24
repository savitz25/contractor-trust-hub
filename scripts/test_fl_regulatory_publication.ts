import assert from "node:assert/strict";
import {
  evaluatePublicationEligibility,
  isRegulatoryEvidencePublic,
  isRegulatoryEvidenceReachable,
  PUBLIC_REGULATORY_SQL,
  REGULATORY_PUBLICATION_GATE_ACTIVE,
  publicRegulatorySqlForGate,
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
assert.equal(PUBLIC_REGULATORY_SQL, "d.source_system NOT IN ('fl_dbpr', 'fl_dfs')");

const gateOffSql = publicRegulatorySqlForGate(false);
const gateOnSql = publicRegulatorySqlForGate(true);
assert.equal(gateOffSql, "d.source_system NOT IN ('fl_dbpr', 'fl_dfs')");
assert.match(gateOnSql, /d\.source_system NOT IN \('fl_dbpr', 'fl_dfs'\)/);
assert.match(gateOnSql, /d\.source_system = 'fl_dbpr'/);
assert.doesNotMatch(gateOnSql, /d\.source_system = 'fl_dfs'/);
assert.match(gateOnSql, /d\.publication_state = 'PUBLIC_ELIGIBLE'/);
assert.match(gateOnSql, /d\.identity_state IN \('EXACT', 'DETERMINISTIC'\)/);
for (const nonFloridaSource of ["az_roc", "nj_enforcement"]) {
  assert.notEqual(nonFloridaSource, "fl_dbpr");
  assert.equal(gateOffSql.includes("source_system NOT IN ('fl_dbpr', 'fl_dfs')"), true);
  assert.equal(gateOnSql.includes("source_system NOT IN ('fl_dbpr', 'fl_dfs')"), true);
  const legacyNonFloridaRow = {
    ...base,
    identityState: "UNRESOLVED" as const,
    publicationState: "INTERNAL" as const,
  };
  assert.equal(isRegulatoryEvidenceReachable(nonFloridaSource, legacyNonFloridaRow, false), true);
  assert.equal(isRegulatoryEvidenceReachable(nonFloridaSource, legacyNonFloridaRow, true), true);
}

const floridaContractorOnly = {
  ...base,
  licenseId: null,
  identityState: "UNRESOLVED" as const,
  publicationState: "INTERNAL" as const,
};
assert.equal(isRegulatoryEvidenceReachable("fl_dbpr", floridaContractorOnly, false), false);
assert.equal(isRegulatoryEvidenceReachable("fl_dbpr", floridaContractorOnly, true), false);
assert.equal(isRegulatoryEvidenceReachable("fl_dbpr", base, false), false);
assert.equal(isRegulatoryEvidenceReachable("fl_dbpr", base, true), true);

const stopWork = {
  ...base,
  contractorId: null,
  licenseId: null,
  identityState: "UNRESOLVED" as const,
  publicationState: "INTERNAL" as const,
};
assert.equal(isRegulatoryEvidenceReachable("fl_dfs", stopWork, false, "fl_dfs_workers_comp_stop_work"), false);
assert.equal(isRegulatoryEvidenceReachable("fl_dfs", stopWork, true, "fl_dfs_workers_comp_stop_work"), false);
assert.equal(isRegulatoryEvidenceReachable("fl_dfs", base, true, "fl_dfs_workers_comp_stop_work"), false);
assert.equal(isRegulatoryEvidenceReachable("fl_dfs", base, true), false);

console.log("Florida regulatory publication invariants: PASS");
