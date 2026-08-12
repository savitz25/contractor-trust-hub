/**
 * Sample top matches using the same cascade spirit as matching.ts
 * (for QA without Next bundling).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = fs
  .readFileSync(path.join(root, ".env.local"), "utf8")
  .match(/^DATABASE_URL=(.+)$/m)[1]
  .trim()
  .replace(/^["']|["']$/g, "");

const map = JSON.parse(
  fs.readFileSync(path.join(root, "data/plan/project-license-map.json"), "utf8")
).mappings;

const scenarios = [
  { type: "roofing", zip: "33139", county: "Miami-Dade" },
  { type: "roofing", zip: "33602", county: "Hillsborough" },
  { type: "kitchen_remodel", zip: "33139", county: "Miami-Dade" },
  { type: "kitchen_remodel", zip: "32801", county: "Orange" },
  { type: "bathroom_remodel", zip: "33301", county: "Broward" },
  { type: "bathroom_remodel", zip: "33701", county: "Pinellas" },
  { type: "general_contracting", zip: "32202", county: "Duval" },
  { type: "full_home_renovation", zip: "33901", county: "Lee" },
];

async function topZip(pool, codes, zip, limit = 8) {
  const r = await pool.query(
    `
    SELECT c.display_name, l.occupation_code AS code,
      LEFT(TRIM(l.postal_code),5) AS zip
    FROM licenses l
    JOIN contractors c ON c.id = l.contractor_id
    WHERE l.source_system = 'fl_dbpr'
      AND c.is_thin_profile = FALSE
      AND l.status_normalized IN ('active','current')
      AND l.occupation_code = ANY($1::text[])
      AND LEFT(TRIM(COALESCE(l.postal_code,'')),5) = $2
    ORDER BY
      CASE l.occupation_code
        ${codes.map((c, i) => `WHEN '${c}' THEN ${i}`).join(" ")}
        ELSE 50 END,
      c.display_name
    LIMIT $3
    `,
    [codes, zip, limit]
  );
  return r.rows;
}

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
try {
  for (const s of scenarios) {
    const primary = map[s.type].primary;
    const rows = await topZip(pool, primary, s.zip);
    const dist = {};
    for (const row of rows) dist[row.code] = (dist[row.code] || 0) + 1;
    console.log(`\n${s.type} ${s.zip} primary=${primary.join(",")} →`, dist);
    for (const row of rows) console.log(`  ${row.code}  ${row.display_name}`);
  }
} finally {
  await pool.end();
}
