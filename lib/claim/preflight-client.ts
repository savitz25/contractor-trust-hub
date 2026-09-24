import { createHmac, randomBytes } from "node:crypto";

/**
 * ATH-CLAIM-V2-FLNJ-001R1 — Contractor client for Ask's durable claim-start preflight
 * (`POST {ask}/api/internal/claim/start-preflight`). Pure module: the route injects `fetch`.
 *
 * Contract (mirrors Ask lib/customer/claim-start-preflight.ts exactly):
 *  - body: `{ v:1, ts, rid, bucket, profileId }` — `bucket` is an opaque keyed digest of the local abuse bucket
 *    (`hmac(secret, "ATH_CLAIM_START_BUCKET_V1:<bucket>")`); Ask never receives the IP or the bucket.
 *  - header `x-ath-preflight-signature` = `hmac(secret, "ATH_CLAIM_START_PREFLIGHT_V1:<raw body>")`, a NEW
 *    domain-separated message (never the handoff-token message).
 *  - Only HTTP 200 + `{ allowed: true }` admits. 429 + `{ allowed: false }` is limited. Anything else — timeout,
 *    network error, non-2xx, bad shape — is UNAVAILABLE and the caller fails closed (no mint). No retry: a retry
 *    after an uncertain outcome could double-count.
 */
export const CLAIM_START_PREFLIGHT_DOMAIN = "ATH_CLAIM_START_PREFLIGHT_V1";
export const CLAIM_START_BUCKET_DOMAIN = "ATH_CLAIM_START_BUCKET_V1";
export const CLAIM_START_PREFLIGHT_PATH = "/api/internal/claim/start-preflight";
export const CLAIM_START_PREFLIGHT_TIMEOUT_MS = 2500;

export type DurablePreflightDecision =
  | { status: "allowed" }
  | { status: "limited"; reason: string; retryAfterSeconds: number }
  | { status: "unavailable"; reason: string };

const hmac = (secret: string, message: string) => createHmac("sha256", secret).update(message, "utf8").digest("base64url");

export function opaqueClaimStartBucket(secret: string, bucket: string): string {
  return hmac(secret, `${CLAIM_START_BUCKET_DOMAIN}:${bucket}`);
}

export function buildClaimStartPreflightRequest(secret: string, input: { bucket: string; profileId: string; now?: Date }): { body: string; signature: string; rid: string } {
  if (!secret || secret.length < 32) throw new Error("ATH_HANDOFF_SECRET is unavailable");
  const rid = randomBytes(24).toString("base64url");
  const body = JSON.stringify({ v: 1, ts: Math.floor((input.now ?? new Date()).getTime() / 1000), rid, bucket: opaqueClaimStartBucket(secret, input.bucket), profileId: input.profileId.toLowerCase() });
  return { body, signature: hmac(secret, `${CLAIM_START_PREFLIGHT_DOMAIN}:${body}`), rid };
}

const REASON = /^[a-z_]{1,32}$/;

/** Strict: anything not exactly the documented shape is unavailable (fail closed). */
export function parseClaimStartPreflightResponse(httpStatus: number, json: unknown): DurablePreflightDecision {
  const o = json && typeof json === "object" ? (json as Record<string, unknown>) : null;
  if (!o || typeof o.allowed !== "boolean" || typeof o.reason !== "string" || !REASON.test(o.reason)) return { status: "unavailable", reason: "bad_shape" };
  if (httpStatus === 200 && o.allowed === true && o.reason === "ok") return { status: "allowed" };
  if (httpStatus === 429 && o.allowed === false) {
    const retry = typeof o.retryAfterSeconds === "number" && Number.isFinite(o.retryAfterSeconds) && o.retryAfterSeconds >= 0 ? Math.min(3600, Math.floor(o.retryAfterSeconds)) : 900;
    return { status: "limited", reason: o.reason, retryAfterSeconds: retry };
  }
  return { status: "unavailable", reason: `http_${httpStatus}` };
}

export async function durableClaimStartPreflight(
  deps: { fetcher: typeof fetch; askOrigin: string; secret: string; timeoutMs?: number; now?: () => Date },
  input: { bucket: string; profileId: string }
): Promise<DurablePreflightDecision> {
  let req: { body: string; signature: string };
  try { req = buildClaimStartPreflightRequest(deps.secret, { bucket: input.bucket, profileId: input.profileId, now: deps.now?.() }); } catch { return { status: "unavailable", reason: "misconfigured" }; }
  try {
    const res = await deps.fetcher(new URL(CLAIM_START_PREFLIGHT_PATH, deps.askOrigin).toString(), {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", "x-ath-preflight-signature": req.signature },
      body: req.body,
      cache: "no-store",
      signal: AbortSignal.timeout(deps.timeoutMs ?? CLAIM_START_PREFLIGHT_TIMEOUT_MS),
    });
    let json: unknown = null;
    try { json = await res.json(); } catch { json = null; }
    return parseClaimStartPreflightResponse(res.status, json);
  } catch {
    return { status: "unavailable", reason: "network" };
  }
}
