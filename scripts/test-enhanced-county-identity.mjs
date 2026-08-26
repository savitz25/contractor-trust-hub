#!/usr/bin/env node
/**
 * Prompt 7 identity / jurisdiction unit tests. No database required.
 */
import assert from "node:assert/strict";

function normalizeFullLicense(raw) {
  if (!raw) return "";
  return String(raw).replace(/[\s\-_.]/g, "").toUpperCase();
}
const OCC = /^([A-Z]{2,6})(\d{4,})$/;
function numericCoreOnly(raw) {
  const n = normalizeFullLicense(raw);
  if (!n) return false;
  if (OCC.test(n)) return false;
  return /^\d{4,}$/.test(n);
}
function hasOccupationPrefixedLicense(raw) {
  return OCC.test(normalizeFullLicense(raw));
}
function classify(input) {
  const full = normalizeFullLicense(input.dbprFullLicense);
  if (full && numericCoreOnly(full)) return { identityState: "UNRESOLVED", identityMethod: "UNRESOLVED" };
  if (full && hasOccupationPrefixedLicense(full) && input.dbprLicenseExists) {
    return { identityState: "CONFIRMED", identityMethod: "FULL_DBPR_LICENSE" };
  }
  if (input.localCertificateId && input.localCrosswalksToDbpr && input.dbprLicenseExists) {
    return { identityState: "CONFIRMED", identityMethod: "LOCAL_LICENSE_CROSSWALK" };
  }
  if (input.officialContractorId && input.officialIdLinkedToLicense && input.dbprLicenseExists) {
    return { identityState: "CONFIRMED", identityMethod: "OFFICIAL_CONTRACTOR_ID" };
  }
  if (input.ambiguousName) return { identityState: "UNRESOLVED", identityMethod: "REVIEW_REQUIRED" };
  if (input.nameOnly) return { identityState: "REVIEW_REQUIRED", identityMethod: "REVIEW_REQUIRED" };
  return { identityState: "UNRESOLVED", identityMethod: "UNRESOLVED" };
}

assert.equal(numericCoreOnly("1234567"), true);
assert.equal(numericCoreOnly("CCC1234567"), false);
assert.equal(hasOccupationPrefixedLicense("ccc-1234567"), true);
assert.equal(classify({ dbprFullLicense: "1234567", dbprLicenseExists: true }).identityState, "UNRESOLVED");
assert.equal(
  classify({ dbprFullLicense: "CCC1234567", dbprLicenseExists: true }).identityMethod,
  "FULL_DBPR_LICENSE"
);
assert.equal(
  classify({
    localCertificateId: "U-12345",
    localCrosswalksToDbpr: true,
    dbprLicenseExists: true,
  }).identityMethod,
  "LOCAL_LICENSE_CROSSWALK"
);
assert.equal(classify({ nameOnly: true }).identityState, "REVIEW_REQUIRED");
assert.equal(classify({ ambiguousName: true }).identityState, "UNRESOLVED");
assert.equal(classify({}).identityState, "UNRESOLVED");

function pcnUnincorporated(pcn) {
  return String(pcn || "").replace(/\D/g, "").slice(0, 2) === "00";
}
assert.equal(pcnUnincorporated("00-42-43-27-01-000-0000"), true);
assert.equal(pcnUnincorporated("74-42-43-27-01-000-0000"), false);

const permitKeyA = ["pbc_unincorporated", "12345"].join("|");
const permitKeyB = ["west-palm-beach", "12345"].join("|");
assert.notEqual(permitKeyA, permitKeyB);

console.log("enhanced-county identity/jurisdiction tests passed");
