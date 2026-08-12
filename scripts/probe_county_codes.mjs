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
  SELECT TRIM(county_code) AS code, MAX(county_name) AS name, COUNT(*)::int AS n
  FROM licenses
  WHERE source_system = 'fl_dbpr'
    AND county_code IS NOT NULL AND TRIM(county_code) <> ''
    AND county_name IS NOT NULL AND TRIM(county_name) <> ''
  GROUP BY 1
  ORDER BY n DESC
`);
console.log(JSON.stringify(r.rows, null, 2));
await pool.end();
