import { Pool, type QueryResultRow } from "pg";

/**
 * Server-only Postgres pool (Supabase Session pooler recommended for Vercel).
 * DATABASE_URL is loaded from the environment at runtime.
 */
let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env.local (Session pooler URI) for local dev, or Vercel env for production."
    );
  }
  // Ensure SSL for Supabase
  const needsSsl =
    connectionString.includes("supabase") || connectionString.includes("sslmode=require");
  pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 15_000,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const res = await getPool().query<T>(text, params);
  return res.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
