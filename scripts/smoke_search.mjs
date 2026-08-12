import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m && !process.env[m[1].trim()]) {
    process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

// Dynamic import of TS via building isn't available; reimplement minimal check via SQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const tests = [
  "CBC015082",
  "CBC 015082",
  "Worsham Construction LLC",
  "Worsham Construction",
  "ABC Roofing",
];

try {
  for (const q of tests) {
    const t0 = Date.now();
    // Call app search by spawning isn't easy; use ILIKE pattern similar to prepareNameSearch
    const stripped = q
      .replace(/[.,'"/\\&()+-]+/g, " ")
      .replace(/\b(INCORPORATED|INC|LLC|CORPORATION|CORP|COMPANY|CO|LTD|LIMITED|PLLC|PA|LP|LLP|THE)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    const like = `%${stripped}%`;
    const r = await pool.query(
      `SELECT c.display_name, l.external_key
       FROM contractors c
       JOIN licenses l ON l.contractor_id = c.id AND l.source_system = 'fl_dbpr'
       WHERE c.is_thin_profile = false
         AND (
           UPPER(REPLACE(REPLACE(l.external_key, ' ', ''), '-', '')) = UPPER(REPLACE(REPLACE($1, ' ', ''), '-', ''))
           OR c.display_name ILIKE $2
           OR c.legal_name ILIKE $2
           OR c.dba_name ILIKE $2
         )
       ORDER BY c.display_name
       LIMIT 3`,
      [q, like]
    );
    console.log(JSON.stringify({ q, stripped, ms: Date.now() - t0, n: r.rowCount, sample: r.rows }));
  }
} finally {
  await pool.end();
}
