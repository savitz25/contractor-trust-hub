/**
 * POST-R1-CON-LOCAL-001 investigation only. READ-ONLY. Checks whether licenses.city is already
 * stored in a single consistent case/trim form for fl_dbpr, specifically for Miami (the case this
 * ticket cares about), and more broadly. BEGIN READ ONLY / ROLLBACK, no writes, no DDL.
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

const distinctMiami = await client.query(
  `SELECT city, COUNT(*) AS n FROM licenses WHERE source_system = 'fl_dbpr' AND LOWER(TRIM(COALESCE(city,''))) = 'miami' GROUP BY city ORDER BY n DESC`
);
console.log("distinct raw city spellings matching lower(trim())='miami':", JSON.stringify(distinctMiami.rows));

const t0 = Date.now();
const dirty = await client.query(
  `SELECT city FROM licenses WHERE source_system = 'fl_dbpr' AND city IS NOT NULL AND city <> TRIM(city) LIMIT 5`
);
console.log("rows where city has leading/trailing whitespace (sample):", JSON.stringify(dirty.rows), "tookMs=", Date.now() - t0);

const t1 = Date.now();
const caseDirty = await client.query(
  `SELECT DISTINCT city FROM licenses WHERE source_system = 'fl_dbpr' AND city IS NOT NULL AND city <> INITCAP(city) AND city !~ '[0-9]' LIMIT 20`
);
console.log("sample city values that are not simple Title-Case (may be legitimately mixed, e.g. 'McAllen'):", JSON.stringify(caseDirty.rows), "tookMs=", Date.now() - t1);

await client.query("ROLLBACK");
await client.end();
