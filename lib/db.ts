import { Pool, type PoolClient, type QueryResultRow } from "pg";

/**
 * Server-only Postgres pool.
 *
 * Production (Vercel): use Supabase **Transaction pooler** URI:
 *   host:  *.pooler.supabase.com
 *   port:  6543
 *   user:  postgres.<project-ref>
 * Do not use the direct db.*.supabase.co host if the runtime lacks IPv6.
 *
 * Env: DATABASE_URL (preferred) or POSTGRES_URL.
 */

let pool: Pool | null = null;

/** Allow bounded queueing behind the isolate's single client under request bursts. */
const CONNECT_TIMEOUT_MS = 60_000;
/** Cap runaway Verify/list SQL so one search cannot pin the only pool client. */
const DEFAULT_STATEMENT_TIMEOUT_MS = 8_000;

function getPool(): Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add the authorized Supabase Transaction pooler URI (*.pooler.supabase.com:6543) to Vercel Production."
    );
  }

  // Guard against placeholder/redacted env (agent sandboxes) so we fail clearly.
  if (
    connectionString.includes("[SENSITIVE]") ||
    connectionString.length < 20 ||
    !connectionString.includes("postgres")
  ) {
    throw new Error(
      "DATABASE_URL is missing or invalid. Use the authorized Supabase Transaction pooler (port 6543), not a placeholder."
    );
  }

  const isSupabase =
    connectionString.includes("supabase") ||
    connectionString.includes("pooler.supabase");
  const needsSsl =
    isSupabase ||
    connectionString.includes("sslmode=require") ||
    process.env.PGSSLMODE === "require" ||
    process.env.VERCEL === "1";

  // Serverless: one application client per isolate. Supavisor handles backend reuse.
  const isBuild =
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.npm_lifecycle_event === "build";
  const max = process.env.VERCEL || isBuild || process.env.CI ? 1 : 5;

  pool = new Pool({
    connectionString,
    max,
    idleTimeoutMillis: isBuild || process.env.VERCEL ? 1_000 : 10_000,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    allowExitOnIdle: true,
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
    msg.includes("remaining connection slots") ||
    msg.includes("MaxClientsInSessionMode")
  );
}

export function isDbConnectTimeout(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("timeout exceeded when trying to connect") ||
    msg.includes("Connection terminated due to connection timeout") ||
    msg.includes("connect ETIMEDOUT") ||
    msg.includes("Connection terminated unexpectedly")
  );
}

export function isDbQueryTimeout(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("canceling statement due to statement timeout") ||
    msg.includes("Query read timeout") ||
    msg.includes("statement timeout")
  );
}

/** Stable product-facing error; technical detail stays in logs. */
export function dbUserFacingError(err: unknown): string {
  if (isDbConnectTimeout(err) || isDbCapacityError(err)) {
    return "timeout exceeded when trying to connect";
  }
  if (isDbQueryTimeout(err)) {
    return "search took too long — try a more specific name or license number";
  }
  return err instanceof Error ? err.message : "database error";
}

function logDbError(phase: string, err: unknown, sqlPreview: string): void {
  const msg = err instanceof Error ? err.message : String(err);
  const kind = isDbConnectTimeout(err)
    ? "connect_timeout"
    : isDbQueryTimeout(err)
      ? "query_timeout"
      : isDbCapacityError(err)
        ? "capacity"
        : "other";
  console.error(
    `[db] ${phase} kind=${kind} msg=${msg.slice(0, 200)} sql=${sqlPreview.slice(0, 80).replace(/\s+/g, " ")}`
  );
}

async function queryOnce<T extends QueryResultRow>(
  text: string,
  params: unknown[] | undefined,
  statementTimeoutMs: number
): Promise<T[]> {
  const p = getPool();
  let client: PoolClient | null = null;
  try {
    client = await p.connect();
    await client.query("BEGIN");
    // LOCAL is scoped to this explicit transaction and is safe with transaction pooling.
    await client.query(`SET LOCAL statement_timeout = ${Math.max(1000, statementTimeoutMs)}`);
    const res = await client.query<T>(text, params);
    await client.query("COMMIT");
    return res.rows;
  } catch (err) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* ignore */
      }
    }
    throw err;
  } finally {
    client?.release();
  }
}

/**
 * Run SQL with a statement timeout. Connection/capacity failures are not retried:
 * Supavisor and the one-client application pool already queue bounded work, and a
 * reconnect here would amplify a concurrent burst.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
  opts?: { statementTimeoutMs?: number }
): Promise<T[]> {
  const statementTimeoutMs = opts?.statementTimeoutMs ?? DEFAULT_STATEMENT_TIMEOUT_MS;
  try {
    return await queryOnce<T>(text, params, statementTimeoutMs);
  } catch (err) {
    logDbError("query", err, text);
    throw err;
  }
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
  opts?: { statementTimeoutMs?: number }
): Promise<T | null> {
  const rows = await query<T>(text, params, opts);
  return rows[0] ?? null;
}
