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
 * review (see the Ask repo's `docs/claim-v2/ATH-CLAIM-V2-001-ABUSE-MODEL.md` — savitz25/Conumers-Trust-Hub,
 * not this repo; there is no `docs/claim-v2/` here). The gate FAILS CLOSED if the store errors.
 *
 * ATH-CLAIM-V2-001R3 — client-IP source hardening (see clientIp() below). This does not make the gate
 * durable/fleet-wide; it only fixes which header the per-isolate gate trusts. CANARY_ABUSE_GATE stays
 * CONDITIONAL, ALL_ABUSE_GATE stays BLOCKED.
 */
import { isIP } from 'node:net';
import type { ClaimState } from './eligibility';

export type ClaimStartProfile = { id: string; slug: string; externalKey: string; displayName: string; homeState: ClaimState; sourceSystem: string };

/**
 * ATH-CLAIM-V2-001R4 — structured rate-limit key. The previous string key (`ip-profile:${ip}:${uuid}`) had to be
 * re-parsed, and splitting it at the first colon collapsed every IPv6 client into one shared state (C-B2). A
 * structured key has nothing to parse. `bucket` is `abuseBucket(clientIp(headers))`.
 */
export type RateLimitKey =
  | { kind: 'agg'; bucket: string }
  | { kind: 'hourly'; bucket: string }
  | { kind: 'profile'; bucket: string; profileId: string };

export type RateLimitStore = {
  /** Records a hit and returns the number of hits for `key` inside the trailing window, including this one. */
  hit(key: RateLimitKey, windowMs: number, now: number): Promise<number>;
};

/**
 * ATH-CLAIM-V2-001R4 — abuse bucket for an address (rate limiting only; never identity).
 *  - IPv4: the full address (unchanged behaviour).
 *  - IPv4-mapped / IPv4-compatible IPv6 (::ffff:a.b.c.d): the embedded IPv4, so one client can't get two buckets.
 *  - Other IPv6: the /64 prefix, written canonically as `xxxx:xxxx:xxxx:xxxx::/64`. A subscriber or device is
 *    normally delegated a whole /64 (RFC 6177; mobile carriers assign one per device), so per-address buckets are
 *    free to rotate around; /64 is the smallest unit an attacker does not control for free. Trade-off, same as
 *    IPv4 NAT today: unrelated users behind one shared /64 share a bucket.
 *  - Anything not a valid IP (including the 'unknown' fallback) maps to 'unknown'.
 */
export function abuseBucket(ip: string): string {
  const version = isIP(ip);
  if (version === 4) return ip;
  if (version !== 6) return 'unknown';
  const hextets = expandIPv6(ip);
  if (!hextets) return 'unknown';
  const isMapped = hextets.slice(0, 5).every((h) => h === 0) && (hextets[5] === 0xffff || hextets[5] === 0);
  if (isMapped && (hextets[6] !== 0 || hextets[7] > 1)) {
    return [hextets[6] >> 8, hextets[6] & 0xff, hextets[7] >> 8, hextets[7] & 0xff].join('.');
  }
  return `${hextets.slice(0, 4).map((h) => h.toString(16)).join(':')}::/64`;
}

/** Expands a validated IPv6 literal (incl. `::` compression and an embedded IPv4 tail) to 8 numeric hextets. */
function expandIPv6(ip: string): number[] | null {
  let text = ip.toLowerCase().split('%')[0];
  const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (v4) {
    const o = v4[1].split('.').map(Number);
    text = text.slice(0, -v4[1].length) + `${((o[0] << 8) | o[1]).toString(16)}:${((o[2] << 8) | o[3]).toString(16)}`;
  }
  const [head, tail] = text.includes('::') ? text.split('::') : [text, null];
  const left = head ? head.split(':') : [];
  const right = tail !== null && tail ? tail.split(':') : [];
  const fill = tail !== null ? 8 - left.length - right.length : 0;
  const parts = [...left, ...Array(Math.max(0, fill)).fill('0'), ...right];
  if (parts.length !== 8) return null;
  const nums = parts.map((h) => parseInt(h, 16));
  return nums.every((n) => Number.isInteger(n) && n >= 0 && n <= 0xffff) ? nums : null;
}

/**
 * ATH-CLAIM-V2-001R2 (Q3) — per-IP state, not a flat key map.
 *
 * The prior design kept `ip:`, `ip-hour:`, and `ip-profile:*` counters as unrelated entries in one flat
 * global-oldest-eviction map. An attacker could flood with thousands of distinct (UUID-shaped) profile ids
 * from a single IP; each one inserted a new `ip-profile:` key, and once the map's global size bound was
 * exceeded, the OLDEST key was evicted — which could be that same attacker's own `ip:`/`ip-hour:` aggregate
 * counter, resetting the very protection meant to bound them. Profile-key churn could evict IP-aggregate
 * protection.
 *
 * Fix: each IP gets one retained `IpState` with three independent slots — `agg` (15m), `hourly` (1h), and a
 * `profiles` map bounded to `maxProfilesPerIp` distinct, recently-active profile ids. Growing the profile map
 * never touches `agg`/`hourly`, so an aggregate counter can only be reset by that IP itself falling out of the
 * (separately, generously bounded) global IP LRU — never by its own profile-key churn. Once an IP's profile
 * cardinality bound is exceeded, a HITHERTO-UNSEEN profile key fails closed (counts as effectively over any
 * policy max) rather than resetting or displacing anything.
 */
type IpRateState = { agg: number[]; hourly: number[]; profiles: Map<string, number[]> };

/** Generous horizon for reclaiming a per-IP profile slot that has had no hits in a long time — independent of
 * any single call's `windowMs`, so a legitimate high-volume shared IP does not get permanently capped by
 * profiles it touched once, long ago. Comfortably above the largest real window used here (1h). */
const PROFILE_SLOT_STALE_MS = 24 * 60 * 60 * 1000;

/** Legacy string keys (kept only for callers outside this module; the route passes structured keys). */
function parseRateLimitKey(key: string): RateLimitKey | null {
  if (key.startsWith('ip-profile:')) {
    // The profile id is a fixed-shape UUID suffix (no colons), so it is peeled off the END; whatever precedes it
    // is the bucket, colons and all (IPv6).
    const m = /^ip-profile:(.+):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(key);
    return m ? { kind: 'profile', bucket: m[1], profileId: m[2] } : null;
  }
  if (key.startsWith('ip-hour:')) return { kind: 'hourly', bucket: key.slice('ip-hour:'.length) };
  if (key.startsWith('ip:')) return { kind: 'agg', bucket: key.slice('ip:'.length) };
  return null;
}

function trimAndPush(hits: number[], windowMs: number, now: number): number[] {
  const floor = now - windowMs;
  const kept = hits.filter((t) => t > floor);
  kept.push(now);
  return kept;
}

export class MemoryRateLimitStore implements RateLimitStore {
  readonly durable = false as const;
  private readonly ips = new Map<string, IpRateState>();
  constructor(private readonly maxIps = 5_000, private readonly maxProfilesPerIp = 64) {}

  /** Retains (and LRU-touches) one IP's state. Only whole IPs are ever evicted here — never a single profile
   * key reaching into and clearing another key's aggregate. */
  private ipState(ip: string, now: number): IpRateState {
    let state = this.ips.get(ip);
    if (state) this.ips.delete(ip); // re-insert below to mark most-recently-used
    else state = { agg: [], hourly: [], profiles: new Map() };
    this.ips.set(ip, state);
    if (this.ips.size > this.maxIps) {
      const oldestIp = this.ips.keys().next().value;
      if (oldestIp !== undefined && oldestIp !== ip) this.ips.delete(oldestIp);
    }
    // Reclaim profile slots this IP hasn't touched in a long time, independent of maxProfilesPerIp pressure.
    for (const [profileId, hits] of state.profiles) {
      const last = hits[hits.length - 1];
      if (last === undefined || now - last > PROFILE_SLOT_STALE_MS) state.profiles.delete(profileId);
    }
    return state;
  }

  async hit(key: RateLimitKey | string, windowMs: number, now: number): Promise<number> {
    const parsed = typeof key === 'string' ? parseRateLimitKey(key) : key;
    if (!parsed || !parsed.bucket) throw new Error('MemoryRateLimitStore: unrecognized key shape');
    const state = this.ipState(parsed.bucket, now);
    if (parsed.kind === 'agg') { state.agg = trimAndPush(state.agg, windowMs, now); return state.agg.length; }
    if (parsed.kind === 'hourly') { state.hourly = trimAndPush(state.hourly, windowMs, now); return state.hourly.length; }
    const profileId = parsed.profileId.toLowerCase();
    const existing = state.profiles.get(profileId);
    if (!existing && state.profiles.size >= this.maxProfilesPerIp) {
      // Cardinality bound exceeded: fail this (new) profile key closed. agg/hourly are untouched, so the
      // IP-level aggregate protections keep counting this IP's flood correctly regardless.
      return Number.MAX_SAFE_INTEGER;
    }
    const next = trimAndPush(existing ?? [], windowMs, now);
    state.profiles.set(profileId, next);
    return next.length;
  }

  size(): number { return this.ips.size; }
}

export type ClaimStartPolicy = {
  perIp: { max: number; windowMs: number };
  perIpProfile: { max: number; windowMs: number };
  perIpHourly: { max: number; windowMs: number };
  retryAfterSeconds: number;
};

/** Starting policy (Section 3E). Tune only with evidence. */
export const CLAIM_START_POLICY: Readonly<ClaimStartPolicy> = {
  perIp: { max: 5, windowMs: 15 * 60 * 1000 },
  perIpProfile: { max: 3, windowMs: 15 * 60 * 1000 },
  perIpHourly: { max: 20, windowMs: 60 * 60 * 1000 },
  retryAfterSeconds: 900,
};

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

/** Bounded before any parsing: a header this long is never a legitimate address list, and we must not spend
 * unbounded work (split/regex/validate) on attacker-controlled header content. */
const MAX_FORWARDED_HEADER_LENGTH = 512;
/** Longest textual IPv6 representation (with an embedded IPv4 tail) is 45 characters. */
const MAX_IP_TEXT_LENGTH = 45;

/** Strips an optional bracketed-IPv6-with-port wrapper ("[::1]:8080" -> "::1"); otherwise returns the trimmed,
 * length-bounded input unchanged. Pure normalization — validity is checked separately by isIP(). */
function normalizeAddressCandidate(value: string): string {
  const trimmed = value.trim();
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(trimmed);
  return (bracketed ? bracketed[1] : trimmed).slice(0, MAX_IP_TEXT_LENGTH);
}

/** The first entry of a (possibly chained) forwarding header, validated as IPv4 or IPv6. Anything else —
 * empty, oversized, malformed, a hostname, garbage — returns null so the caller can apply a safe fallback
 * instead of propagating an unvalidated string into a rate-limit key. */
function firstValidAddress(headerValue: string): string | null {
  if (!headerValue) return null;
  const bounded = headerValue.slice(0, MAX_FORWARDED_HEADER_LENGTH);
  const first = bounded.split(",", 1)[0];
  if (!first) return null;
  const candidate = normalizeAddressCandidate(first);
  return candidate.length > 0 && isIP(candidate) !== 0 ? candidate : null;
}

/**
 * ATH-CLAIM-V2-001R3 — client IP for the abuse-rate-limit bucket key ONLY. This is never an identity or
 * authentication claim; it exists solely to key MemoryRateLimitStore.
 *
 * `x-vercel-forwarded-for` is set by Vercel's own edge network and cannot be supplied or overwritten by the
 * client or by an arbitrary upstream `x-forwarded-for` — Vercel's routing layer sets it from the real
 * connecting peer. Documented Vercel behavior already strips a client-supplied `x-forwarded-for` in
 * Production, but that is a hosting-platform assumption, not something this code can verify at runtime, and a
 * Trusted Proxy / future proxy topology could change it. So: whenever `x-vercel-forwarded-for` is present at
 * all, it is authoritative and `x-forwarded-for` is never consulted, even if the Vercel header turns out to be
 * malformed — falling through to `x-forwarded-for` in that case would hand control right back to a client that
 * can freely set it. A malformed-but-present Vercel header degrades to the shared 'unknown' bucket, not to a
 * client-controlled value.
 *
 * When `x-vercel-forwarded-for` is absent entirely (local dev, tests, or any non-Vercel deployment), behavior
 * falls back to the conventional `x-forwarded-for` / `x-real-ip` headers exactly as before this change.
 */
export function clientIp(headers: Headers): string {
  const vercelForwardedFor = headers.get("x-vercel-forwarded-for");
  if (vercelForwardedFor !== null) {
    return firstValidAddress(vercelForwardedFor) ?? "unknown";
  }
  const forwardedFor = headers.get("x-forwarded-for");
  const fromForwardedFor = forwardedFor !== null ? firstValidAddress(forwardedFor) : null;
  if (fromForwardedFor) return fromForwardedFor;
  const realIp = headers.get("x-real-ip");
  const fromRealIp = realIp !== null ? firstValidAddress(realIp) : null;
  return fromRealIp ?? "unknown";
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
  /** Mode / canary gate (pre-DB). */
  enabled(profileId: string): boolean;
  /** ATH-CLAIM-V2-FLNJ-001: rollout state allow-list, checked against the loaded profile's claim state. */
  stateEnabled(homeState: string): boolean;
  loadProfile(profileId: string): Promise<ClaimStartProfile | null>;
  mint(profile: ClaimStartProfile): { token: string };
  store: RateLimitStore;
  now(): number;
  askOrigin: string;
  allowedOrigins?: readonly string[];
  log(event: string, fields?: Record<string, unknown>): void;
  policy?: Readonly<ClaimStartPolicy>;
};

export type ClaimStartOutcome = "minted" | "cross_origin" | "invalid_profile" | "rate_limited" | "unavailable" | "ineligible" | "store_failure" | "mint_failure";

export async function handleClaimStart(request: Request, profileId: string, deps: ClaimStartDeps): Promise<Response> {
  const policy = deps.policy ?? CLAIM_START_POLICY;
  const log = (outcome: ClaimStartOutcome, fields: Record<string, unknown> = {}) => deps.log(outcome === "minted" ? "claim_handoff_minted" : "claim_start_rejected", { hub: "contractor", outcome, ...fields });

  const origin = checkSameOrigin(request.headers, request.url, deps.allowedOrigins ?? []);
  if (!origin.ok) { log("cross_origin", { reason: origin.reason }); return safeFailure("This request did not come from a ContractorTrustHub profile page.", 403); }
  if (!UUID.test(profileId)) { log("invalid_profile"); return safeFailure("This profile is not eligible for management.", 404); }

  const bucket = abuseBucket(clientIp(request.headers));
  const now = deps.now();
  let counts: [number, number, number];
  try {
    counts = [
      await deps.store.hit({ kind: 'agg', bucket }, policy.perIp.windowMs, now),
      await deps.store.hit({ kind: 'profile', bucket, profileId: profileId.toLowerCase() }, policy.perIpProfile.windowMs, now),
      await deps.store.hit({ kind: 'hourly', bucket }, policy.perIpHourly.windowMs, now),
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
  if (!deps.stateEnabled(profile.homeState)) { log("unavailable", { state: profile.homeState }); return safeFailure("Profile management is unavailable for this profile.", 404); }

  // ATH-CLAIM-V2-001R2 (Q2): the public route never reads a source from the request. Every browser-initiated
  // mint carries `acquisition_source: "organic"` signed inside the token itself (see handoff-contract.ts /
  // deps.mint); Ask authenticates it there and never trusts a query string. This is not a place to add a
  // source override — a trusted server-side caller of deps.mint's underlying function does that directly.
  let token: string;
  try { token = deps.mint(profile).token; } catch { log("mint_failure"); return safeFailure("Profile management is temporarily unavailable.", 503); }
  log("minted", { state: profile.homeState, source_system: profile.sourceSystem, acquisition_source: "organic" });
  deps.log("claim_cta_activated", { hub: "contractor", profile_class: "contractor", state: profile.homeState, acquisition_source: "organic" });
  const target = new URL("/claim/continue", deps.askOrigin);
  target.searchParams.set("handoff", token);
  return new Response(null, { status: 303, headers: { ...NO_STORE_HEADERS, Location: target.toString() } });
}
