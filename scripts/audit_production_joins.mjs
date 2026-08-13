/**
 * Stage 8C production join audit (DB when available, else file extract).
 * Exact license keys only — reports join-rate proxy and unmatched license-bearing rows.
 *
 * Usage:
 *   node scripts/audit_production_joins.mjs
 *   node scripts/audit_production_joins.mjs --file-only
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPool, getDatabaseUrl, normalizeLicenseKey } from "./lib/db-pool.mjs";

const fileOnly = process.argv.includes("--file-only");
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function auditFile() {
  const data = JSON.parse(
    fs.readFileSync(path.join(root, "data/property/sample-permits.json"), "utf8")
  );
  const onPermits = new Set();
  let licenseRows = 0;
  let noLicense = 0;
  const byJ = {};
  for (const rows of Object.values(data.byAddressKey || {})) {
    for (const r of rows) {
      const j = r.sourceJurisdiction || "?";
      byJ[j] = (byJ[j] || 0) + 1;
      if (r.contractorLicenseKey) {
        licenseRows += 1;
        onPermits.add(normalizeLicenseKey(r.contractorLicenseKey));
      } else noLicense += 1;
    }
  }
  const activity = Object.keys(data.contractorActivityByLicense || {}).map(normalizeLicenseKey);
  const actSet = new Set(activity);
  let matched = 0;
  for (const k of onPermits) if (actSet.has(k)) matched += 1;
  return {
    source: "file",
    byJurisdiction: byJ,
    licenseRows,
    noLicense,
    distinctPermitKeys: onPermits.size,
    activityKeys: activity.length,
    matched,
    unmatched: onPermits.size - matched,
    joinRate:
      onPermits.size > 0
        ? Math.round((matched / onPermits.size) * 1000) / 10
        : 0,
    freshness: data._meta?.updated || null,
  };
}

async function auditDb() {
  const { pool } = createPool();
  const client = await pool.connect();
  try {
    const byJ = await client.query(
      `
      SELECT jurisdiction_label AS j, COUNT(*)::int AS n
      FROM permit_records
      WHERE source_label ILIKE 'CTH Wave%'
      GROUP BY 1 ORDER BY 1
      `
    );
    const lic = await client.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE contractor_license_key IS NOT NULL AND TRIM(contractor_license_key) <> '')::int AS with_lic,
        COUNT(*) FILTER (WHERE contractor_license_key IS NULL OR TRIM(contractor_license_key) = '')::int AS no_lic,
        COUNT(DISTINCT UPPER(REGEXP_REPLACE(contractor_license_key, '[^A-Za-z0-9]', '', 'g')))
          FILTER (WHERE contractor_license_key IS NOT NULL)::int AS distinct_keys
      FROM permit_records
      WHERE source_label ILIKE 'CTH Wave%'
      `
    );
    const act = await client.query(
      `SELECT COUNT(*)::int AS n FROM contractor_permit_activity`
    );
    const overlap = await client.query(
      `
      WITH permit_keys AS (
        SELECT DISTINCT UPPER(REGEXP_REPLACE(contractor_license_key, '[^A-Za-z0-9]', '', 'g')) AS k
        FROM permit_records
        WHERE contractor_license_key IS NOT NULL
          AND source_label ILIKE 'CTH Wave%'
      )
      SELECT
        (SELECT COUNT(*) FROM permit_keys)::int AS permit_keys,
        (SELECT COUNT(*) FROM permit_keys pk
         JOIN contractor_permit_activity a ON a.license_key_norm = pk.k)::int AS matched
      `
    );
    const permitKeys = overlap.rows[0].permit_keys || 0;
    const matched = overlap.rows[0].matched || 0;
    const byJurisdiction = {};
    for (const r of byJ.rows) byJurisdiction[r.j] = r.n;

    // Sample: no name-only joins exist by construction
    return {
      source: "database",
      byJurisdiction,
      licenseRows: lic.rows[0].with_lic,
      noLicense: lic.rows[0].no_lic,
      distinctPermitKeys: lic.rows[0].distinct_keys,
      activityKeys: act.rows[0].n,
      matched,
      unmatched: permitKeys - matched,
      joinRate: permitKeys > 0 ? Math.round((matched / permitKeys) * 1000) / 10 : 0,
      freshness: null,
      falseJoinNote:
        "Name-only joins are disabled in application matcher; auto-joins use exact license keys only.",
    };
  } finally {
    client.release();
    await pool.end();
  }
}

function printReport(r) {
  console.log("=== Production join audit ===");
  console.log("Source:", r.source);
  console.log("Records by jurisdiction:", r.byJurisdiction);
  console.log("License-bearing rows:", r.licenseRows);
  console.log("No-license rows:", r.noLicense);
  console.log("Distinct license keys on permits:", r.distinctPermitKeys);
  console.log("Activity rollup keys:", r.activityKeys);
  console.log("Keys on both permit + activity:", r.matched);
  console.log("License keys with no activity row:", r.unmatched);
  console.log("Join rate proxy:", `${r.joinRate}%`);
  if (r.freshness) console.log("Freshness:", r.freshness);
  console.log(
    "False-join note:",
    r.falseJoinNote ||
      "Name-only joins disabled; only exact license joins allowed."
  );
}

async function main() {
  if (fileOnly || !getDatabaseUrl()) {
    if (!fileOnly && !getDatabaseUrl()) {
      console.warn("DATABASE_URL not set — file extract audit only\n");
    }
    printReport(auditFile());
    return;
  }
  try {
    printReport(await auditDb());
  } catch (e) {
    console.warn("DB audit failed, falling back to file:", e.message);
    printReport(auditFile());
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
