/**
 * Stage 8C production data verification.
 * Usage: node scripts/verify_production_data.mjs
 * Optional: --freshness-days 90  (warn if older)
 */
import {
  createPool,
  WAVE_SLUGS,
} from "./lib/db-pool.mjs";

const args = process.argv.slice(2);
const daysIdx = args.indexOf("--freshness-days");
const freshnessDays =
  daysIdx >= 0 && args[daysIdx + 1] ? Number(args[daysIdx + 1]) : 120;

const { pool } = createPool();

async function tableExists(client, name) {
  const r = await client.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [name]
  );
  return (r.rowCount || 0) > 0;
}

async function main() {
  const client = await pool.connect();
  let exitCode = 0;
  try {
    console.log("=== Stage 8C production verify ===\n");

    const required = [
      "permit_records",
      "contractor_permit_activity",
      "permit_coverage_stats",
      "licenses",
      "contractors",
    ];
    for (const t of required) {
      const ok = await tableExists(client, t);
      console.log(ok ? `OK   table ${t}` : `FAIL table ${t}`);
      if (!ok) exitCode = 2;
    }

    const hasOps = await tableExists(client, "ops_load_runs");
    console.log(
      hasOps
        ? "OK   table ops_load_runs (007)"
        : "WARN table ops_load_runs missing — apply schema/migrations/007_stage8c_ops_load_runs.sql"
    );

    if (exitCode === 2) {
      console.error("\nMissing required tables. Apply migrations 006 (+ 007 recommended).");
      process.exit(2);
    }

    // Row counts
    console.log("\n--- Row counts ---");
    for (const t of [
      "permit_records",
      "contractor_permit_activity",
      "permit_coverage_stats",
      "licenses",
    ]) {
      const r = await client.query(`SELECT COUNT(*)::int AS n FROM ${t}`);
      console.log(`  ${t}: ${r.rows[0].n}`);
    }

    const wavePermits = await client.query(
      `SELECT COUNT(*)::int AS n FROM permit_records WHERE source_label ILIKE 'CTH Wave%'`
    );
    console.log(`  CTH Wave permits: ${wavePermits.rows[0].n}`);
    if (wavePermits.rows[0].n === 0) {
      console.warn("WARN zero CTH Wave permits — run: npm run load:permits");
      exitCode = Math.max(exitCode, 1);
    }

    // By wave
    console.log("\n--- Permits by jurisdiction_slug ---");
    const byJ = await client.query(
      `
      SELECT jurisdiction_slug, COUNT(*)::int AS n,
             COUNT(*) FILTER (WHERE contractor_license_key IS NOT NULL)::int AS with_lic,
             MAX(retrieved_at)::date AS freshness
      FROM permit_records
      WHERE source_label ILIKE 'CTH Wave%'
      GROUP BY 1
      ORDER BY 1
      `
    );
    for (const row of byJ.rows) {
      const wave =
        WAVE_SLUGS.A.includes(row.jurisdiction_slug)
          ? "A"
          : WAVE_SLUGS.B.includes(row.jurisdiction_slug)
            ? "B"
            : WAVE_SLUGS.C.includes(row.jurisdiction_slug)
              ? "C"
              : "?";
      console.log(
        `  [${wave}] ${row.jurisdiction_slug}: ${row.n} rows · lic ${row.with_lic} · freshness ${row.freshness || "—"}`
      );
    }

    // Coverage stats consistency
    console.log("\n--- permit_coverage_stats ---");
    const cov = await client.query(
      `SELECT jurisdiction_slug, record_count, with_license_key, freshness, wave, updated_at::date
       FROM permit_coverage_stats ORDER BY wave, jurisdiction_slug`
    );
    if (!cov.rowCount) {
      console.warn("WARN permit_coverage_stats empty");
      exitCode = Math.max(exitCode, 1);
    } else {
      for (const row of cov.rows) {
        console.log(
          `  ${row.jurisdiction_slug}: count=${row.record_count} lic=${row.with_license_key} wave=${row.wave} freshness=${row.freshness || "—"}`
        );
      }
    }

    // Freshness threshold
    console.log(`\n--- Freshness (threshold ${freshnessDays}d) ---`);
    const fresh = await client.query(
      `
      SELECT MAX(retrieved_at) AS max_ret,
             MAX(updated_at) AS max_cov
      FROM permit_coverage_stats
      `
    );
    const maxRet = fresh.rows[0]?.max_ret;
    if (maxRet) {
      const ageDays = Math.floor(
        (Date.now() - new Date(maxRet).getTime()) / (86400 * 1000)
      );
      console.log(`  coverage stats max freshness age: ${ageDays} day(s)`);
      if (ageDays > freshnessDays) {
        console.warn(
          `WARN freshness older than ${freshnessDays} days — schedule extract refresh`
        );
        exitCode = Math.max(exitCode, 1);
      } else {
        console.log("  OK freshness within threshold");
      }
    } else {
      console.warn("WARN no freshness timestamps on coverage stats");
    }

    // NJ
    console.log("\n--- NJ verify sources ---");
    const njLic = await client.query(
      `SELECT COUNT(*)::int AS n FROM licenses WHERE source_system = 'nj_dca'`
    );
    const njEnt = await client.query(
      `SELECT COUNT(*)::int AS n FROM entities WHERE source_system = 'nj_sos'`
    );
    const njEnf = await client.query(
      `SELECT COUNT(*)::int AS n FROM discipline_actions WHERE source_system = 'nj_enforcement'`
    );
    console.log(`  licenses nj_dca: ${njLic.rows[0].n}`);
    console.log(`  entities nj_sos: ${njEnt.rows[0].n}`);
    console.log(`  discipline nj_enforcement: ${njEnf.rows[0].n}`);
    if (njLic.rows[0].n === 0) {
      console.warn(
        "WARN no NJ licenses — run adapter + load_nj_dca_to_postgres.py (pilot may be sample-only until load)"
      );
    }

    // FL DBPR licenses presence
    const flLic = await client.query(
      `SELECT COUNT(*)::int AS n FROM licenses WHERE source_system = 'fl_dbpr'`
    );
    console.log(`\n  licenses fl_dbpr: ${flLic.rows[0].n}`);
    if (flLic.rows[0].n === 0) {
      console.warn("WARN no FL DBPR licenses in DB — Trust Report search will be empty");
      exitCode = Math.max(exitCode, 1);
    }

    // Recent ops runs
    if (hasOps) {
      console.log("\n--- Recent ops_load_runs ---");
      const runs = await client.query(
        `
        SELECT source_system, source_dataset, status, row_count, delta_rows,
               started_at, error_message
        FROM ops_load_runs
        ORDER BY started_at DESC
        LIMIT 8
        `
      );
      if (!runs.rowCount) console.log("  (none yet)");
      for (const r of runs.rows) {
        console.log(
          `  ${r.started_at?.toISOString?.() || r.started_at} ${r.status} ${r.source_system}/${r.source_dataset} rows=${r.row_count} delta=${r.delta_rows ?? "—"}`
        );
        if (r.error_message) console.log(`    error: ${r.error_message.slice(0, 120)}`);
      }
    }

    console.log(
      exitCode === 0
        ? "\nProduction verify: OK"
        : "\nProduction verify: WARNINGS (see above)"
    );
    process.exit(exitCode);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
