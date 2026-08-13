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
  // NJ DCA ids often start with digits then letters (13VH…, 34EB…)
  if (/^\d{2}[A-Za-z]{2}\d{5,}$/i.test(compact)) return true;
  if (/^[A-Za-z]{2,6}\d{2,}[A-Za-z0-9]{2,}$/i.test(compact) && compact.length >= 8) return true;
  return /^[A-Za-z]{2,5}\d{4,}$/.test(compact) || /^\d{4,}$/.test(compact);
}

assert.equal(looksLikeLicenseKey("HIC-13VH00012300"), true);
assert.equal(looksLikeLicenseKey("NJ-HIC:HIC-13VH00012300"), true);
assert.equal(looksLikeLicenseKey("ELE-NJ-90001"), true);
assert.equal(looksLikeLicenseKey("13VH13621300"), true); // production HIC registration #
assert.equal(looksLikeLicenseKey("34EB00138000"), true); // electrical business permit
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
  // Entity/enforcement CSVs are optional depth — production Standard Files often have headers only
  const ent = path.join(root, "data/staging/nj_dca/entities_normalized.csv");
  const enf = path.join(root, "data/staging/nj_dca/enforcement_normalized.csv");
  if (fs.existsSync(ent)) {
    const entText = fs.readFileSync(ent, "utf8");
    assert.match(entText, /source_system/);
    if (entText.split(/\r?\n/).filter(Boolean).length > 1) {
      assert.match(entText, /nj_sos|exact_registration/);
    }
  }
  if (fs.existsSync(enf)) {
    const enfText = fs.readFileSync(enf, "utf8");
    assert.match(enfText, /source_system/);
    if (enfText.split(/\r?\n/).filter(Boolean).length > 1) {
      assert.match(enfText, /nj_enforcement|Consent/);
    }
  }
}

// --- UI source files must not hard-code only Florida on NJ components ---
const njBanner = fs.readFileSync(
  path.join(root, "components/search/NjCoverageBanner.tsx"),
  "utf8"
);
assert.match(njBanner, /no single statewide general contractor license/i);
assert.match(njBanner, /Home Improvement Contractor \(HIC\)/i);
assert.match(njBanner, /MyLicense|official DCA/i);
assert.doesNotMatch(njBanner, /DBPR construction license extract/);
assert.doesNotMatch(njBanner, /all New Jersey contractors/i);

// Foundation docs (Phase 0)
const dataSourcesNj = path.join(root, "docs/DATA_SOURCES_NJ.md");
assert.ok(fs.existsSync(dataSourcesNj), "DATA_SOURCES_NJ.md missing");
const njDoc = fs.readFileSync(dataSourcesNj, "utf8");
assert.match(njDoc, /no single statewide/i);
assert.match(njDoc, /DCAStandardFiles|app\.box\.com/i);
assert.match(njDoc, /Home Improvement Contractor/i);

const dataSourcesMain = fs.readFileSync(
  path.join(root, "docs/DATA_SOURCES.md"),
  "utf8"
);
assert.match(dataSourcesMain, /DATA_SOURCES_NJ\.md/);

const downloadHelper = path.join(root, "scripts/download_nj_dca.py");
assert.ok(fs.existsSync(downloadHelper), "download_nj_dca.py missing");

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
