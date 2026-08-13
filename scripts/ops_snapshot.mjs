/**
 * Print ops health snapshot (DB preferred).
 * Usage: node scripts/ops_snapshot.mjs
 */
import { createPool, getDatabaseUrl } from "./lib/db-pool.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
  const out = {
    generatedAt: new Date().toISOString(),
    stage: "8C",
    databaseConfigured: Boolean(getDatabaseUrl()),
  };

  if (!getDatabaseUrl()) {
    const sample = JSON.parse(
      fs.readFileSync(path.join(root, "data/property/sample-permits.json"), "utf8")
    );
    out.mode = "file_only";
    out.extractFreshness = sample._meta?.updated || null;
    out.note = "Set DATABASE_URL for production DB snapshot";
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  const { pool } = createPool();
  const client = await pool.connect();
  try {
    out.mode = "database";
    const permits = await client.query(
      `SELECT COUNT(*)::int AS n, MAX(retrieved_at) AS freshness
       FROM permit_records WHERE source_label ILIKE 'CTH Wave%'`
    );
    const activity = await client.query(
      `SELECT COUNT(*)::int AS n, MAX(retrieved_at) AS freshness FROM contractor_permit_activity`
    );
    const nj = await client.query(
      `SELECT COUNT(*)::int AS n FROM licenses WHERE source_system = 'nj_dca'`
    );
    const fl = await client.query(
      `SELECT COUNT(*)::int AS n FROM licenses WHERE source_system = 'fl_dbpr'`
    );
    const byJ = await client.query(
      `SELECT jurisdiction_slug, COUNT(*)::int AS n FROM permit_records
       WHERE source_label ILIKE 'CTH Wave%' GROUP BY 1 ORDER BY 1`
    );
    let lastRuns = [];
    try {
      const runs = await client.query(
        `SELECT source_system, source_dataset, status, row_count, delta_rows, started_at
         FROM ops_load_runs ORDER BY started_at DESC LIMIT 5`
      );
      lastRuns = runs.rows;
    } catch {
      lastRuns = [];
    }

    out.florida = {
      wavePermits: permits.rows[0].n,
      permitFreshness: permits.rows[0].freshness,
      activityKeys: activity.rows[0].n,
      activityFreshness: activity.rows[0].freshness,
      flDbprLicenses: fl.rows[0].n,
      byJurisdiction: Object.fromEntries(
        byJ.rows.map((r) => [r.jurisdiction_slug, r.n])
      ),
    };
    out.nj = {
      dcaLicenses: nj.rows[0].n,
      pilot: true,
    };
    out.recentLoadRuns = lastRuns;
    out.knownLimits = [
      "Partial jurisdiction coverage only — empty property results remain common",
      "Exact license joins only for activity and profile links",
      "Sample JSON may still be the extract source until AHJ dumps are wired",
      "Never claim complete county or statewide permit history",
    ];
    console.log(JSON.stringify(out, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
