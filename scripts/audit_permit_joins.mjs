/**
 * Audit sample: license-bearing rows + activity keys. No DB required.
 * Usage: node scripts/audit_permit_joins.mjs
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

const onPermits = new Set();
let licenseRows = 0;
let noLicenseRows = 0;
const byCounty = {};

for (const rows of Object.values(data.byAddressKey || {})) {
  for (const r of rows) {
    const j = r.sourceJurisdiction || "?";
    byCounty[j] = (byCounty[j] || 0) + 1;
    if (r.contractorLicenseKey) {
      licenseRows += 1;
      onPermits.add(norm(r.contractorLicenseKey));
    } else noLicenseRows += 1;
  }
}

const activity = Object.keys(data.contractorActivityByLicense || {}).map(norm);
const activitySet = new Set(activity);
let matched = 0;
let unmatched = 0;
for (const k of onPermits) {
  if (activitySet.has(k)) matched += 1;
  else unmatched += 1;
}

console.log("=== Permit join audit (file extracts) ===");
console.log("Records by jurisdiction:", byCounty);
console.log("License-bearing rows:", licenseRows);
console.log("No-license rows:", noLicenseRows);
console.log("Distinct license keys on permits:", onPermits.size);
console.log("Activity rollup keys:", activity.length);
console.log("Keys on both permit + activity:", matched);
console.log("License-bearing keys with no activity row:", unmatched);
console.log(
  "Join rate proxy (activity ∩ permits / permits keys):",
  onPermits.size
    ? `${Math.round((matched / onPermits.size) * 1000) / 10}%`
    : "n/a"
);
console.log("Freshness:", data._meta?.updated || "—");
console.log(
  "False-join note: name-only joins are disabled in matcher; only exact license joins allowed."
);
