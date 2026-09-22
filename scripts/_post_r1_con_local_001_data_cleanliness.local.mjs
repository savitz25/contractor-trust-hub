/**
 * POST-R1-CON-LOCAL-001 investigation only. READ-ONLY. Checks whether licenses.occupation_code is
 * already stored uppercase/trimmed for fl_dbpr and nj_* source systems -- i.e. whether
 * UPPER(TRIM(l.occupation_code)) in buildWhere() (lib/specialist-execution/contractor-v2.ts) is
 * doing real normalization work or is a no-op that only defeats the index/planner estimate.
 * BEGIN READ ONLY / ROLLBACK, no writes, no DDL.
 */
import fs from "node:fs";
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/).map((l) => l.trim())) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const { Client } = await import("pg");
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query("SET statement_timeout = 25000");
await client.query("BEGIN READ ONLY");

for (const src of ["fl_dbpr", "nj_dca", "nj_enforcement", "tx_tdlr"]) {
  const t0 = Date.now();
  const exists = await client.query(
    `SELECT occupation_code FROM licenses WHERE source_system = $1 AND occupation_code <> UPPER(TRIM(occupation_code)) LIMIT 5`,
    [src]
  );
  console.log(src, "dirtySampleRows=", exists.rows, "tookMs=", Date.now() - t0);
}

// Distinct occupation_code values actually used for FL general (CGC, RG) and plumbing (CFC, RF) --
// cheap because filtered by occupation_code directly first (planner should use whatever stats exist).
const distinctGeneral = await client.query(
  `SELECT DISTINCT occupation_code FROM licenses WHERE source_system = 'fl_dbpr' AND UPPER(TRIM(occupation_code)) IN ('CGC','RG') LIMIT 20`
);
console.log("distinct raw occupation_code values matching CGC/RG (upper/trim):", JSON.stringify(distinctGeneral.rows));

await client.query("ROLLBACK");
await client.end();
