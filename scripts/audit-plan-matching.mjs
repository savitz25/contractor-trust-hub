/**
 * One-off audit: plan matching density for focus project types.
 * Usage: node scripts/audit-plan-matching.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadEnv() {
  const p = path.join(root, ".env.local");
  const env = fs.readFileSync(p, "utf8");
  const m = env.match(/^DATABASE_URL=(.+)$/m);
  if (!m) throw new Error("DATABASE_URL missing");
  return m[1].trim().replace(/^["']|["']$/g, "");
}

const FOCUS = {
  roofing: { primary: ["CCC", "RR"], secondary: ["CGC"] },
  kitchen_remodel: { primary: ["CGC", "CBC", "CRC"], secondary: ["CFC"] },
  bathroom_remodel: { primary: ["CFC", "CRC", "CBC"], secondary: ["CGC"] },
  general_contracting: { primary: ["CGC", "CBC", "CRC"], secondary: [] },
  full_home_renovation: { primary: ["CGC", "CBC", "CRC"], secondary: [] },
  addition: { primary: ["CGC", "CBC", "CRC"], secondary: [] },
};

const ZIPS = [
  { zip: "33139", city: "Miami Beach", expectCounty: "Miami-Dade" },
  { zip: "33301", city: "Fort Lauderdale", expectCounty: "Broward" },
  { zip: "33602", city: "Tampa", expectCounty: "Hillsborough" },
  { zip: "32801", city: "Orlando", expectCounty: "Orange" },
  { zip: "32202", city: "Jacksonville", expectCounty: "Duval" },
  { zip: "33701", city: "St Petersburg", expectCounty: "Pinellas" },
  { zip: "33901", city: "Fort Myers", expectCounty: "Lee" },
  { zip: "34236", city: "Sarasota", expectCounty: "Sarasota" },
];

async function countLocal(pool, codes, { zip, county }) {
  const r = await pool.query(
    `
    SELECT
      l.occupation_code AS code,
      COUNT(DISTINCT c.id)::int AS n,
      COUNT(DISTINCT c.id) FILTER (
        WHERE LEFT(TRIM(COALESCE(l.postal_code, '')), 5) = $2
      )::int AS n_zip,
      COUNT(DISTINCT c.id) FILTER (
        WHERE LOWER(TRIM(COALESCE(l.county_name, ''))) = LOWER($3)
           OR LOWER(TRIM(COALESCE(c.primary_county, ''))) = LOWER($3)
      )::int AS n_county
    FROM licenses l
    JOIN contractors c ON c.id = l.contractor_id
    WHERE l.status_normalized IN ('active', 'current')
      AND c.is_thin_profile = FALSE
      AND (c.home_state = 'FL' OR l.state = 'FL')
      AND l.occupation_code = ANY($1::text[])
      AND (
        LEFT(TRIM(COALESCE(l.postal_code, '')), 5) = $2
        OR LOWER(TRIM(COALESCE(l.county_name, ''))) = LOWER($3)
        OR LOWER(TRIM(COALESCE(c.primary_county, ''))) = LOWER($3)
      )
    GROUP BY 1
    ORDER BY n DESC
    `,
    [codes, zip, county]
  );
  return r.rows;
}

async function sampleMatches(pool, codes, { zip, county }, limit = 8) {
  const r = await pool.query(
    `
    SELECT
      c.display_name,
      l.occupation_code,
      LEFT(TRIM(COALESCE(l.postal_code, '')), 5) AS zip,
      COALESCE(l.county_name, c.primary_county) AS county,
      l.city,
      CASE
        WHEN LEFT(TRIM(COALESCE(l.postal_code, '')), 5) = $2 THEN 'zip'
        WHEN LOWER(TRIM(COALESCE(l.county_name, ''))) = LOWER($3)
          OR LOWER(TRIM(COALESCE(c.primary_county, ''))) = LOWER($3) THEN 'county'
        ELSE 'other'
      END AS tier
    FROM licenses l
    JOIN contractors c ON c.id = l.contractor_id
    WHERE l.status_normalized IN ('active', 'current')
      AND c.is_thin_profile = FALSE
      AND (c.home_state = 'FL' OR l.state = 'FL')
      AND l.occupation_code = ANY($1::text[])
      AND (
        LEFT(TRIM(COALESCE(l.postal_code, '')), 5) = $2
        OR LOWER(TRIM(COALESCE(l.county_name, ''))) = LOWER($3)
        OR LOWER(TRIM(COALESCE(c.primary_county, ''))) = LOWER($3)
      )
    ORDER BY
      CASE WHEN LEFT(TRIM(COALESCE(l.postal_code, '')), 5) = $2 THEN 0 ELSE 1 END,
      CASE l.occupation_code
        ${codes.map((c, i) => `WHEN '${c}' THEN ${i}`).join(" ")}
        ELSE 50
      END,
      c.display_name
    LIMIT $4
    `,
    [codes, zip, county, limit]
  );
  return r.rows;
}

async function main() {
  const pool = new pg.Pool({
    connectionString: loadEnv(),
    ssl: { rejectUnauthorized: false },
    max: 2,
  });

  try {
    const src = await pool.query(
      `SELECT source_system, COUNT(*)::int n FROM licenses GROUP BY 1 ORDER BY 2 DESC LIMIT 5`
    );
    console.log("=== license sources ===");
    console.log(src.rows);

    const statewide = await pool.query(
      `
      SELECT l.occupation_code, COUNT(DISTINCT c.id)::int n
      FROM licenses l JOIN contractors c ON c.id = l.contractor_id
      WHERE l.status_normalized IN ('active', 'current')
        AND c.is_thin_profile = FALSE
        AND (c.home_state = 'FL' OR l.state = 'FL')
        AND l.occupation_code = ANY($1::text[])
      GROUP BY 1 ORDER BY n DESC
      `,
      [["CCC", "RR", "CGC", "CBC", "CRC", "CFC"]]
    );
    console.log("\n=== statewide active non-thin ===");
    console.log(statewide.rows);

    // County fill rates
    for (const code of ["CCC", "RR", "CFC", "CGC", "CRC"]) {
      const fill = await pool.query(
        `
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE NULLIF(TRIM(l.county_name), '') IS NOT NULL)::int AS has_county,
          COUNT(*) FILTER (WHERE NULLIF(TRIM(l.postal_code), '') IS NOT NULL)::int AS has_zip
        FROM licenses l
        WHERE l.occupation_code = $1 AND l.status_normalized IN ('active', 'current')
        `,
        [code]
      );
      console.log(`fill ${code}`, fill.rows[0]);
    }

    for (const [ptype, map] of Object.entries(FOCUS)) {
      console.log(`\n========== ${ptype} primary=${map.primary.join(",")} sec=${map.secondary.join(",") || "—"} ==========`);
      for (const loc of ZIPS) {
        const primary = await countLocal(pool, map.primary, {
          zip: loc.zip,
          county: loc.expectCounty,
        });
        const allCodes = [...map.primary, ...map.secondary];
        const withSec =
          map.secondary.length > 0
            ? await countLocal(pool, allCodes, {
                zip: loc.zip,
                county: loc.expectCounty,
              })
            : primary;

        const sum = (rows, key) => rows.reduce((a, r) => a + r[key], 0);
        const pTotal = sum(primary, "n");
        const pZip = sum(primary, "n_zip");
        const sTotal = sum(withSec, "n");
        const secOnly = sTotal - pTotal;

        // Simulate current thresholds: MIN_PRIMARY_LOCAL=2, MIN_LOCAL_STRONG=3
        const expandSecondary = pTotal < 2 && map.secondary.length > 0;
        const localUsed = expandSecondary ? sTotal : pTotal;
        const jumpStatewide = localUsed < 3;

        console.log(
          `${loc.zip} ${loc.expectCounty}: primary_local=${pTotal} (zip=${pZip}) ` +
            `+sec_local=${sTotal} (sec_only≈${secOnly}) | expand_sec=${expandSecondary} statewide_jump=${jumpStatewide}`
        );
        if (primary.length) {
          console.log(
            "  by code:",
            primary.map((r) => `${r.code}:${r.n}(z${r.n_zip}/c${r.n_county})`).join(" ")
          );
        }
        if (expandSecondary && map.secondary.length) {
          const samples = await sampleMatches(pool, allCodes, {
            zip: loc.zip,
            county: loc.expectCounty,
          });
          console.log(
            "  samples:",
            samples
              .map((s) => `${s.occupation_code}/${s.tier} ${s.display_name?.slice(0, 28)}`)
              .join(" | ")
          );
        } else {
          const samples = await sampleMatches(pool, map.primary, {
            zip: loc.zip,
            county: loc.expectCounty,
          });
          console.log(
            "  samples:",
            samples
              .slice(0, 5)
              .map((s) => `${s.occupation_code}/${s.tier} ${s.display_name?.slice(0, 28)}`)
              .join(" | ")
          );
        }
      }
    }

    // How often would roofing show CGC as majority in top 12 if we always include secondary?
    console.log("\n=== roofing: if always include CGC secondary locally (bad) ===");
    for (const loc of ZIPS.slice(0, 4)) {
      const r = await pool.query(
        `
        WITH ranked AS (
          SELECT c.id, l.occupation_code,
            ROW_NUMBER() OVER (
              PARTITION BY c.id ORDER BY
                CASE WHEN LEFT(TRIM(COALESCE(l.postal_code,'')),5)=$2 THEN 0 ELSE 1 END,
                CASE l.occupation_code WHEN 'CCC' THEN 0 WHEN 'RR' THEN 1 WHEN 'CGC' THEN 2 ELSE 9 END
            ) AS rn
          FROM licenses l
          JOIN contractors c ON c.id = l.contractor_id
          WHERE l.status_normalized IN ('active','current')
            AND c.is_thin_profile = FALSE
            AND l.occupation_code = ANY($1::text[])
            AND (
              LEFT(TRIM(COALESCE(l.postal_code,'')),5)=$2
              OR LOWER(TRIM(COALESCE(l.county_name,'')))=LOWER($3)
              OR LOWER(TRIM(COALESCE(c.primary_county,'')))=LOWER($3)
            )
        )
        SELECT occupation_code, COUNT(*)::int n FROM ranked WHERE rn=1
        GROUP BY 1 ORDER BY n DESC
        LIMIT 5
        `,
        [["CCC", "RR", "CGC"], loc.zip, loc.expectCounty]
      );
      console.log(loc.zip, r.rows);
    }

    // Kitchen: CFC share if secondary always on
    console.log("\n=== kitchen: primary GC vs if CFC always in pool (local county) ===");
    for (const loc of ZIPS.slice(0, 4)) {
      for (const label of ["primary", "with_cfc"]) {
        const codes =
          label === "primary" ? ["CGC", "CBC", "CRC"] : ["CGC", "CBC", "CRC", "CFC"];
        const r = await pool.query(
          `
          SELECT l.occupation_code, COUNT(DISTINCT c.id)::int n
          FROM licenses l JOIN contractors c ON c.id = l.contractor_id
          WHERE l.status_normalized IN ('active','current')
            AND c.is_thin_profile = FALSE
            AND l.occupation_code = ANY($1::text[])
            AND (
              LEFT(TRIM(COALESCE(l.postal_code,'')),5)=$2
              OR LOWER(TRIM(COALESCE(l.county_name,'')))=LOWER($3)
              OR LOWER(TRIM(COALESCE(c.primary_county,'')))=LOWER($3)
            )
          GROUP BY 1 ORDER BY n DESC
          `,
          [codes, loc.zip, loc.expectCounty]
        );
        console.log(loc.zip, label, r.rows);
      }
    }

    // Bathroom: CFC vs CRC/CBC dominance
    console.log("\n=== bathroom: primary CFC/CRC/CBC mix local ===");
    for (const loc of ZIPS) {
      const r = await pool.query(
        `
        SELECT l.occupation_code, COUNT(DISTINCT c.id)::int n
        FROM licenses l JOIN contractors c ON c.id = l.contractor_id
        WHERE l.status_normalized IN ('active','current')
          AND c.is_thin_profile = FALSE
          AND l.occupation_code = ANY($1::text[])
          AND (
            LEFT(TRIM(COALESCE(l.postal_code,'')),5)=$2
            OR LOWER(TRIM(COALESCE(l.county_name,'')))=LOWER($3)
            OR LOWER(TRIM(COALESCE(c.primary_county,'')))=LOWER($3)
          )
        GROUP BY 1 ORDER BY n DESC
        `,
        [["CFC", "CRC", "CBC", "CGC"], loc.zip, loc.expectCounty]
      );
      console.log(loc.zip, r.rows);
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
