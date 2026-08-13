/**
 * Stage 8C ops tooling structure smoke (no DATABASE_URL required).
 * node scripts/test_ops_smoke.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const exists = (p) => fs.existsSync(path.join(root, p));
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

for (const p of [
  "scripts/lib/db-pool.mjs",
  "scripts/load_wave_permits.mjs",
  "scripts/rebuild_permit_activity.mjs",
  "scripts/verify_production_data.mjs",
  "scripts/audit_production_joins.mjs",
  "scripts/ops_snapshot.mjs",
  "schema/migrations/007_stage8c_ops_load_runs.sql",
  "lib/property/ops-db.ts",
  "docs/STAGE_8C_LIVE_DATA_OPS.md",
]) {
  assert.ok(exists(p), `missing ${p}`);
}

const pkg = JSON.parse(read("package.json"));
for (const s of [
  "load:permits",
  "load:wave-a",
  "load:wave-bc",
  "verify:ops",
  "audit:production",
  "rebuild:activity",
  "ops:snapshot",
  "test:ops",
]) {
  assert.ok(pkg.scripts[s], `package.json missing script ${s}`);
}

const loader = read("scripts/load_wave_permits.mjs");
assert.match(loader, /zero-row load/);
assert.match(loader, /DELETE FROM permit_records WHERE source_label ILIKE 'CTH Wave%'/);
assert.match(loader, /contractor_permit_activity/);
assert.match(loader, /ops_load_runs/);
assert.match(loader, /dry-run|dryRun/);

const verify = read("scripts/verify_production_data.mjs");
assert.match(verify, /freshness/);
assert.match(verify, /nj_dca/);
assert.match(verify, /CTH Wave/);

const mig = read("schema/migrations/007_stage8c_ops_load_runs.sql");
assert.match(mig, /ops_load_runs/);

const opsDb = read("lib/property/ops-db.ts");
assert.match(opsDb, /loadDbOpsSnapshot/);
assert.match(opsDb, /never claim complete/i);

const covApi = read("app/api/property/coverage/route.ts");
assert.match(covApi, /loadDbOpsSnapshot/);
assert.match(covApi, /honesty/);

console.log("test_ops_smoke: all passed");
