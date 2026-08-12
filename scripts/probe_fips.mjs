import fs from "fs";
import { Pool } from "pg";

for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m && !process.env[m[1].trim()]) {
    process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const r = await pool.query(`
  SELECT COALESCE(NULLIF(TRIM(l.county_name),''), NULLIF(TRIM(c.primary_county),'')) AS county,
         COUNT(DISTINCT c.id)::int AS n
  FROM contractors c
  JOIN licenses l ON l.contractor_id = c.id AND l.source_system = 'fl_dbpr'
  WHERE c.is_thin_profile = false
    AND COALESCE(NULLIF(TRIM(l.county_name),''), c.primary_county) ~ '^[0-9]+$'
  GROUP BY 1
  ORDER BY n DESC
  LIMIT 40
`);
console.log(JSON.stringify(r.rows, null, 2));

// sample license county_code
const c = await pool.query(`
  SELECT county_code, county_name, COUNT(*)::int n
  FROM licenses
  WHERE source_system = 'fl_dbpr' AND county_code IS NOT NULL AND TRIM(county_code) <> ''
  GROUP BY 1, 2
  ORDER BY n DESC
  LIMIT 50
`);
console.log("code+name", JSON.stringify(c.rows, null, 2));
await pool.end();
