/** Explicit read-only, repeatable-read census. Generation never queries or writes the DB. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";
const root = resolve(import.meta.dirname, "..");
const envFile = process.env.METRICS_ENV_FILE || resolve(root, ".env.local");
for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const i = line.indexOf("=");
  if (i > 0 && !line.startsWith("#")) {
    const key = line.slice(0, i).trim();
    process.env[key] ||= line
      .slice(i + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
  }
}
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});
try {
  await client.connect();
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  await client.query("SET LOCAL statement_timeout='120s'");
  const snapshotAsOf = (
    await client.query("SELECT transaction_timestamp() AS t")
  ).rows[0].t.toISOString();
  const licenseGroups = (
    await client.query(`SELECT source_system, occupation_code, primary_status, status_normalized, count(*)::int AS rows
 FROM licenses GROUP BY 1,2,3,4 ORDER BY 1,2,3,4`)
  ).rows;
  const evidenceGroups = (
    await client.query(
      "SELECT source_system,source_dataset,count(*)::int AS rows FROM discipline_actions GROUP BY 1,2 ORDER BY 1,2",
    )
  ).rows;
  const totals = {};
  for (const table of [
    "licenses",
    "contractors",
    "contractor_entities",
    "public_contact_observations",
    "discipline_actions",
    "regulatory_source_observations",
    "regulatory_source_occurrences",
    "permit_source_records",
  ]) {
    totals[table] = (
      await client.query(`SELECT count(*)::int AS n FROM ${table}`)
    ).rows[0].n;
  }
  await client.query("ROLLBACK");
  const out = {
    schemaVersion: "accepted-network-census-v1",
    snapshotAsOf,
    retrievedAt: new Date().toISOString(),
    sourceAsOf: null,
    acquisition:
      "PostgreSQL REPEATABLE READ READ ONLY; aggregates only, no identity rows",
    licenseGroups,
    evidenceGroups,
    totals,
  };
  writeFileSync(
    resolve(root, "data/metrics/accepted-network-census-v1.json"),
    JSON.stringify(out, null, 2) + "\n",
  );
  console.log({ snapshotAsOf, totals, groups: licenseGroups.length });
} finally {
  await client.end();
}
