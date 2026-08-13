/**
 * Stage 8C production permit load (Waves A–C).
 * Idempotent: replace CTH Wave rows, rebuild activity from permits, log ops_load_runs.
 *
 * Usage:
 *   node scripts/load_wave_permits.mjs
 *   node scripts/load_wave_permits.mjs --wave A
 *   node scripts/load_wave_permits.mjs --wave B,C
 *   node scripts/load_wave_permits.mjs --file data/property/sample-permits.json
 *   node scripts/load_wave_permits.mjs --dry-run
 *
 * Requires DATABASE_URL + migration 006 (007 optional for ops_load_runs).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPool,
  normalizeLicenseKey,
  normalizePermitStatus,
  slugFromJurisdiction,
  waveForSlug,
  WAVE_SLUGS,
} from "./lib/db-pool.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function parseArgs(argv) {
  const out = {
    waves: ["A", "B", "C"],
    file: path.join(root, "data/property/sample-permits.json"),
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--wave" && argv[i + 1]) {
      out.waves = argv[++i]
        .split(",")
        .map((w) => w.trim().toUpperCase())
        .filter((w) => ["A", "B", "C"].includes(w));
    } else if (argv[i] === "--file" && argv[i + 1]) {
      out.file = path.isAbsolute(argv[++i])
        ? argv[i]
        : path.join(root, argv[i]);
    } else if (argv[i] === "--dry-run") {
      out.dryRun = true;
    }
  }
  if (!out.waves.length) out.waves = ["A", "B", "C"];
  return out;
}

const opts = parseArgs(process.argv.slice(2));
const allowedSlugs = new Set(opts.waves.flatMap((w) => WAVE_SLUGS[w] || []));

async function tableExists(client, name) {
  const r = await client.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [name]
  );
  return (r.rowCount || 0) > 0;
}

async function main() {
  if (!fs.existsSync(opts.file)) {
    console.error("Extract file not found:", opts.file);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(opts.file, "utf8"));
  const metaUpdated = raw._meta?.updated || null;

  console.log("=== Stage 8C permit load ===");
  console.log("File:", opts.file);
  console.log("Waves:", opts.waves.join(", "));
  console.log("Freshness meta:", metaUpdated || "—");
  console.log("Dry run:", opts.dryRun);

  // Collect rows for selected waves
  /** @type {Array<{addressKey:string, street:string, zip:string, row:any, slug:string}>} */
  const toLoad = [];
  for (const [addressKey, rows] of Object.entries(raw.byAddressKey || {})) {
    const parts = addressKey.split("|");
    const zip = parts[parts.length - 1];
    const street = parts[0];
    for (const r of rows) {
      const slug = slugFromJurisdiction(r.sourceJurisdiction);
      if (!allowedSlugs.has(slug)) continue;
      toLoad.push({ addressKey, street, zip, row: r, slug });
    }
  }

  console.log("Rows selected for load:", toLoad.length);
  if (toLoad.length === 0) {
    console.error("FAIL: zero-row load for selected waves — aborting (no write).");
    process.exit(2);
  }

  if (opts.dryRun) {
    const by = {};
    for (const t of toLoad) {
      by[t.slug] = (by[t.slug] || 0) + 1;
    }
    console.log("By jurisdiction:", by);
    console.log("Dry run complete — no DB writes.");
    return;
  }

  const { pool } = createPool();
  const client = await pool.connect();
  const started = new Date().toISOString();
  let prevCount = 0;
  let hasOps = false;

  try {
    hasOps = await tableExists(client, "ops_load_runs");
    const prev = await client.query(
      `SELECT COUNT(*)::int AS n FROM permit_records WHERE source_label ILIKE 'CTH Wave%'`
    );
    prevCount = prev.rows[0]?.n || 0;

    await client.query("BEGIN");

    // Replace prior CTH wave loads only (idempotent)
    await client.query(
      `DELETE FROM permit_records WHERE source_label ILIKE 'CTH Wave%'`
    );

    let inserted = 0;
    const byJuris = {};

    for (const t of toLoad) {
      const r = t.row;
      const status = normalizePermitStatus(r.status);
      const statusRaw = (r.status || "").trim();
      const payload = {
        ...r,
        statusRaw,
        statusNormalized: status,
        loadedAt: started,
        waves: opts.waves,
      };

      // Idempotent via delete of CTH Wave rows above, then insert
      await client.query(
        `INSERT INTO permit_records (
           jurisdiction_slug, jurisdiction_label, address_key, street_normalized,
           zip, county, permit_number, description, category, status,
           filed_date, issued_date, final_date, declared_value,
           contractor_name, contractor_license_key, source_label, retrieved_at, raw
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
           $11::date,$12::date,$13::date,$14,
           $15,$16,$17,COALESCE($18::timestamptz, now()), $19::jsonb
         )`,
        [
          t.slug,
          r.sourceJurisdiction,
          t.addressKey,
          t.street,
          t.zip,
          null,
          r.permitNumber,
          r.description,
          r.category,
          status,
          r.filedDate,
          r.issuedDate,
          r.finalDate,
          r.declaredValue,
          r.contractorName,
          r.contractorLicenseKey,
          r.sourceLabel || `CTH Wave ${waveForSlug(t.slug)} extract`,
          r.retrievedAt || metaUpdated || null,
          JSON.stringify(payload),
        ]
      );
      inserted += 1;
      byJuris[t.slug] = byJuris[t.slug] || { n: 0, withLic: 0 };
      byJuris[t.slug].n += 1;
      if (r.contractorLicenseKey) byJuris[t.slug].withLic += 1;
    }

    // Rebuild activity from loaded permits (precision: license key only)
    await client.query(
      `DELETE FROM contractor_permit_activity WHERE source_label ILIKE 'CTH Wave%'`
    );

    const roll = await client.query(
      `
      SELECT
        UPPER(REGEXP_REPLACE(contractor_license_key, '[^A-Za-z0-9]', '', 'g')) AS lic,
        array_agg(DISTINCT split_part(jurisdiction_label, ' County', 1)) FILTER (WHERE jurisdiction_label IS NOT NULL) AS counties,
        array_agg(DISTINCT category) FILTER (WHERE category IS NOT NULL) AS categories,
        array_agg(DISTINCT LEFT(description, 100)) FILTER (WHERE description IS NOT NULL) AS samples,
        COUNT(*)::int AS n,
        MIN(COALESCE(filed_date, issued_date)::text) AS d0,
        MAX(COALESCE(final_date, issued_date, filed_date)::text) AS d1,
        MAX(retrieved_at) AS retrieved
      FROM permit_records
      WHERE contractor_license_key IS NOT NULL
        AND TRIM(contractor_license_key) <> ''
        AND source_label ILIKE 'CTH Wave%'
      GROUP BY 1
      `
    );

    for (const r of roll.rows) {
      const lic = normalizeLicenseKey(r.lic);
      if (!lic) continue;
      const y0 = r.d0 ? String(r.d0).slice(0, 4) : null;
      const y1 = r.d1 ? String(r.d1).slice(0, 4) : null;
      const window =
        y0 && y1 ? (y0 === y1 ? y0 : `${y0}–${y1}`) : y0 || y1 || null;
      const samples = (r.samples || []).filter(Boolean).slice(0, 8);
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
          r.n,
          r.counties || [],
          r.categories || [],
          window,
          samples,
          "CTH Wave activity rollup (rebuilt from permits)",
          r.retrieved,
        ]
      );
    }

    // Coverage stats
    for (const [slug, info] of Object.entries(byJuris)) {
      await client.query(
        `
        INSERT INTO permit_coverage_stats (
          jurisdiction_slug, record_count, with_license_key, license_join_hits,
          freshness, wave, notes, updated_at
        ) VALUES ($1,$2,$3,0,$4::date,$5,$6, now())
        ON CONFLICT (jurisdiction_slug) DO UPDATE SET
          record_count = EXCLUDED.record_count,
          with_license_key = EXCLUDED.with_license_key,
          freshness = EXCLUDED.freshness,
          wave = EXCLUDED.wave,
          notes = EXCLUDED.notes,
          updated_at = now()
        `,
        [
          slug,
          info.n,
          info.withLic,
          metaUpdated || null,
          waveForSlug(slug),
          `Stage 8C load waves ${opts.waves.join("+")} from ${path.basename(opts.file)}`,
        ]
      );
    }

    if (hasOps) {
      await client.query(
        `
        INSERT INTO ops_load_runs (
          source_system, source_dataset, status, row_count, row_count_prev, delta_rows,
          jurisdictions, notes, started_at, finished_at
        ) VALUES (
          'fl_permits_wave', $1, 'success', $2, $3, $4,
          $5::jsonb, $6, $7::timestamptz, now()
        )
        `,
        [
          `waves_${opts.waves.join("")}`,
          inserted,
          prevCount,
          inserted - prevCount,
          JSON.stringify(byJuris),
          `Loaded ${path.basename(opts.file)}; activity rebuilt from permits`,
          started,
        ]
      );
    }

    await client.query("COMMIT");

    console.log(`Inserted ${inserted} permit_records (prev CTH Wave: ${prevCount})`);
    console.log("Delta:", inserted - prevCount);
    console.log("Jurisdictions:", byJuris);
    console.log("Activity keys rebuilt:", roll.rowCount);
    console.log("Next: npm run verify:ops && npm run audit:production");
  } catch (e) {
    await client.query("ROLLBACK");
    if (hasOps) {
      try {
        await client.query(
          `
          INSERT INTO ops_load_runs (
            source_system, source_dataset, status, row_count, error_message,
            notes, started_at, finished_at
          ) VALUES (
            'fl_permits_wave', $1, 'failed', 0, $2, $3, $4::timestamptz, now()
          )
          `,
          [
            `waves_${opts.waves.join("")}`,
            String(e?.message || e).slice(0, 2000),
            "Load failed — see error_message",
            started,
          ]
        );
      } catch {
        /* ignore log failure */
      }
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
