import fs from "node:fs";
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/).map((l) => l.trim())) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const { Client } = await import("pg");
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query("SET statement_timeout = 60000");
await client.query("BEGIN READ ONLY");
const t0 = Date.now();
const r = await client.query(
  `SELECT city, COUNT(*) AS n FROM licenses WHERE source_system = 'fl_dbpr' AND city IS NOT NULL AND city <> UPPER(TRIM(city)) GROUP BY city ORDER BY n DESC LIMIT 20`
);
console.log("FULL fl_dbpr scan -- any city NOT equal to UPPER(TRIM(city)):", JSON.stringify(r.rows), "tookMs=", Date.now() - t0);
await client.query("ROLLBACK");
await client.end();
