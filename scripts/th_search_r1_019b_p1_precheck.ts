/* READ-ONLY precheck for TH-SEARCH-R1-019B Phase 1 index creation. BEGIN READ ONLY, rolled back. No writes,
 * no DDL, no planner/session setting changes. */
import fs from "node:fs";
for (const line of fs.readFileSync(".env.local", "utf8").split(String.fromCharCode(10)).map((l) => l.trim())) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(line); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, ""); }
import { Pool } from "pg";

const PHASE1_NAMES = [
  "contractors_display_name_nameorder_idx", "contractors_legal_name_nameorder_idx", "contractors_dba_name_nameorder_idx",
  "licenses_licensee_name_raw_nameorder_idx", "licenses_dba_name_raw_nameorder_idx",
];
const PHASE2_NAMES = [
  "contractors_display_name_namewords_idx", "contractors_legal_name_namewords_idx", "contractors_dba_name_namewords_idx",
  "licenses_licensee_name_raw_namewords_idx", "licenses_dba_name_raw_namewords_idx",
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });
  const c = await pool.connect();
  const out: Record<string, unknown> = { ranAt: new Date().toISOString() };
  const q = async (label: string, sql: string) => { try { out[label] = (await c.query(sql)).rows; } catch (e) { out[label] = { ERROR: (e as Error).message }; await c.query("ROLLBACK"); await c.query("BEGIN READ ONLY"); } };
  try {
    await c.query("SET statement_timeout = 8000");
    await c.query("BEGIN READ ONLY");
    await q("identity", "SELECT current_database() db, current_user usr, current_setting('server_version') v");

    // 3/5. Existing Phase-1/Phase-2 index names: confirm none already exist (by name or by equivalent expression).
    await q("existingByName", `
      SELECT c.relname, c.relkind, i.indisvalid, i.indisready, pg_relation_size(c.oid) bytes
      FROM pg_class c JOIN pg_index i ON i.indexrelid = c.oid
      WHERE c.relname = ANY(ARRAY[${[...PHASE1_NAMES, ...PHASE2_NAMES].map((n) => `'${n}'`).join(",")}])`);
    await q("existingByExpression", `
      SELECT n.nspname, t.relname AS table, ic.relname AS index, pg_get_indexdef(ic.oid) def
      FROM pg_index x JOIN pg_class ic ON ic.oid = x.indexrelid JOIN pg_class t ON t.oid = x.indrelid JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname='public' AND t.relname IN ('contractors','licenses') AND pg_get_indexdef(ic.oid) ILIKE '%text_pattern_ops%'`);

    // Current index inventory on the two tables, for the "no migration/index work happened since the earlier
    // preflight" check -- same names/sizes as the last preflight, nothing new.
    await q("currentIndexes", `
      SELECT t.relname AS table, ic.relname AS index, pg_relation_size(ic.oid) bytes, x.indisvalid, x.indisready
      FROM pg_index x JOIN pg_class ic ON ic.oid = x.indexrelid JOIN pg_class t ON t.oid = x.indrelid JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname='public' AND t.relname IN ('contractors','licenses') ORDER BY 1,2`);

    // Re-check current values (the ticket explicitly says not to trust the earlier snapshot blindly).
    await q("sizes", `SELECT pg_database_size(current_database()) db_bytes,
        pg_total_relation_size('public.contractors') contractors_total, pg_total_relation_size('public.licenses') licenses_total,
        (SELECT reltuples::bigint FROM pg_class WHERE relname='contractors') contractors_est_rows,
        (SELECT reltuples::bigint FROM pg_class WHERE relname='licenses') licenses_est_rows`);
    await q("settings", `SELECT name, setting, unit FROM pg_settings WHERE name IN
      ('shared_buffers','effective_cache_size','maintenance_work_mem','max_parallel_maintenance_workers','statement_timeout','lock_timeout')`);

    // LOAD GATE: activity, long-running queries, locks, current index-build activity.
    await q("activity", `SELECT count(*) total, count(*) FILTER (WHERE state='active') active,
        count(*) FILTER (WHERE xact_start < now() - interval '2 minutes') long_xact,
        count(*) FILTER (WHERE wait_event_type='Lock') waiting_on_lock,
        count(*) FILTER (WHERE query ~* 'create index|reindex|vacuum full') maintenance_like
      FROM pg_stat_activity WHERE datname=current_database()`);
    await q("longQueries", `SELECT pid, usename, application_name, state, now()-query_start AS age, left(regexp_replace(query,'\\s+',' ','g'), 100) q
      FROM pg_stat_activity WHERE datname=current_database() AND pid <> pg_backend_pid() AND query_start < now() - interval '30 seconds' AND state <> 'idle'`);
    await q("locks", `SELECT mode, granted, count(*) FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid WHERE a.datname=current_database() GROUP BY 1,2 ORDER BY 1,2`);
    await q("progressCreateIndex", `SELECT pid, relid::regclass::text, phase, blocks_done, blocks_total FROM pg_stat_progress_create_index`);
    await q("progressVacuum", `SELECT pid, relid::regclass::text, phase FROM pg_stat_progress_vacuum`);

    // Free-space signal available via SQL only (no OS-level disk stat access) -- same limitation as the R1-019B preflight.
    await q("tableStats", `SELECT relname, n_live_tup, n_dead_tup, last_autovacuum, last_autoanalyze FROM pg_stat_user_tables WHERE relname IN ('contractors','licenses')`);
  } finally {
    await c.query("ROLLBACK").catch(() => {});
    c.release();
    await pool.end();
  }
  fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 2) + "\n");
  console.log(JSON.stringify(out, null, 1));
}
main().catch((e) => { console.error(e.message); process.exit(1); });
