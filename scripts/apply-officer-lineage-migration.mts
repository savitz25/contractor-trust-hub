import fs from "node:fs/promises";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const sql = await fs.readFile(
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
  await client.query(sql);
  await client.query("COMMIT");
  console.log("migration=009_entity_officer_lookup status=applied");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
