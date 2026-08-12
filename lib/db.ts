import { Pool, type QueryResultRow } from "pg";

/**
 * Server-only Postgres pool.
 *
 * Production (Vercel): use Supabase **Session pooler** URI (port 5432), not the
 * direct IPv6-only host and not Transaction pooler (:6543) for this app.
 *
 * Env: DATABASE_URL (preferred) or POSTGRES_URL.
 */
let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add Session pooler URI to .env.local (local) or Vercel Project Settings → Environment Variables (production)."
    );
  }

  const isSupabase =
    connectionString.includes("supabase") || connectionString.includes("pooler.supabase");
  const needsSsl =
    isSupabase ||
    connectionString.includes("sslmode=require") ||
    process.env.PGSSLMODE === "require" ||
    process.env.VERCEL === "1";

  // Vercel serverless: keep pool small; Session pooler handles multiplexing.
  const max = process.env.VERCEL ? 2 : 5;

  pool = new Pool({
    connectionString,
    max,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 12_000,
    // Session pooler supports prepared statements; keep default true.
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });

  pool.on("error", (err) => {
    console.error("[db] idle client error", err.message);
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
