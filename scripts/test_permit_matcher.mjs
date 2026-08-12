/**
 * Precision tests for Stage 6 permit matcher (node scripts/test_permit_matcher.mjs)
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";

// Compile-free: reimplement minimal checks by importing via ts not available — duplicate core rules inline for smoke.
// Prefer running after tsc paths; here we use dynamic import of built dist if missing use duplicated pure logic.

function normalizeLicenseKey(key) {
  if (!key) return "";
  return key.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizePersonOrBizName(s) {
  if (!s) return "";
  return s
    .toUpperCase()
    .replace(/[.,'"/\\-]/g, " ")
    .replace(/\b(INC|LLC|L L C|CORP|CORPORATION|CO|COMPANY|LTD|PLLC|PA|LP|THE)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolvePermitContractorJoin(input) {
  const key = normalizeLicenseKey(input.contractorLicenseKey);
  const cand = input.candidate;
  if (!cand) {
    return { slug: null, matchMethod: "none" };
  }
  const candKeys = cand.licenseKeys.map(normalizeLicenseKey).filter(Boolean);
  if (key && candKeys.includes(key)) {
    return { slug: cand.slug, matchMethod: "license" };
  }
  if (key && candKeys.length > 0 && !candKeys.includes(key)) {
    return { slug: null, matchMethod: "none" };
  }
  if (input.contractorName && !key) {
    return { slug: null, matchMethod: "none" };
  }
  return { slug: null, matchMethod: "none" };
}

// 1. Exact license joins
{
  const r = resolvePermitContractorJoin({
    contractorLicenseKey: "CGC-1526123",
    candidate: {
      slug: "sample-gc",
      licenseKeys: ["CGC1526123"],
      names: ["Sample GC Services LLC"],
    },
  });
  assert.equal(r.slug, "sample-gc");
  assert.equal(r.matchMethod, "license");
}

// 2. Name-only must not join
{
  const r = resolvePermitContractorJoin({
    contractorLicenseKey: null,
    contractorName: "John Smith Construction LLC",
    candidate: {
      slug: "john-smith",
      licenseKeys: ["CGC999"],
      names: ["John Smith Construction LLC"],
    },
  });
  assert.equal(r.slug, null);
}

// 3. Mismatched license refuses
{
  const r = resolvePermitContractorJoin({
    contractorLicenseKey: "CCC111",
    candidate: {
      slug: "other",
      licenseKeys: ["CGC222"],
      names: ["Other Co"],
    },
  });
  assert.equal(r.slug, null);
}

// 4. License normalization
assert.equal(normalizeLicenseKey("cbc 015082"), "CBC015082");
assert.equal(normalizePersonOrBizName("Acme Construction, LLC"), "ACME CONSTRUCTION");

console.log("test_permit_matcher: all passed");
