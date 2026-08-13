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

  // Supabase Session pooler caps ~15 clients per mode. Next.js static
  // generation fans out many workers — each with its own pool — so keep max=1
  // on Vercel/build. Local dev can use a slightly larger pool.
  const isBuild =
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.npm_lifecycle_event === "build";
  const max = process.env.VERCEL || isBuild || process.env.CI ? 1 : 5;

  pool = new Pool({
    connectionString,
    max,
    // Release idle clients quickly so parallel build workers don't pile up.
    idleTimeoutMillis: isBuild ? 1_000 : 5_000,
    connectionTimeoutMillis: 12_000,
    allowExitOnIdle: true,
    // Session pooler supports prepared statements; keep default true.
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });

  pool.on("error", (err) => {
    console.error("[db] idle client error", err.message);
  });

  return pool;
}

export function isDbCapacityError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("EMAXCONNSESSION") ||
    msg.includes("max clients reached") ||
    msg.includes("too many clients") ||
    msg.includes("remaining connection slots")
  );
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
