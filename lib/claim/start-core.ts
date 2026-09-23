/**
 * ATH-CLAIM-V2-001 — Contractor claim start (human-initiated, abuse-resistant handoff minting).
 *
 * Pure module: no "server-only", no Next.js, no database. The route wires real dependencies; tests inject
 * fakes. Contract:
 *   GET  /api/claim/handoff/[profileId]  -> 405, mints nothing, links to safe next actions.
 *   POST /api/claim/handoff/[profileId]  -> same-origin check -> bounded abuse gate -> rollout gate ->
 *                                           exact eligibility -> ONE short-lived signed handoff -> 303 to Ask.
 *
 * ABUSE GATE HONESTY: ContractorTrustHub has no durable rate-limit store (no KV/Redis/rate table; the only
 * Postgres is the DBPR evidence database). `MemoryRateLimitStore` is therefore explicitly per-isolate and
 * NON-DURABLE. It bounds a single serverless instance; it is not fleet-wide protection. The durable backstop
 * for the network is on AskTrustHub (`ath_rate_events`: handoff receipt 30/15m/IP, explicit Continue
 * 10/15m/IP), and — decisively — a minted token no longer creates any durable Ask state until a human
 * presses Continue. A durable Contractor store can be plugged in through `RateLimitStore` after Founder
 * review (see docs/claim-v2/ATH-CLAIM-V2-001-ABUSE-MODEL.md). The gate FAILS CLOSED if the store errors.
 */

export type ClaimStartProfile = { id: string; slug: string; externalKey: string; displayName: string };

export type RateLimitStore = {
  /** Records a hit and returns the number of hits for `key` inside the trailing window, including this one. */
  hit(key: string, windowMs: number, now: number): Promise<number>;
};

export class MemoryRateLimitStore implements RateLimitStore {
  readonly durable = false as const;
  private readonly buckets = new Map<string, number[]>();
  constructor(private readonly maxKeys = 5_000) {}
  async hit(key: string, windowMs: number, now: number): Promise<number> {
    const floor = now - windowMs;
    const hits = (this.buckets.get(key) ?? []).filter((t) => t > floor);
    hits.push(now);
    this.buckets.set(key, hits);
    if (this.buckets.size > this.maxKeys) {
      // Bounded memory: evict the oldest-inserted key. A flood cannot grow the map without limit.
      const oldest = this.buckets.keys().next().value;
      if (oldest !== undefined) this.buckets.delete(oldest);
    }
    return hits.length;
  }
  size(): number { return this.buckets.size; }
}

/** Starting policy (Section 3E). Tune only with evidence. */
export const CLAIM_START_POLICY = {
  perIp: { max: 5, windowMs: 15 * 60 * 1000 },
  perIpProfile: { max: 3, windowMs: 15 * 60 * 1000 },
  perIpHourly: { max: 20, windowMs: 60 * 60 * 1000 },
  retryAfterSeconds: 900,
} as const;

export const SPECIALIST_DECLARABLE_SOURCES = ["organic", "manual_outreach", "internal_test"] as const;
export type SpecialistDeclaredSource = (typeof SPECIALIST_DECLARABLE_SOURCES)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const NO_STORE_HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } as const;

export type OriginCheck = { ok: true } | { ok: false; reason: "missing_origin" | "cross_origin" | "cross_site_fetch" };
export function checkSameOrigin(headers: Headers, requestUrl: string, allowedOrigins: readonly string[] = []): OriginCheck {
  const allowed = new Set([safeOrigin(requestUrl), ...allowedOrigins.map(safeOrigin)].filter(Boolean));
  const origin = headers.get("origin");
  const fetchSite = headers.get("sec-fetch-site");
  if (origin) return allowed.has(safeOrigin(origin)) ? { ok: true } : { ok: false, reason: "cross_origin" };
  if (fetchSite) return fetchSite === "same-origin" ? { ok: true } : { ok: false, reason: "cross_site_fetch" };
  return { ok: false, reason: "missing_origin" };
}
function safeOrigin(value: string): string { try { return new URL(value).origin; } catch { return ""; } }

export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || "unknown";
}

export function declaredSource(value: unknown): SpecialistDeclaredSource {
  return typeof value === "string" && (SPECIALIST_DECLARABLE_SOURCES as readonly string[]).includes(value) ? (value as SpecialistDeclaredSource) : "organic";
}

async function readSource(request: Request): Promise<SpecialistDeclaredSource> {
  const type = request.headers.get("content-type") || "";
  try {
    if (type.includes("application/json")) { const body = (await request.json()) as { source?: unknown }; return declaredSource(body?.source); }
    if (type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data")) { const form = await request.formData(); return declaredSource(form.get("source")); }
  } catch { /* malformed body is not an error: default to organic */ }
  return "organic";
}

export function safeFailure(message: string, status: 403 | 404 | 405 | 429 | 503, extraHeaders: Record<string, string> = {}): Response {
  return Response.json({
    error: message,
    next: {
      primary: { label: "Find your profile", href: "/search" },
      alternative: { label: "Verify a credential", href: "/verify" },
      support: { label: "Request help", href: "/contact" },
    },
  }, { status, headers: { ...NO_STORE_HEADERS, ...extraHeaders } });
}

/** V2 rule: a GET never mints. The former mint URL answers 405 and points at harmless next actions. */
export function handleClaimHandoffGet(): Response {
  return safeFailure("Profile management starts from the profile page. This link does not start a claim.", 405, { Allow: "POST" });
}

export type ClaimStartDeps = {
  enabled(profileId: string): boolean;
  loadProfile(profileId: string): Promise<ClaimStartProfile | null>;
  mint(profile: ClaimStartProfile): { token: string };
  store: RateLimitStore;
  now(): number;
  askOrigin: string;
  allowedOrigins?: readonly string[];
  log(event: string, fields?: Record<string, unknown>): void;
  policy?: typeof CLAIM_START_POLICY;
};

export type ClaimStartOutcome = "minted" | "cross_origin" | "invalid_profile" | "rate_limited" | "unavailable" | "ineligible" | "store_failure" | "mint_failure";

export async function handleClaimStart(request: Request, profileId: string, deps: ClaimStartDeps): Promise<Response> {
  const policy = deps.policy ?? CLAIM_START_POLICY;
  const log = (outcome: ClaimStartOutcome, fields: Record<string, unknown> = {}) => deps.log(outcome === "minted" ? "claim_handoff_minted" : "claim_start_rejected", { hub: "contractor", outcome, ...fields });

  const origin = checkSameOrigin(request.headers, request.url, deps.allowedOrigins ?? []);
  if (!origin.ok) { log("cross_origin", { reason: origin.reason }); return safeFailure("This request did not come from a ContractorTrustHub profile page.", 403); }
  if (!UUID.test(profileId)) { log("invalid_profile"); return safeFailure("This profile is not eligible for management.", 404); }

  const ip = clientIp(request.headers);
  const now = deps.now();
  let counts: [number, number, number];
  try {
    counts = [
      await deps.store.hit(`ip:${ip}`, policy.perIp.windowMs, now),
      await deps.store.hit(`ip-profile:${ip}:${profileId.toLowerCase()}`, policy.perIpProfile.windowMs, now),
      await deps.store.hit(`ip-hour:${ip}`, policy.perIpHourly.windowMs, now),
    ];
  } catch {
    log("store_failure");
    return safeFailure("Profile management is temporarily unavailable.", 503);
  }
  const limited = counts[0] > policy.perIp.max ? "per_ip" : counts[1] > policy.perIpProfile.max ? "per_ip_profile" : counts[2] > policy.perIpHourly.max ? "per_ip_hourly" : null;
  if (limited) { log("rate_limited", { bound: limited }); return safeFailure("Too many claim attempts. Please wait a few minutes and try again from the profile page.", 429, { "Retry-After": String(policy.retryAfterSeconds) }); }

  if (!deps.enabled(profileId)) { log("unavailable"); return safeFailure("Profile management is unavailable for this profile.", 404); }
  let profile: ClaimStartProfile | null;
  try { profile = await deps.loadProfile(profileId); } catch { log("unavailable"); return safeFailure("Profile management is temporarily unavailable.", 503); }
  if (!profile) { log("ineligible"); return safeFailure("This profile is not eligible for management.", 404); }

  const source = await readSource(request);
  let token: string;
  try { token = deps.mint(profile).token; } catch { log("mint_failure"); return safeFailure("Profile management is temporarily unavailable.", 503); }
  log("minted", { state: "FL", source_system: "fl_dbpr", acquisition_source: source });
  deps.log("claim_cta_activated", { hub: "contractor", profile_class: "contractor", state: "FL", acquisition_source: source });
  const target = new URL("/claim/continue", deps.askOrigin);
  target.searchParams.set("handoff", token);
  target.searchParams.set("source", source);
  return new Response(null, { status: 303, headers: { ...NO_STORE_HEADERS, Location: target.toString() } });
}
