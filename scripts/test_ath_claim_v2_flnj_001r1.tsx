/**
 * ATH-CLAIM-V2-FLNJ-001R1 — durable shared claim-start gate (Contractor side). Pure: no database, no network.
 * A fake Ask implements the exact preflight contract (domain-separated HMAC over the raw body, narrow timestamp
 * window, strict shape) with one atomic durable counter shared by every simulated Contractor isolate.
 */
import assert from "node:assert/strict";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { mintAthHandoffToken } from "../lib/claim/handoff-contract.ts";
import { buildClaimStartPreflightRequest, CLAIM_START_BUCKET_DOMAIN, CLAIM_START_PREFLIGHT_DOMAIN, durableClaimStartPreflight, opaqueClaimStartBucket, parseClaimStartPreflightResponse, type DurablePreflightDecision } from "../lib/claim/preflight-client.ts";
import { abuseBucket, CLAIM_START_POLICY, clientIp, MemoryRateLimitStore, handleClaimStart, type ClaimStartDeps, type ClaimStartProfile } from "../lib/claim/start-core.ts";

const SECRET = "ath-claim-v2-flnj-001r1-contractor-secret-32c";
const SITE = "https://www.contractortrusthub.com";
const ASK = "https://www.asktrusthub.com";
const FL: ClaimStartProfile = { id: "11111111-1111-4111-8111-111111111111", slug: "cbc015082-acme-roofing", externalKey: "CBC015082", displayName: "Acme Roofing", homeState: "FL", sourceSystem: "fl_dbpr" };
const NJ: ClaimStartProfile = { id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaa1", slug: "nj-nj-hic-13vh00000001-example-improvements-llc", externalKey: "NJ-HIC:13VH00000001", displayName: "Example Improvements LLC", homeState: "NJ", sourceSystem: "nj_dca" };
const TX: ClaimStartProfile = { ...FL, id: "cccccccc-3333-4333-8333-cccccccccccc", homeState: "FL", sourceSystem: "fl_dbpr" }; // eligibility never yields TX; state gate proves closure

const hmac = (m: string) => createHmac("sha256", SECRET).update(m, "utf8").digest("base64url");
const eq = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Fake Ask: the durable store every isolate shares. Mirrors Ask's verify + policy exactly; atomic in JS. */
function fakeAsk(now: () => number) {
  const events: Array<{ bucket: string; key: string; at: number }> = [];
  const seen: string[] = [];
  const count = (bucket: string, key: string, windowMs: number) => events.filter((e) => e.bucket === bucket && e.key === key && e.at > now() - windowMs).length;
  const decide = (b: { bucket: string; profileId: string; rid: string }): { status: number; json: unknown } => {
    if (count("rid", b.rid, 120_000) > 0) return { status: 429, json: { allowed: false, reason: "replay", retryAfterSeconds: 900 } };
    events.push({ bucket: "rid", key: b.rid, at: now() });
    const agg = count("agg", b.bucket, 15 * 60_000), prof = count("profile", `${b.bucket}:${b.profileId}`, 15 * 60_000), hour = count("hour", b.bucket, 60 * 60_000);
    const limited = agg >= 5 ? "per_bucket" : prof >= 3 ? "per_bucket_profile" : hour >= 20 ? "per_bucket_hourly" : null;
    if (limited) return { status: 429, json: { allowed: false, reason: limited, retryAfterSeconds: 900 } };
    events.push({ bucket: "agg", key: b.bucket, at: now() }, { bucket: "profile", key: `${b.bucket}:${b.profileId}`, at: now() }, { bucket: "hour", key: b.bucket, at: now() });
    return { status: 200, json: { allowed: true, reason: "ok" } };
  };
  const fetcher: typeof fetch = async (url, init) => {
    assert.equal(String(url), `${ASK}/api/internal/claim/start-preflight`, "fixed Ask origin + path");
    const raw = String(init?.body ?? ""); seen.push(raw);
    const sig = new Headers(init?.headers).get("x-ath-preflight-signature") ?? "";
    if (!eq(sig, hmac(`${CLAIM_START_PREFLIGHT_DOMAIN}:${raw}`))) return Response.json({ allowed: false, reason: "unauthorized" }, { status: 401 });
    const b = JSON.parse(raw) as { v: number; ts: number; rid: string; bucket: string; profileId: string };
    assert.equal(b.v, 1); assert.match(b.rid, /^[A-Za-z0-9_-]{16,64}$/); assert.match(b.bucket, /^[A-Za-z0-9_-]{43}$/);
    if (Math.abs(Math.floor(now() / 1000) - b.ts) > 60) return Response.json({ allowed: false, reason: "stale" }, { status: 400 });
    const d = decide(b); return Response.json(d.json, { status: d.status });
  };
  return { fetcher, seen, events, admittedFor: (bucketDigest: string) => count("agg", bucketDigest, 15 * 60_000) };
}

function isolate(ask: ReturnType<typeof fakeAsk>, clock: { now: number }, opts: { states?: string[]; fetcher?: typeof fetch; timeoutMs?: number } = {}) {
  const minted: string[] = []; const logs: Array<{ event: string; fields: Record<string, unknown> }> = [];
  const deps: ClaimStartDeps = {
    enabled: () => true,
    stateEnabled: (s) => (opts.states ?? ["FL", "NJ"]).includes(s),
    durablePreflight: (input) => durableClaimStartPreflight({ fetcher: opts.fetcher ?? ask.fetcher, askOrigin: ASK, secret: SECRET, timeoutMs: opts.timeoutMs, now: () => new Date(clock.now) }, input),
    loadProfile: async (id) => [FL, NJ, TX].find((p) => p.id === id.toLowerCase()) ?? null,
    mint: (profile) => { const { token } = mintAthHandoffToken(SECRET, profile, { now: new Date(clock.now) }); minted.push(token); return { token }; },
    store: new MemoryRateLimitStore(), now: () => clock.now, askOrigin: ASK, allowedOrigins: [SITE], log: (event, fields = {}) => logs.push({ event, fields }),
  };
  return { deps, minted, logs };
}
const post = (id: string, ip: string, origin: string | null = SITE) => new Request(`${SITE}/api/claim/handoff/${id}`, { method: "POST", headers: { ...(origin ? { origin } : {}), "x-vercel-forwarded-for": ip } });

test("A/B/D: two isolates share ONE durable limit; a cold isolate (fresh memory store) is still blocked by Ask", async () => {
  const clock = { now: Date.parse("2026-09-24T20:00:00Z") }; const ask = fakeAsk(() => clock.now);
  const iso1 = isolate(ask, clock), iso2 = isolate(ask, clock);
  const ip = "203.0.113.9";
  // 3 mints from isolate 1 (distinct profiles so the local per-profile bound is not the limiter), 2 from isolate 2
  const ids = [FL.id, NJ.id, FL.id, NJ.id, FL.id];
  for (let i = 0; i < 3; i += 1) assert.equal((await handleClaimStart(post(ids[i], ip), ids[i], iso1.deps)).status, 303);
  for (let i = 3; i < 5; i += 1) assert.equal((await handleClaimStart(post(ids[i], ip), ids[i], iso2.deps)).status, 303);
  assert.equal(ask.admittedFor(opaqueClaimStartBucket(SECRET, ip)), 5);
  // 6th from a brand-new isolate whose memory limiter has never seen this client: durable gate blocks it
  const cold = isolate(ask, clock);
  const res = await handleClaimStart(post(NJ.id, ip), NJ.id, cold.deps);
  assert.equal(res.status, 429); assert.equal(res.headers.get("retry-after"), "900");
  assert.equal(cold.minted.length, 0);
  assert.ok(cold.logs.some((l) => l.event === "claim_start_rejected" && l.fields.bound === "durable_per_bucket"));
});

test("C/E: durable per-profile and hourly bounds are enforced across isolates", async () => {
  const clock = { now: Date.parse("2026-09-24T20:00:00Z") }; const ask = fakeAsk(() => clock.now);
  const ip = "198.51.100.10";
  for (let i = 0; i < 3; i += 1) assert.equal((await handleClaimStart(post(NJ.id, ip), NJ.id, isolate(ask, clock).deps)).status, 303, `profile mint ${i + 1} from a fresh isolate`);
  const fourth = isolate(ask, clock);
  assert.equal((await handleClaimStart(post(NJ.id, ip), NJ.id, fourth.deps)).status, 429);
  assert.ok(fourth.logs.some((l) => l.fields.bound === "durable_per_bucket_profile"));
  // hourly: a ROLLING 60-minute cap. Across 16-minute steps from fresh isolates the aggregate window re-opens,
  // but no 60-minute window ever admits more than 20 (and a saturated one admits exactly 20).
  for (let step = 0; step < 6; step += 1) {
    clock.now += 16 * 60_000;
    for (let i = 0; i < 5; i += 1) { const id = i % 2 ? FL.id : NJ.id; await handleClaimStart(post(id, ip), id, isolate(ask, clock).deps); }
  }
  const digest = opaqueClaimStartBucket(SECRET, ip);
  const admittedAt = ask.events.filter((e) => e.bucket === "agg" && e.key === digest).map((e) => e.at);
  const windowMax = Math.max(...admittedAt.map((t) => admittedAt.filter((u) => u > t - 60 * 60_000 && u <= t).length));
  assert.equal(windowMax, 20, `rolling-hour maximum (${windowMax})`);
  assert.ok(admittedAt.length > 20, "admissions resume once the oldest events age out of the hour");
});

test("F: a concurrent burst across isolates cannot exceed the durable aggregate; local limiter alone would have admitted more", async () => {
  const clock = { now: Date.parse("2026-09-24T21:00:00Z") }; const ask = fakeAsk(() => clock.now);
  const ip = "203.0.113.200";
  const isolates = Array.from({ length: 12 }, () => isolate(ask, clock));
  const results = await Promise.all(isolates.map((iso, i) => handleClaimStart(post(i % 2 ? FL.id : NJ.id, ip), i % 2 ? FL.id : NJ.id, iso.deps)));
  assert.equal(results.filter((r) => r.status === 303).length, 5);
  assert.equal(results.filter((r) => r.status === 429).length, 7);
  assert.equal(isolates.reduce((n, iso) => n + iso.minted.length, 0), 5);
});

test("G/H/I: Ask receives only a fixed-length keyed digest; IPv6 hosts in one /64 share it; spoofed x-forwarded-for does not change it; raw IP never appears in the request or logs", async () => {
  const clock = { now: Date.parse("2026-09-24T20:00:00Z") }; const ask = fakeAsk(() => clock.now);
  const iso = isolate(ask, clock);
  await handleClaimStart(new Request(`${SITE}/api/claim/handoff/${NJ.id}`, { method: "POST", headers: { origin: SITE, "x-vercel-forwarded-for": "2001:db8:aaaa:1::7", "x-forwarded-for": "9.9.9.9" } }), NJ.id, iso.deps);
  await handleClaimStart(new Request(`${SITE}/api/claim/handoff/${FL.id}`, { method: "POST", headers: { origin: SITE, "x-vercel-forwarded-for": "2001:db8:aaaa:1:ffff::1" } }), FL.id, iso.deps);
  const sent = ask.seen.map((raw) => JSON.parse(raw) as { bucket: string });
  assert.equal(sent.length, 2); assert.equal(sent[0].bucket, sent[1].bucket, "two hosts in one /64 share the digest");
  assert.equal(sent[0].bucket, opaqueClaimStartBucket(SECRET, "2001:db8:aaaa:1::/64"));
  assert.match(sent[0].bucket, /^[A-Za-z0-9_-]{43}$/);
  for (const raw of ask.seen) { assert.doesNotMatch(raw, /2001:db8|9\.9\.9\.9|::\/64/); }
  const logged = JSON.stringify(iso.logs); assert.doesNotMatch(logged, /2001:db8|9\.9\.9\.9|\/64/);
  assert.equal(opaqueClaimStartBucket(SECRET, "203.0.113.9"), hmac(`${CLAIM_START_BUCKET_DOMAIN}:203.0.113.9`));
  assert.notEqual(opaqueClaimStartBucket(SECRET, "203.0.113.9"), hmac("203.0.113.9"));
  assert.equal(abuseBucket(clientIp(new Headers({ "x-vercel-forwarded-for": "::ffff:203.0.113.9" }))), "203.0.113.9");
});

test("L: Ask outage, timeout, non-2xx, 401 and malformed responses all yield Contractor 503 with ZERO handoff mints and no retry", async () => {
  const clock = { now: Date.parse("2026-09-24T20:00:00Z") }; const ask = fakeAsk(() => clock.now);
  const cases: Array<[string, typeof fetch]> = [
    ["network error", async () => { throw new Error("ECONNRESET"); }],
    ["500", async () => Response.json({ allowed: true, reason: "ok" }, { status: 500 })],
    ["401 unauthorized", async () => Response.json({ allowed: false, reason: "unauthorized" }, { status: 401 })],
    ["html body", async () => new Response("<html>", { status: 200 })],
    ["wrong shape", async () => Response.json({ ok: true }, { status: 200 })],
    ["allowed:true but 429", async () => Response.json({ allowed: true, reason: "ok" }, { status: 429 })],
    ["allowed:false with 200", async () => Response.json({ allowed: false, reason: "per_bucket" }, { status: 200 })],
    ["timeout", (_u, init) => new Promise((_r, reject) => { init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))); })],
  ];
  for (const [name, fetcher] of cases) {
    let calls = 0; const counting: typeof fetch = async (u, i) => { calls += 1; return fetcher(u, i); };
    const iso = isolate(ask, clock, { fetcher: counting, timeoutMs: name === "timeout" ? 50 : undefined });
    const res = await handleClaimStart(post(NJ.id, "203.0.113.50"), NJ.id, iso.deps);
    assert.equal(res.status, 503, name); assert.equal(iso.minted.length, 0, name); assert.equal(calls, 1, `${name}: exactly one attempt, no retry`);
    assert.ok(iso.logs.some((l) => l.event === "claim_start_rejected" && l.fields.outcome === "preflight_unavailable"), name);
  }
  assert.equal(ask.events.length, 0, "nothing reached the durable store");
});

test("J/K (client side): the request is signed under the preflight domain over the exact body; the fake Ask rejects a foreign signature or stale timestamp before counting", async () => {
  const req = buildClaimStartPreflightRequest(SECRET, { bucket: "203.0.113.9", profileId: NJ.id.toUpperCase(), now: new Date("2026-09-24T20:00:00Z") });
  assert.equal(req.signature, hmac(`${CLAIM_START_PREFLIGHT_DOMAIN}:${req.body}`));
  assert.notEqual(req.signature, hmac(req.body));
  const parsed = JSON.parse(req.body) as Record<string, unknown>;
  assert.deepEqual(Object.keys(parsed).sort(), ["bucket", "profileId", "rid", "ts", "v"]);
  assert.equal(parsed.profileId, NJ.id, "lower-cased uuid"); assert.equal(parsed.v, 1);
  const clock = { now: Date.parse("2026-09-24T20:00:00Z") }; const ask = fakeAsk(() => clock.now);
  const forged: typeof fetch = (u, i) => ask.fetcher(u, { ...i, headers: { ...(i?.headers as Record<string, string>), "x-ath-preflight-signature": "A".repeat(43) } });
  assert.equal((await handleClaimStart(post(NJ.id, "203.0.113.9"), NJ.id, isolate(ask, clock, { fetcher: forged }).deps)).status, 503);
  const stale = { now: clock.now - 5 * 60_000 };
  assert.equal((await handleClaimStart(post(NJ.id, "203.0.113.9"), NJ.id, isolate(ask, stale).deps)).status, 503, "stale client clock -> Ask 400 -> fail closed");
  assert.equal(ask.events.length, 0, "no durable rows for rejected requests");
  assert.deepEqual(parseClaimStartPreflightResponse(200, { allowed: true, reason: "ok" }), { status: "allowed" });
  assert.deepEqual(parseClaimStartPreflightResponse(429, { allowed: false, reason: "per_bucket", retryAfterSeconds: 900 }), { status: "limited", reason: "per_bucket", retryAfterSeconds: 900 });
  assert.equal((parseClaimStartPreflightResponse(200, { allowed: true, reason: "ok; DROP TABLE" }) as DurablePreflightDecision).status, "unavailable");
});

test("N/O/P: valid FL and NJ still mint after a durable allow; an unsupported state never reaches the preflight; GET still 405; firewall assumptions preserved", async () => {
  const clock = { now: Date.parse("2026-09-24T20:00:00Z") }; const ask = fakeAsk(() => clock.now);
  const iso = isolate(ask, clock);
  for (const p of [FL, NJ]) {
    const res = await handleClaimStart(post(p.id, "203.0.113.60"), p.id, iso.deps);
    assert.equal(res.status, 303);
    const token = new URL(res.headers.get("location")!).searchParams.get("handoff")!;
    const payload = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString()) as { home_state: string; source_system: string; external_key: string };
    assert.equal(payload.home_state, p.homeState); assert.equal(payload.source_system, p.sourceSystem); assert.equal(payload.external_key, p.externalKey);
  }
  assert.equal(ask.seen.length, 2);
  const flOnly = isolate(ask, clock, { states: ["FL"] });
  assert.equal((await handleClaimStart(post(NJ.id, "203.0.113.61"), NJ.id, flOnly.deps)).status, 404);
  assert.equal(ask.seen.length, 2, "state gate closes before the durable preflight is even called");
  assert.equal(flOnly.minted.length, 0);
  const core = readFileSync("lib/claim/start-core.ts", "utf8");
  assert.ok(core.indexOf("deps.durablePreflight(") > core.indexOf("deps.loadProfile(") && core.indexOf("deps.durablePreflight(") < core.indexOf("deps.mint("), "order: eligibility -> durable preflight -> mint");
  assert.ok(core.indexOf("deps.store.hit(") < core.indexOf("deps.durablePreflight("), "local memory limiter stays as defense in depth before the durable call");
  assert.deepEqual(CLAIM_START_POLICY, { perIp: { max: 5, windowMs: 900000 }, perIpProfile: { max: 3, windowMs: 900000 }, perIpHourly: { max: 20, windowMs: 3600000 }, retryAfterSeconds: 900 }, "local policy unchanged (firewall 6/600s/IP assumptions hold)");
  const route = readFileSync("app/api/claim/handoff/[profileId]/route.ts", "utf8");
  assert.match(route, /askOrigin: ASK_ORIGIN, secret: process\.env\.ATH_HANDOFF_SECRET \|\| ""/);
  assert.match(route, /process\.env\.NODE_ENV === "production" \? "https:\/\/www\.asktrusthub\.com"/, "fixed Production Ask origin");
});

test("double-submit guard: the CTA form carries a synchronous DOM guard so one click cannot post twice", () => {
  const cta = readFileSync("components/contractor/ManageProfileCta.tsx", "utf8");
  assert.match(cta, /form\.dataset\.submitted === "1"\) \{ event\.preventDefault\(\); return; \}/);
  assert.match(cta, /form\.dataset\.submitted = "1";/);
  assert.ok(cta.indexOf('form.dataset.submitted = "1"') < cta.indexOf("setPending(true)"), "guard is set before any async state update");
});
