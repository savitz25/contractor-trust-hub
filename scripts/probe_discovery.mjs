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
  SELECT COALESCE(NULLIF(TRIM(l.county_name),''), NULLIF(TRIM(c.primary_county),''), 'Unknown') AS county,
         COUNT(DISTINCT c.id)::int AS n
  FROM contractors c
  JOIN licenses l ON l.contractor_id = c.id AND l.source_system = 'fl_dbpr'
  WHERE c.is_thin_profile = false
  GROUP BY 1 ORDER BY n DESC LIMIT 40
`);
console.log("counties", JSON.stringify(r.rows, null, 2));

const o = await pool.query(`
  SELECT l.occupation_code, COUNT(DISTINCT c.id)::int AS n
  FROM contractors c
  JOIN licenses l ON l.contractor_id = c.id AND l.source_system = 'fl_dbpr'
  WHERE c.is_thin_profile = false
  GROUP BY 1 ORDER BY n DESC LIMIT 30
`);
console.log("occupations", JSON.stringify(o.rows, null, 2));

const samples = await pool.query(`
  SELECT DISTINCT COALESCE(NULLIF(TRIM(l.county_name),''), NULLIF(TRIM(c.primary_county),'')) AS county
  FROM contractors c
  JOIN licenses l ON l.contractor_id = c.id AND l.source_system = 'fl_dbpr'
  WHERE c.is_thin_profile = false
    AND (
      COALESCE(l.county_name,c.primary_county) ILIKE '%miami%'
      OR COALESCE(l.county_name,c.primary_county) ILIKE '%broward%'
      OR COALESCE(l.county_name,c.primary_county) ILIKE '%duval%'
      OR COALESCE(l.county_name,c.primary_county) ILIKE '%orange%'
      OR COALESCE(l.county_name,c.primary_county) ILIKE '%hillsborough%'
    )
  LIMIT 30
`);
console.log("sample names", samples.rows);

await pool.end();
