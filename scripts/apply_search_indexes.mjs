import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvLocal() {
  const p = path.join(root, ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    const val = m[2].trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const sql = fs.readFileSync(
  path.join(root, "schema/migrations/002_search_indexes.sql"),
  "utf8"
);

const pool = new Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30_000,
});

try {
  console.log("applying migration 002...");
  await pool.query(sql);
  console.log("migration OK");

  let t = Date.now();
  const r1 = await pool.query(
    `SELECT count(*)::int AS n FROM contractors
     WHERE is_thin_profile = false AND display_name ILIKE $1`,
    ["%CONSTRUCTION%"]
  );
  console.log("name ILIKE count", r1.rows[0].n, "ms", Date.now() - t);

  t = Date.now();
  const r2 = await pool.query(
    `SELECT c.slug, l.external_key
     FROM licenses l
     JOIN contractors c ON c.id = l.contractor_id
     WHERE UPPER(l.external_key) = $1 AND c.is_thin_profile = false
     LIMIT 1`,
    ["CBC015082"]
  );
  console.log("license", r2.rows[0], "ms", Date.now() - t);

  const r3 = await pool.query(
    `SELECT count(*)::int AS n FROM contractor_entities
     WHERE role = 'sunbiz_entity' AND confidence >= 0.9`
  );
  console.log("high-confidence sunbiz links", r3.rows[0].n);

  // App query smoke via same patterns as lib/contractors/queries.ts
  t = Date.now();
  const r4 = await pool.query(
    `SELECT c.slug, c.display_name, l.external_key, l.status_normalized
     FROM licenses l
     JOIN contractors c ON c.id = l.contractor_id
     WHERE l.source_system = 'fl_dbpr'
       AND c.is_thin_profile = FALSE
       AND UPPER(l.external_key) = $1
     LIMIT 5`,
    ["CBC015082"]
  );
  console.log("app license search", r4.rows, "ms", Date.now() - t);

  t = Date.now();
  const r5 = await pool.query(
    `SELECT c.slug, c.display_name
     FROM contractors c
     JOIN licenses l ON l.contractor_id = c.id AND l.source_system = 'fl_dbpr'
     WHERE c.is_thin_profile = FALSE
       AND c.display_name ILIKE $1
     ORDER BY c.display_name
     LIMIT 5`,
    ["%ABC%"]
  );
  console.log(
    "app name search sample",
    r5.rows.map((r) => r.display_name),
    "ms",
    Date.now() - t
  );
} finally {
  await pool.end();
}
