import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const batchSize = Math.min(Math.max(Number(process.argv[2] || 1000), 100), 2000);

const pool = new Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 15_000,
  idleTimeoutMillis: 1_000,
  allowExitOnIdle: true,
  ssl: { rejectUnauthorized: false },
});

let cursor = "00000000-0000-0000-0000-000000000000";
let processed = 0;
let batches = 0;
try {
  while (true) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL lock_timeout = '2s'");
      await client.query("SET LOCAL statement_timeout = '180s'");
      const ids = await client.query<{ id: string }>(
        `SELECT DISTINCT e.id
         FROM entities e
         JOIN contractor_entities ce ON ce.entity_id = e.id
         WHERE e.source_system = 'fl_sunbiz'
           AND ce.role IN ('sunbiz_entity', 'linked', 'entity')
           AND ce.confidence IS NOT NULL
           AND ce.confidence >= 0.90
           AND e.id > $1::uuid
         ORDER BY e.id
         LIMIT $2`,
        [cursor, batchSize]
      );
      if (!ids.rowCount) {
        await client.query("ROLLBACK");
        break;
      }
      const batchIds = ids.rows.map((row) => row.id);
      await client.query(
        `SELECT sync_entity_officer_lookup(entity_id)
         FROM unnest($1::uuid[]) AS entity_id`,
        [batchIds]
      );
      await client.query("COMMIT");
      cursor = batchIds.at(-1)!;
      processed += batchIds.length;
      batches += 1;
      console.log(`batch=${batches} processed=${processed}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  console.log(`backfill_complete processed=${processed} batches=${batches}`);
} finally {
  await pool.end();
}
