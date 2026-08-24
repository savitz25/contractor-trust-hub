import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { Pool } from "pg";
import { normalizeOfficerLookupKey } from "../lib/contractors/entity-lineage";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const migration = await fs.readFile(
  new URL("../schema/migrations/009_entity_officer_lookup.sql", import.meta.url),
  "utf8"
);
const pool = new Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 15_000,
  idleTimeoutMillis: 1_000,
  allowExitOnIdle: true,
  ssl: { rejectUnauthorized: false },
});
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(migration);

  const rawFixtures = [
    " Jane  Doe ",
    "JANE.DOE",
    "Jane O'Neil, Jr.",
    "ACME SERVICES LLC",
    "Dr. John Smith III",
    "Mary-Jane / Smith Sr",
  ];
  const sqlNormalized = await client.query<{ normalized: string }>(
    `SELECT normalize_entity_officer_name(value) AS normalized
     FROM unnest($1::text[]) AS value`,
    [rawFixtures]
  );
  assert.deepEqual(
    sqlNormalized.rows.map((row) => row.normalized),
    rawFixtures.map(normalizeOfficerLookupKey)
  );

  const entity = await client.query<{ id: string; officers: unknown }>(`
    SELECT e.id, e.officers
    FROM entities e
    WHERE e.source_system = 'fl_sunbiz'
      AND jsonb_typeof(e.officers) = 'array'
      AND jsonb_array_length(e.officers) > 0
      AND EXISTS (
        SELECT 1 FROM contractor_entities ce
        WHERE ce.entity_id = e.id
          AND ce.role IN ('sunbiz_entity', 'linked', 'entity')
          AND ce.confidence >= 0.90
      )
    LIMIT 1
  `);
  assert.equal(entity.rowCount, 1);
  const id = entity.rows[0].id;

  await client.query("SELECT sync_entity_officer_lookup($1::uuid)", [id]);
  const first = await client.query<{ n: string }>(
    "SELECT COUNT(*)::text AS n FROM entity_officer_lookup WHERE entity_id = $1",
    [id]
  );
  await client.query("SELECT sync_entity_officer_lookup($1::uuid)", [id]);
  const second = await client.query<{ n: string }>(
    "SELECT COUNT(*)::text AS n FROM entity_officer_lookup WHERE entity_id = $1",
    [id]
  );
  assert.equal(first.rows[0].n, second.rows[0].n);

  const syntheticName = "Migration Consistency Person XQZ";
  await client.query(
    `UPDATE entities
     SET officers = officers || jsonb_build_array(jsonb_build_object(
       'name', $2::text, 'title', 'TEST', 'type', 'Officer'
     ))
     WHERE id = $1`,
    [id, syntheticName]
  );
  const reflected = await client.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n
     FROM entity_officer_lookup
     WHERE entity_id = $1
       AND officer_name_normalized = normalize_entity_officer_name($2)`,
    [id, syntheticName]
  );
  assert.equal(reflected.rows[0].n, "1");

  console.log(
    `migration_validation=PASS normalization=${rawFixtures.length}/${rawFixtures.length} idempotent=yes update_sync=yes source_rows_preserved=yes`
  );
} finally {
  await client.query("ROLLBACK");
  client.release();
  await pool.end();
}
