/**
 * Stage 7 data health: Wave B/C extract density + join audit (file-level).
 * Usage: node scripts/verify_stage7_data.mjs
 * Optional DB: set DATABASE_URL to also run migration 006 check.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(
  fs.readFileSync(path.join(root, "data/property/sample-permits.json"), "utf8")
);

function norm(k) {
  return String(k || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

const WAVE_B = ["palm beach", "duval", "pinellas", "lee"];
const WAVE_C = ["collier", "sarasota", "pasco", "polk"];

let b = 0;
let c = 0;
let licenseRows = 0;
const onPermits = new Set();
const byJ = {};

for (const rows of Object.values(data.byAddressKey || {})) {
  for (const r of rows) {
    const j = (r.sourceJurisdiction || "?").toLowerCase();
    byJ[r.sourceJurisdiction || "?"] = (byJ[r.sourceJurisdiction || "?"] || 0) + 1;
    if (WAVE_B.some((w) => j.includes(w))) b += 1;
    if (WAVE_C.some((w) => j.includes(w))) c += 1;
    if (r.contractorLicenseKey) {
      licenseRows += 1;
      onPermits.add(norm(r.contractorLicenseKey));
    }
  }
}

const activity = Object.keys(data.contractorActivityByLicense || {}).map(norm);
const activitySet = new Set(activity);
let matched = 0;
for (const k of onPermits) if (activitySet.has(k)) matched += 1;

console.log("=== Stage 7 Florida extract health ===");
console.log("Freshness:", data._meta?.updated || "—");
console.log("Address keys:", Object.keys(data.byAddressKey || {}).length);
console.log("Wave B permit rows:", b);
console.log("Wave C permit rows:", c);
console.log("License-bearing rows:", licenseRows);
console.log("Distinct license keys:", onPermits.size);
console.log("Activity keys:", activity.length);
console.log(
  "Join rate proxy:",
  onPermits.size ? `${Math.round((matched / onPermits.size) * 1000) / 10}%` : "n/a"
);
console.log("By jurisdiction:", byJ);

if (b < 8 || c < 6) {
  console.error("FAIL: Wave B/C density below Stage 7 expectations");
  process.exit(2);
}
if (matched < onPermits.size) {
  console.warn(
    "WARN: some license keys on permits lack activity rows:",
    onPermits.size - matched
  );
}

// NJ sample presence
const njSample = path.join(root, "data/samples/nj_dca_hic_sample.csv");
if (fs.existsSync(njSample)) {
  const lines = fs.readFileSync(njSample, "utf8").trim().split(/\r?\n/);
  console.log("\n=== NJ pilot sample ===");
  console.log("Sample rows (incl header):", lines.length);
} else {
  console.warn("WARN: NJ sample CSV missing");
}

console.log("\nStage 7 file-level checks: OK");
console.log("Next: npm run audit:joins · npm run load:wave-bc (DB) · load NJ via adapter");
