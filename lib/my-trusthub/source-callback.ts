/**
 * Signed source callback (My TrustHub -> Contractor), the shared shape used by
 * Lender: POST /api/my-trusthub/profile-save/source with an Ask service
 * assertion (contractor-assertion.ts, service "ask").
 *
 *   { action: "resolve", profile }                      scope source:read
 *       fresh publication proof for one exact identity
 *   { action: "source", continuationRef, transferRef,   scope source:read
 *     manifest, manifestDigest, expiresAt }
 *       the manifest is rebuilt from Contractor's own publication read and must
 *       equal what was staged; nothing posted is trusted as identity
 *   { action: "acknowledge", continuationRef, receipts } scope source:ack
 *       the parent's signed statement that the hand-off completed; recorded for
 *       the browser it was staged for
 *
 * No Ask verification key configured -> 503 for everything. No CORS, no browser
 * cookie, no fallback authority.
 */
import { verifyContractorAssertion, type AssertionKey, type NonceStore } from "./contractor-assertion";
import type { AckOutcome, AckStore } from "./ack-store";
import { CONTRACTOR_ORIGIN, CONTRACTOR_PROFILE_CLASS, SOURCE_PATH, contractorManifest, manifestDigest, parseContractorNativeId, type ContractorManifest } from "./manifest";
import { resolveByProfile, resolveBySlug, type ProfileReader } from "./publication";

const headers = { "Cache-Control": "private, no-store, max-age=0", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow, noarchive" };
const reply = (body: unknown, status: number) => Response.json(body, { status, headers });
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));
const opaque = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{43}$/.test(v);
const ACK_OUTCOMES: readonly string[] = ["saved", "already_saved", "local_only"];

export type ContractorPublication = {
  identity: { hub: "contractor"; nativeId: string; profileClass: typeof CONTRACTOR_PROFILE_CLASS };
  canonicalSlug: string;
  publicationState: "PUBLISHABLE";
  reviewedClass: typeof CONTRACTOR_PROFILE_CLASS;
  checkedAt: number;
};

/** Publication proof for one exact identity from Contractor's own read. A
 * posted slug, name or UUID is never consulted. */
export async function contractorPublication(reader: ProfileReader, profile: unknown, now = Date.now()): Promise<ContractorPublication | null> {
  const identity = await resolveByProfile(reader, profile);
  if (!identity) return null;
  const manifest = contractorManifest(identity);
  return { identity: manifest.returnTask.profile, canonicalSlug: identity.canonicalSlug, publicationState: "PUBLISHABLE", reviewedClass: CONTRACTOR_PROFILE_CLASS, checkedAt: now };
}

export type SourceOptions = {
  reader: ProfileReader;
  /** Ask's verification key. Null -> unavailable. */
  key: AssertionKey | null;
  nonces: NonceStore;
  acks: AckStore | null;
  now?: () => number;
  /** Contractor origin this deployment answers on. Production pin by default. */
  origin?: string;
};

export async function handleContractorSource(request: Request, options: SourceOptions): Promise<Response> {
  if (!options.key) return reply({ ok: false, error: "unavailable" }, 503);
  const url = new URL(request.url);
  if (request.method !== "POST") return reply({ ok: false, error: "invalid" }, 405);
  if (url.origin !== (options.origin ?? CONTRACTOR_ORIGIN) || url.pathname !== SOURCE_PATH || url.search) return reply({ ok: false, error: "invalid" }, 400);
  if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json") return reply({ ok: false, error: "invalid" }, 400);
  const bytes = Buffer.from(await request.arrayBuffer());
  if (bytes.length > 131072) return reply({ ok: false, error: "invalid" }, 413);
  let body: unknown;
  try { body = JSON.parse(bytes.toString("utf8")); } catch { return reply({ ok: false, error: "invalid" }, 400); }
  if (!object(body) || typeof body.action !== "string") return reply({ ok: false, error: "invalid" }, 400);
  const now = options.now?.() ?? Date.now();
  const proof = new Request(request.url, { method: "POST", headers: request.headers, body: bytes });
  try {
    if (body.action === "resolve" && exact(body, ["action", "profile"]) && object(body.profile) && exact(body.profile, ["hub", "nativeId", "profileClass"])) {
      await verifyContractorAssertion(proof, bytes, options.key, "ask", "source:read", options.nonces, now);
      const result = await contractorPublication(options.reader, body.profile, now);
      return result ? reply({ ok: true, result }, 200) : reply({ ok: false, error: "unavailable" }, 503);
    }
    if (body.action === "source" && exact(body, ["action", "continuationRef", "transferRef", "manifest", "manifestDigest", "expiresAt"])) {
      const claims = await verifyContractorAssertion(proof, bytes, options.key, "ask", "source:read", options.nonces, now);
      if (!opaque(body.continuationRef) || !opaque(body.transferRef) || typeof body.manifestDigest !== "string") return reply({ ok: false, error: "unauthorized" }, 403);
      if (typeof body.expiresAt !== "number" || body.expiresAt <= now || body.expiresAt > now + 600_000) return reply({ ok: false, error: "unauthorized" }, 403);
      const posted = body.manifest;
      if (!object(posted) || !object(posted.returnTask) || typeof posted.returnTask.canonicalSlug !== "string") return reply({ ok: false, error: "unauthorized" }, 403);
      // Rebuild from the publication read for the posted slug; the posted manifest must be byte-for-digest identical.
      const resolved = await resolveBySlug(options.reader, posted.returnTask.canonicalSlug);
      if (!resolved.eligible) return reply({ ok: false, error: "unauthorized" }, 403);
      const rebuilt = contractorManifest(resolved.identity);
      let same = false;
      try { same = manifestDigest(posted as ContractorManifest) === manifestDigest(rebuilt); } catch { same = false; }
      if (!same || manifestDigest(rebuilt) !== body.manifestDigest) return reply({ ok: false, error: "unauthorized" }, 403);
      return reply({ ok: true, result: { continuationRef: body.continuationRef, transferRef: body.transferRef, manifest: rebuilt, manifestDigest: body.manifestDigest,
        browserProof: claims.browser, expiresAt: body.expiresAt, requestPrefix: claims.browser } }, 200);
    }
    if (body.action === "acknowledge" && exact(body, ["action", "continuationRef", "receipts"]) && Array.isArray(body.receipts)) {
      const claims = await verifyContractorAssertion(proof, bytes, options.key, "ask", "source:ack", options.nonces, now);
      if (!opaque(body.continuationRef) || body.receipts.length !== 1) return reply({ ok: false, error: "unauthorized" }, 403);
      const receipt = body.receipts[0];
      if (!object(receipt) || receipt.localCopy !== "keep" || !object(receipt.parent) || !object(receipt.item)) return reply({ ok: false, error: "unauthorized" }, 403);
      const outcome = String(receipt.parent.outcome);
      if (!ACK_OUTCOMES.includes(outcome)) return reply({ ok: false, error: "unauthorized" }, 403);
      if (typeof receipt.requestKey !== "string" || !receipt.requestKey.startsWith(claims.browser + ":")) return reply({ ok: false, error: "unauthorized" }, 403);
      const item = receipt.item;
      if (!object(item.profile) || !parseContractorNativeId(item.profile.nativeId) || !(await contractorPublication(options.reader, item.profile, now))) return reply({ ok: false, error: "unauthorized" }, 403);
      // Save is never Watch: a receipt that mentions one is refused.
      if ("watch" in receipt || "watchCreated" in receipt) return reply({ ok: false, error: "unauthorized" }, 403);
      // Held for the browser the hand-off was staged for. If it cannot be held the
      // parent is told so; the device then never claims the account outcome.
      if (!options.acks) return reply({ ok: false, error: "unavailable" }, 503);
      try { await options.acks.record(body.continuationRef, claims.browser, outcome as AckOutcome, now); }
      catch { return reply({ ok: false, error: "unavailable" }, 503); }
      return reply({ ok: true, result: { watchCreated: false } }, 200);
    }
    return reply({ ok: false, error: "invalid" }, 400);
  } catch {
    return reply({ ok: false, error: "unauthorized" }, 403);
  }
}
