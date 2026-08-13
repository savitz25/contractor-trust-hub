/**
 * Rebuild contractor_permit_activity rollups from permit_records (exact license keys).
 * Idempotent for CTH wave source rows.
 *
 * Usage:
 *   node scripts/rebuild_permit_activity.mjs
 *   node scripts/rebuild_permit_activity.mjs --source-prefix "CTH Wave"
 */
import { createPool, normalizeLicenseKey } from "./lib/db-pool.mjs";

const args = process.argv.slice(2);
const prefixIdx = args.indexOf("--source-prefix");
const sourcePrefix =
  prefixIdx >= 0 && args[prefixIdx + 1] ? args[prefixIdx + 1] : "CTH Wave";

const { pool } = createPool();

async function main() {
  const client = await pool.connect();
  try {
    console.log("=== Rebuild permit activity rollups ===");
    console.log("Source label prefix:", sourcePrefix);

    const rows = await client.query(
      `
      SELECT
        UPPER(REGEXP_REPLACE(contractor_license_key, '[^A-Za-z0-9]', '', 'g')) AS lic,
        jurisdiction_label,
        category,
        description,
        COALESCE(filed_date, issued_date, final_date)::text AS any_date,
        retrieved_at
      FROM permit_records
      WHERE contractor_license_key IS NOT NULL
        AND TRIM(contractor_license_key) <> ''
        AND source_label ILIKE $1 || '%'
      `,
      [sourcePrefix]
    );

    /** @type {Map<string, {count:number, counties:Set<string>, categories:Set<string>, samples:string[], dates:string[], retrieved:string|null}>} */
    const byLic = new Map();

    for (const r of rows.rows) {
      const lic = normalizeLicenseKey(r.lic);
      if (!lic) continue;
      if (!byLic.has(lic)) {
        byLic.set(lic, {
          count: 0,
          counties: new Set(),
          categories: new Set(),
          samples: [],
          dates: [],
          retrieved: null,
        });
      }
      const agg = byLic.get(lic);
      agg.count += 1;
      const label = r.jurisdiction_label || "";
      // County-ish token from label
      const county = label.replace(/\s*County.*$/i, "").replace(/\s*\/.*$/, "").trim();
      if (county) agg.counties.add(county);
      if (r.category) agg.categories.add(r.category);
      if (r.description && agg.samples.length < 8 && !agg.samples.includes(r.description)) {
        agg.samples.push(String(r.description).slice(0, 120));
      }
      if (r.any_date) agg.dates.push(r.any_date.slice(0, 4));
      if (r.retrieved_at) agg.retrieved = r.retrieved_at;
    }

    await client.query("BEGIN");
    // Remove prior CTH wave rollups so rebuild is clean
    await client.query(
      `DELETE FROM contractor_permit_activity WHERE source_label ILIKE $1 || '%'`,
      [sourcePrefix]
    );

    let upserted = 0;
    for (const [lic, agg] of byLic) {
      const years = [...new Set(agg.dates)].filter(Boolean).sort();
      const recentWindow =
        years.length === 0
          ? null
          : years.length === 1
            ? years[0]
            : `${years[0]}–${years[years.length - 1]}`;
      await client.query(
        `
        INSERT INTO contractor_permit_activity (
          license_key_norm, permit_count, counties, categories, recent_window,
          sample_types, match_method, source_label, retrieved_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,'license',$7,COALESCE($8::timestamptz, now()), now())
        ON CONFLICT (license_key_norm) DO UPDATE SET
          permit_count = EXCLUDED.permit_count,
          counties = EXCLUDED.counties,
          categories = EXCLUDED.categories,
          recent_window = EXCLUDED.recent_window,
          sample_types = EXCLUDED.sample_types,
          source_label = EXCLUDED.source_label,
          retrieved_at = EXCLUDED.retrieved_at,
          updated_at = now()
        `,
        [
          lic,
          agg.count,
          [...agg.counties],
          [...agg.categories],
          recentWindow,
          agg.samples,
          `${sourcePrefix} activity rollup (rebuilt from permits)`,
          agg.retrieved,
        ]
      );
      upserted += 1;
    }
    await client.query("COMMIT");

    console.log(`Permit rows with license: ${rows.rowCount}`);
    console.log(`Activity keys upserted: ${upserted}`);
    console.log("Done.");
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
