/** EA-CT-002 baseline verification, part 2. READ-ONLY. Inspects the permit-related tables that exist in
 * Production but are not defined in any committed migration (schema drift), before any code is written. */
import fs from "node:fs";
import { Pool } from "pg";

for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });

const TABLES = ["permit_attributions", "permit_events", "permit_lifecycle_events", "permit_source_records"];

async function main() {
  const c = await pool.connect();
  const out = {};
  const q = async (label, sql) => { try { out[label] = (await c.query(sql)).rows; } catch (e) { out[label] = { ERROR: e.message }; } };
  try {
    await c.query("SET statement_timeout = 20000");
    await c.query("BEGIN READ ONLY");
    for (const t of TABLES) {
      await q(`${t}__columns`, `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='${t}' ORDER BY ordinal_position`);
      await q(`${t}__count`, `SELECT count(*) n FROM ${t}`);
      await q(`${t}__sample`, `SELECT * FROM ${t} LIMIT 3`);
    }
    // FK/constraint context for permit_attributions specifically -- is it the identity bridge?
    await q("permit_attributions__constraints", `
      SELECT conname, pg_get_constraintdef(oid) def FROM pg_constraint WHERE conrelid = 'permit_attributions'::regclass`);
    await q("permit_source_records__constraints", `
      SELECT conname, pg_get_constraintdef(oid) def FROM pg_constraint WHERE conrelid = 'permit_source_records'::regclass`);
  } finally {
    await c.query("ROLLBACK").catch(() => {});
    c.release();
    await pool.end();
  }
  fs.writeFileSync("docs/qa/ea-ct-002/baseline-verification-newtables.local.json", JSON.stringify(out, null, 2) + "\n");
  console.log(JSON.stringify(out, null, 1));
}
main().catch((e) => { console.error(e); process.exit(1); });
