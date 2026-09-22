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
for (const src of ["nj_dca", "nj_enforcement"]) {
  const r = await client.query(
    `SELECT city FROM licenses WHERE source_system = $1 AND city IS NOT NULL AND city <> UPPER(TRIM(city)) LIMIT 5`,
    [src]
  );
  console.log(src, "dirty(vs UPPER-TRIM) sample:", JSON.stringify(r.rows));
}
await client.query("ROLLBACK");
await client.end();
