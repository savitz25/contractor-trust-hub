/**
 * Stage 8A NJ Verify depth smoke tests (no DB required).
 * node scripts/test_nj_verify_smoke.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// --- license key detection (mirror search-normalize) ---
function looksLikeLicenseKey(q) {
  const trimmed = q.trim();
  if (/^TX-TDLR:/i.test(trimmed)) return true;
  if (/^NJ-/i.test(trimmed)) return true;
  if (/^HIC[-_]?/i.test(trimmed)) return true;
  if (/^(ELE|PLB|HVAC|GEN)-NJ-/i.test(trimmed)) return true;
  const compact = trimmed.replace(/[\s\-_.]/g, "");
  if (/^[A-Za-z]{2,6}\d{2,}[A-Za-z0-9]{2,}$/i.test(compact) && compact.length >= 8) return true;
  return /^[A-Za-z]{2,5}\d{4,}$/.test(compact) || /^\d{4,}$/.test(compact);
}

assert.equal(looksLikeLicenseKey("HIC-13VH00012300"), true);
assert.equal(looksLikeLicenseKey("NJ-HIC:HIC-13VH00012300"), true);
assert.equal(looksLikeLicenseKey("ELE-NJ-90001"), true);
assert.equal(looksLikeLicenseKey("Garden State Improvements"), false);

// --- sample + adapter artifacts ---
const sample = path.join(root, "data/samples/nj_dca_hic_sample.csv");
assert.ok(fs.existsSync(sample), "NJ sample CSV missing");
const sampleText = fs.readFileSync(sample, "utf8");
assert.match(sampleText, /entity_key/);
assert.match(sampleText, /enforcement_case/);
assert.match(sampleText, /owner_name/);

// Run adapter if python available — optional offline check of staged outputs
const stagingLic = path.join(root, "data/staging/nj_dca/licenses_normalized.csv");
if (fs.existsSync(stagingLic)) {
  const lic = fs.readFileSync(stagingLic, "utf8");
  assert.match(lic, /nj_dca/);
  assert.match(lic, /HIC/);
  const ent = path.join(root, "data/staging/nj_dca/entities_normalized.csv");
  const enf = path.join(root, "data/staging/nj_dca/enforcement_normalized.csv");
  if (fs.existsSync(ent)) {
    assert.match(fs.readFileSync(ent, "utf8"), /nj_sos|exact_registration/);
  }
  if (fs.existsSync(enf)) {
    assert.match(fs.readFileSync(enf, "utf8"), /nj_enforcement|Consent/);
  }
}

// --- UI source files must not hard-code only Florida on NJ components ---
const njBanner = fs.readFileSync(
  path.join(root, "components/search/NjCoverageBanner.tsx"),
  "utf8"
);
assert.match(njBanner, /verification pilot/i);
assert.match(njBanner, /Coverage differs/i);
assert.doesNotMatch(njBanner, /DBPR construction license extract/);

const evidenceCopy = fs.readFileSync(
  path.join(root, "lib/states/evidence-copy.ts"),
  "utf8"
);
assert.match(evidenceCopy, /New Jersey registration extract/);
assert.match(evidenceCopy, /permit history/);

const njNext = fs.readFileSync(
  path.join(root, "components/contractor/NjNextActions.tsx"),
  "utf8"
);
assert.match(njNext, /state=nj/);
assert.match(njNext, /pre-hire-checklist/);
assert.doesNotMatch(njNext, /href=\{`?\/passport/);
assert.doesNotMatch(njNext, /DBPR/);

const contractorPage = fs.readFileSync(
  path.join(root, "app/contractors/[slug]/page.tsx"),
  "utf8"
);
assert.match(contractorPage, /NjNextActions/);
assert.match(contractorPage, /WhatWeChecked/);
assert.match(contractorPage, /DisciplineSection/);

console.log("test_nj_verify_smoke: all passed");
