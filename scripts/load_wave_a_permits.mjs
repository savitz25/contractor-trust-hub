/**
 * Batch load Wave extract JSON into permit_records + contractor_permit_activity.
 * Usage: node scripts/load_wave_a_permits.mjs
 * Requires DATABASE_URL and migration 006.
 *
 * Idempotent: deletes prior rows for known Wave A–C source labels, then re-inserts.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const extractPath = path.join(root, "data", "property", "sample-permits.json");

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

function normalizeLicenseKey(key) {
  if (!key) return "";
  return String(key).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeStatus(raw) {
  const h = String(raw || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  if (["open", "closed", "expired", "issued", "finaled", "unknown"].includes(h))
    return h;
  if (/expir|void|cancel|withdraw|revok|deni|reject/.test(h)) return "expired";
  if (/final|completed|complete|co final|occupancy/.test(h)) return "finaled";
  if (/issued|issue|approved issued/.test(h)) return "issued";
  if (/closed|archived|done/.test(h)) return "closed";
  if (/open|progress|pending|applied|active|submitted/.test(h)) return "open";
  return "unknown";
}

function slugFromJurisdiction(label) {
  const l = (label || "").toLowerCase();
  if (l.includes("miami")) return "miami-dade";
  if (l.includes("broward")) return "broward";
  if (l.includes("orange")) return "orange";
  if (l.includes("hillsborough") || l.includes("tampa")) return "hillsborough";
  if (l.includes("palm")) return "palm-beach";
  if (l.includes("duval") || l.includes("jacksonville")) return "duval";
  if (l.includes("pinellas")) return "pinellas";
  if (l.includes("lee")) return "lee";
  if (l.includes("collier")) return "collier";
  if (l.includes("sarasota")) return "sarasota";
  if (l.includes("pasco")) return "pasco";
  if (l.includes("polk")) return "polk";
  return "unknown";
}

function waveForSlug(slug) {
  if (["miami-dade", "broward", "orange", "hillsborough"].includes(slug)) return "A";
  if (["palm-beach", "duval", "pinellas", "lee"].includes(slug)) return "B";
  if (["collier", "sarasota", "pasco", "polk"].includes(slug)) return "C";
  return "future";
}

const pool = new pg.Pool({
  connectionString: url,
  ssl:
    url.includes("supabase") || url.includes("sslmode=require")
      ? { rejectUnauthorized: false }
      : undefined,
  max: 2,
});

async function main() {
  const raw = JSON.parse(fs.readFileSync(extractPath, "utf8"));
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Clear prior CTH wave loads only
    await client.query(
      `DELETE FROM permit_records WHERE source_label ILIKE 'CTH Wave%'`
    );
    await client.query(
      `DELETE FROM contractor_permit_activity WHERE source_label ILIKE 'CTH Wave%' OR source_label ILIKE 'CTH Wave%'`
    );

    let inserted = 0;
    const byJuris = {};

    for (const [addressKey, rows] of Object.entries(raw.byAddressKey || {})) {
      const parts = addressKey.split("|");
      const zip = parts[parts.length - 1];
      const street = parts[0];
      for (const r of rows) {
        const slug = slugFromJurisdiction(r.sourceJurisdiction);
        const status = normalizeStatus(r.status);
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
            slug,
            r.sourceJurisdiction,
            addressKey,
            street,
            zip,
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
            r.sourceLabel || "CTH Wave extract",
            r.retrievedAt || raw._meta?.updated || null,
            JSON.stringify(r),
          ]
        );
        inserted += 1;
        byJuris[slug] = byJuris[slug] || { n: 0, withLic: 0 };
        byJuris[slug].n += 1;
        if (r.contractorLicenseKey) byJuris[slug].withLic += 1;
      }
    }

    // Activity rollups
    for (const [key, act] of Object.entries(raw.contractorActivityByLicense || {})) {
      const norm = normalizeLicenseKey(key);
      if (!norm) continue;
      await client.query(
        `INSERT INTO contractor_permit_activity (
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
           updated_at = now()`,
        [
          norm,
          act.permitCount || 0,
          act.counties || [],
          act.categories || [],
          act.recentWindow || null,
          act.sampleTypes || [],
          act.sourceLabel || "CTH Wave activity rollup",
          act.retrievedAt || raw._meta?.updated || null,
        ]
      );
    }

    // Coverage stats
    for (const [slug, info] of Object.entries(byJuris)) {
      await client.query(
        `INSERT INTO permit_coverage_stats (
           jurisdiction_slug, record_count, with_license_key, license_join_hits,
           freshness, wave, notes, updated_at
         ) VALUES ($1,$2,$3,0,$4::date,$5,$6, now())
         ON CONFLICT (jurisdiction_slug) DO UPDATE SET
           record_count = EXCLUDED.record_count,
           with_license_key = EXCLUDED.with_license_key,
           freshness = EXCLUDED.freshness,
           wave = EXCLUDED.wave,
           notes = EXCLUDED.notes,
           updated_at = now()`,
        [
          slug,
          info.n,
          info.withLic,
          raw._meta?.updated || null,
          waveForSlug(slug),
          "Loaded from data/property/sample-permits.json",
        ]
      );
    }

    await client.query("COMMIT");
    console.log(`Inserted ${inserted} permit_records`);
    console.log("Jurisdictions:", byJuris);
    console.log(
      "Activity keys:",
      Object.keys(raw.contractorActivityByLicense || {}).length
    );
    console.log("Done. Run: node scripts/verify_stage6_migration.mjs");
  } catch (e) {
    await client.query("ROLLBACK");
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
