/**
 * Parent acknowledgements held by Contractor.
 *
 * My TrustHub acknowledges a completed Save or Unsave to Contractor over the
 * signed source channel. The browser only learns of it by asking this server,
 * so the acknowledgement has to be held somewhere durable. One row per
 * hand-off, keyed by the SHA-256 of the continuation reference and bound to the
 * SHA-256 of the browser binding it was staged for. No account, name, license
 * or profile data is stored: only the outcome.
 *
 * Fails safe both ways. If the table is missing or the database is down, a
 * record is not written and a read answers "unknown": the device then never
 * claims an account Save or Unsave.
 */
import { createHash } from "node:crypto";

export type AckOutcome = "saved" | "already_saved" | "local_only";
export type AckStore = {
  record(continuationRef: string, browserBinding: string, outcome: AckOutcome, now: number): Promise<void>;
  /** The outcome for this hand-off and this browser, or null when none is held. */
  read(continuationRef: string, browserBinding: string, now: number): Promise<AckOutcome | null>;
};
export const ACK_RETENTION_MS = 24 * 60 * 60_000;
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const OPAQUE = /^[A-Za-z0-9_-]{43}$/;
const OUTCOMES: readonly string[] = ["saved", "already_saved", "local_only"];

export type AckSql = <T extends Record<string, unknown>>(text: string, params: unknown[]) => Promise<T[]>;

/** Postgres store over schema/migrations/016_my_trusthub_handoff_acks.sql. */
export function postgresAckStore(sql: AckSql): AckStore {
  return {
    async record(continuationRef, browserBinding, outcome, now) {
      if (!OPAQUE.test(continuationRef) || !OPAQUE.test(browserBinding) || !OUTCOMES.includes(outcome)) throw new Error("invalid_ack");
      // A hand-off is acknowledged once; a repeat for the same browser keeps the first outcome.
      await sql(
        `INSERT INTO my_trusthub_handoff_acks (continuation_hash, browser_hash, outcome, acknowledged_at, expires_at)
         VALUES ($1, $2, $3, to_timestamp($4 / 1000.0), to_timestamp($5 / 1000.0))
         ON CONFLICT (continuation_hash) DO NOTHING`,
        [sha(continuationRef), sha(browserBinding), outcome, now, now + ACK_RETENTION_MS]
      );
    },
    async read(continuationRef, browserBinding, now) {
      if (!OPAQUE.test(continuationRef) || !OPAQUE.test(browserBinding)) return null;
      const rows = await sql<{ outcome: string }>(
        `SELECT outcome FROM my_trusthub_handoff_acks
         WHERE continuation_hash = $1 AND browser_hash = $2 AND expires_at > to_timestamp($3 / 1000.0)
         LIMIT 1`,
        [sha(continuationRef), sha(browserBinding), now]
      );
      const outcome = rows[0]?.outcome;
      return outcome && OUTCOMES.includes(outcome) ? (outcome as AckOutcome) : null;
    },
  };
}

/** In-memory store for tests and local dry runs. Never used by a deployment. */
export function memoryAckStore(): AckStore & { size(): number } {
  const rows = new Map<string, { browser: string; outcome: AckOutcome; expiresAt: number }>();
  return {
    async record(continuationRef, browserBinding, outcome, now) {
      if (!OPAQUE.test(continuationRef) || !OPAQUE.test(browserBinding) || !OUTCOMES.includes(outcome)) throw new Error("invalid_ack");
      if (!rows.has(sha(continuationRef))) rows.set(sha(continuationRef), { browser: sha(browserBinding), outcome, expiresAt: now + ACK_RETENTION_MS });
    },
    async read(continuationRef, browserBinding, now) {
      const row = rows.get(sha(continuationRef));
      return row && row.browser === sha(browserBinding) && row.expiresAt > now ? row.outcome : null;
    },
    size: () => rows.size,
  };
}
