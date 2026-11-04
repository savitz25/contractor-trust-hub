/**
 * Rebuild public.contractor_profile_enrichment from the shared enrichment
 * predicate. Reads DATABASE_URL only when --apply is present. Does not print
 * the connection string.
 *
 * Run from the repo after migration 021 is applied:
 *   npx tsx --tsconfig scripts/tsconfig.fl-county-code.json scripts/refresh_contractor_profile_enrichment.mjs --apply
 *
 * CON_OSHA_001_PROFILE and REGULATORY_PUBLICATION_GATE_V1 in the environment
 * must match production. The sitemap and the profile page then read this table
 * and do not recompute the predicate per request.
 */
import fs from "node:fs";
import pg from "pg";

function redact(value) {
  return String(value).replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted]").slice(0, 240);
}

function readEnvValue(text, name) {
  const match = text.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!match) return null;
  let value = match[1].trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value;
}

function flagOn(value) {
  if (value == null) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

if (!process.argv.includes("--apply")) {
  console.log(JSON.stringify({ ok: false, reason: "pass --apply to refresh the cache" }));
  process.exit(2);
}

const envText = fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8") : "";
const databaseUrl = process.env.DATABASE_URL || readEnvValue(envText, "DATABASE_URL");
if (!databaseUrl) {
  console.log(JSON.stringify({ ok: false, reason: "no-database-url" }));
  process.exit(2);
}
if (!databaseUrl.includes("jhjztnisugdsuliriajp")) {
  console.log(JSON.stringify({ ok: false, reason: "unexpected-project" }));
  process.exit(2);
}

const oshaEnabled = flagOn(process.env.CON_OSHA_001_PROFILE) || flagOn(readEnvValue(envText, "CON_OSHA_001_PROFILE"));
const regulatoryGate = flagOn(process.env.REGULATORY_PUBLICATION_GATE_V1) || flagOn(readEnvValue(envText, "REGULATORY_PUBLICATION_GATE_V1"));
if (regulatoryGate) process.env.REGULATORY_PUBLICATION_GATE_V1 = "1";
if (oshaEnabled) process.env.CON_OSHA_001_PROFILE = "1";

const { profileEnrichmentRefreshSelectSql } = await import("../lib/contractors/profile-enrichment.ts");
const selectSql = profileEnrichmentRefreshSelectSql({ oshaEnabled });

let connectionString = databaseUrl
  .replace(/([?&])sslmode=[^&]*/gi, "$1")
  .replace(/\?&/g, "?")
  .replace(/[?&]$/, "");
const client = new pg.Client({
  connectionString,
  connectionTimeoutMillis: 8000,
  ssl: databaseUrl.includes("supabase") || /sslmode=/i.test(databaseUrl)
    ? { rejectUnauthorized: false }
    : undefined,
});

const out = { ok: true, oshaEnabled, regulatoryGate };
try {
  await client.connect();
  const started = Date.now();
  await client.query("BEGIN");
  await client.query("SET LOCAL statement_timeout = 120000");
  await client.query("TRUNCATE contractor_profile_enrichment");
  const inserted = await client.query(
    `INSERT INTO contractor_profile_enrichment (
       contractor_id, enriched, signals, content_changed_at, slug, home_state, is_thin_profile, license_sources
     )
     ${selectSql}`,
  );
  await client.query("COMMIT");
  out.inserted = inserted.rowCount;
  out.ms = Date.now() - started;
} catch (error) {
  try {
    await client.query("ROLLBACK");
  } catch {
    /* already closed */
  }
  out.ok = false;
  out.error = redact(error.message);
  out.code = error.code ?? null;
} finally {
  try {
    await client.end();
  } catch {
    /* closed */
  }
}
console.log(JSON.stringify(out));
if (!out.ok) process.exit(1);
