/**
 * Production verification: migration 006 tables + optional extract health.
 * Usage: node scripts/verify_stage6_migration.mjs
 * Requires DATABASE_URL (Session pooler).
 */
import pg from "pg";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: url,
  ssl:
    url.includes("supabase") || url.includes("sslmode=require")
      ? { rejectUnauthorized: false }
      : undefined,
  max: 2,
});

const REQUIRED = [
  "permit_records",
  "contractor_permit_activity",
  "permit_coverage_stats",
];

async function tableExists(client, name) {
  const r = await client.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [name]
  );
  return r.rowCount > 0;
}

async function main() {
  const client = await pool.connect();
  try {
    console.log("=== Stage 6.1 migration verification ===\n");
    let ok = true;
    for (const t of REQUIRED) {
      const exists = await tableExists(client, t);
      console.log(exists ? `OK  table ${t}` : `MISSING  table ${t}`);
      if (!exists) ok = false;
    }

    if (!ok) {
      console.error(
        "\nApply schema/migrations/006_stage6_permits_activity.sql then re-run."
      );
      process.exit(2);
    }

    for (const t of REQUIRED) {
      const r = await client.query(`SELECT COUNT(*)::int AS n FROM ${t}`);
      console.log(`  ${t}: ${r.rows[0].n} row(s)`);
    }

    // Index smoke
    const idx = await client.query(
      `SELECT indexname FROM pg_indexes
       WHERE schemaname = 'public'
         AND tablename IN ('permit_records','contractor_permit_activity')
       ORDER BY 1`
    );
    console.log("\nIndexes:");
    for (const row of idx.rows) console.log(`  ${row.indexname}`);

    console.log("\nMigration 006 structure: OK");
    console.log("Next: node scripts/load_wave_a_permits.mjs  (loads JSON → tables)");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
