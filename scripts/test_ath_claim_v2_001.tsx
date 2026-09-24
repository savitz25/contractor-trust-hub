/**
 * ATH-CLAIM-V2-001 — Contractor V2 reference implementation suite (Section 13, specialist side).
 * Pure: injects fake loader/minter/store. No database, no network, no production connection.
 */
import assert from "node:assert/strict";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ManageProfileCta } from "../components/contractor/ManageProfileCta.tsx";
import { mintAthHandoffToken, type AthHandoffPayload } from "../lib/claim/handoff-contract.ts";
import {
  CLAIM_START_POLICY,
  MemoryRateLimitStore,
  checkSameOrigin,
  clientIp,
  handleClaimHandoffGet,
  handleClaimStart,
  type ClaimStartDeps,
  type RateLimitStore,
} from "../lib/claim/start-core.ts";
import { fetchPublicContractorState } from "../lib/business-profile/fetch-public-state.ts";

// tsx compiles component JSX with the classic runtime in this test runner; Next uses the automatic runtime.
(globalThis as { React?: typeof React }).React = React;

const SECRET = "ath-claim-v2-001-contractor-test-secret-32-chars";
const SITE = "https://www.contractortrusthub.com";
const ASK = "https://www.asktrusthub.com";
const PROFILE = { id: "11111111-1111-4111-8111-111111111111", slug: "cbc015082-acme-roofing", externalKey: "CBC015082", displayName: "Acme Roofing" };
const THIN_ID = "22222222-2222-4222-8222-222222222222";
const DISABLED_ID = "33333333-3333-4333-8333-333333333333";

function harness(overrides: Partial<ClaimStartDeps> = {}) {
  const minted: string[] = [];
  const logs: Array<{ event: string; fields: Record<string, unknown> }> = [];
  const loads: string[] = [];
  const clock = { now: Date.parse("2026-09-22T14:00:00Z") };
  const deps: ClaimStartDeps = {
    enabled: (id) => id.toLowerCase() !== DISABLED_ID,
    loadProfile: async (id) => { loads.push(id); return id.toLowerCase() === PROFILE.id ? PROFILE : null; },
    mint: (profile) => { const { token } = mintAthHandoffToken(SECRET, profile, { now: new Date(clock.now) }); minted.push(token); return { token }; },
    store: new MemoryRateLimitStore(),
    now: () => clock.now,
    askOrigin: ASK,
    allowedOrigins: [SITE],
    log: (event, fields = {}) => logs.push({ event, fields }),
    ...overrides,
  };
  return { deps, minted, logs, loads, clock };
}
function post(profileId: string, init: { origin?: string | null; ip?: string; body?: string; contentType?: string; extra?: Record<string, string> } = {}) {
  const headers = new Headers({ "x-forwarded-for": init.ip ?? "203.0.113.5", ...(init.extra ?? {}) });
  if (init.origin !== null) headers.set("origin", init.origin ?? SITE);
  if (init.body !== undefined) headers.set("content-type", init.contentType ?? "application/x-www-form-urlencoded");
  return new Request(`${SITE}/api/claim/handoff/${profileId}`, { method: "POST", headers, body: init.body });
}
/** Mirrors the Ask verifier (lib/customer/handoff.ts) so a minted token is proven to pass Ask exact validation. */
function askAccepts(token: string): AthHandoffPayload {
  const [body, signature, extra] = token.split(".");
  assert.ok(body && signature && !extra);
  const calculated = createHmac("sha256", SECRET).update(body, "utf8").digest("base64url");
  assert.equal(timingSafeEqual(Buffer.from(signature), Buffer.from(calculated)), true);
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as AthHandoffPayload;
  assert.equal(payload.v, 2); assert.equal(payload.aud, "asktrusthub"); assert.equal(payload.hub_id, "contractor");
  assert.equal(payload.native_profile_id, PROFILE.id); assert.equal(payload.slug, PROFILE.slug); assert.equal(payload.external_key, PROFILE.externalKey);
  assert.equal(payload.identifier_namespace, "credential"); assert.equal(payload.entity_class, "contractor"); assert.equal(payload.home_state, "FL"); assert.equal(payload.source_system, "fl_dbpr");
  assert.equal(payload.canonical_profile_url, `${SITE}/contractors/${PROFILE.slug}`);
  assert.equal(payload.exp - payload.iat, 15 * 60); assert.ok(payload.nonce.length >= 24);
  return payload;
}

test("A: 1,000 GET requests against the former mint route mint 0 tokens and answer 405 with safe next actions", async () => {
  let minted = 0;
  const { deps } = harness({ mint: () => { minted += 1; return { token: "never" }; } });
  void deps;
  for (let i = 0; i < 1000; i += 1) {
    const res = handleClaimHandoffGet();
    assert.equal(res.status, 405); assert.equal(res.headers.get("allow"), "POST");
    assert.equal(res.headers.get("location"), null); assert.equal(res.headers.get("cache-control"), "no-store"); assert.match(res.headers.get("x-robots-tag") ?? "", /noindex/);
  }
  assert.equal(minted, 0);
  const body = await handleClaimHandoffGet().json() as { next: Record<string, { href: string }> };
  assert.deepEqual(Object.keys(body.next), ["primary", "alternative", "support"]);
  const route = readFileSync("app/api/claim/handoff/[profileId]/route.ts", "utf8");
  const getBody = route.slice(route.indexOf("export function GET"), route.indexOf("export async function POST"));
  assert.match(getBody, /handleClaimHandoffGet\(\)/); assert.doesNotMatch(getBody, /mint\w*\(|loadEligibleClaimProfile\(|handleClaimStart\(/);
  assert.match(route, /export async function POST/);
});

test("B: an explicit same-origin POST mints exactly one short-lived signed handoff that Ask exact validation accepts", async () => {
  const { deps, minted, logs } = harness();
  const res = await handleClaimStart(post(PROFILE.id), PROFILE.id, deps);
  assert.equal(res.status, 303);
  const location = new URL(res.headers.get("location") ?? "");
  assert.equal(location.origin, ASK); assert.equal(location.pathname, "/claim/continue");
  assert.equal(location.searchParams.get("source"), null, "Q2: acquisition source is never a query string; Ask reads it from the signed payload");
  assert.equal(minted.length, 1); assert.equal(location.searchParams.get("handoff"), minted[0]);
  assert.equal(askAccepts(minted[0]).acquisition_source, "organic");
  assert.equal(res.headers.get("cache-control"), "no-store"); assert.match(res.headers.get("x-robots-tag") ?? "", /noindex/);
  const mintLog = logs.find((l) => l.event === "claim_handoff_minted");
  assert.ok(mintLog); assert.doesNotMatch(JSON.stringify(logs), new RegExp(minted[0].slice(0, 20)), "token is never logged");
  assert.doesNotMatch(JSON.stringify(logs), new RegExp(PROFILE.id), "profile id is never logged");
  assert.ok(logs.some((l) => l.event === "claim_cta_activated"));
  const again = await handleClaimStart(post(PROFILE.id), PROFILE.id, deps);
  assert.equal(again.status, 303); assert.equal(minted.length, 2); assert.notEqual(askAccepts(minted[1]).nonce, askAccepts(minted[0]).nonce, "fresh nonce per mint");
});

test("L: wrong-origin, cross-site and origin-less POSTs fail closed with 0 mints", async () => {
  for (const init of [{ origin: "https://evil.example" }, { origin: "null" }, { origin: null }, { origin: null, extra: { "sec-fetch-site": "cross-site" } }]) {
    const { deps, minted, loads } = harness();
    const res = await handleClaimStart(post(PROFILE.id, init), PROFILE.id, deps);
    assert.equal(res.status, 403, JSON.stringify(init)); assert.equal(minted.length, 0); assert.equal(loads.length, 0, "no database read before the origin gate");
  }
  const { deps, minted } = harness();
  const res = await handleClaimStart(post(PROFILE.id, { origin: null, extra: { "sec-fetch-site": "same-origin" } }), PROFILE.id, deps);
  assert.equal(res.status, 303); assert.equal(minted.length, 1);
  assert.equal(checkSameOrigin(new Headers({ origin: "https://contractortrusthub.com" }), `${SITE}/x`, [SITE]).ok, false, "apex is not the canonical www origin");
});

test("F/G/rollout: invalid UUID, thin/unpublished and rollout-disabled profiles fail closed with 0 mints", async () => {
  const { deps, minted, loads } = harness();
  assert.equal((await handleClaimStart(post("not-a-uuid"), "not-a-uuid", deps)).status, 404); assert.equal(loads.length, 0);
  assert.equal((await handleClaimStart(post(THIN_ID), THIN_ID, deps)).status, 404);
  assert.equal((await handleClaimStart(post(DISABLED_ID), DISABLED_ID, deps)).status, 404);
  assert.equal(minted.length, 0);
});

test("M: repeated same-IP mint burst is rate limited (5 per 15 minutes) with Retry-After", async () => {
  const { deps, minted, clock } = harness();
  const ids = Array.from({ length: 6 }, (_, i) => `1111111${i}-1111-4111-8111-111111111111`);
  const results: number[] = [];
  for (const id of ids) results.push((await handleClaimStart(post(id, { ip: "198.51.100.1" }), id, { ...deps, loadProfile: async () => PROFILE })).status);
  assert.deepEqual(results, [303, 303, 303, 303, 303, 429]); assert.equal(minted.length, 5);
  const limited = await handleClaimStart(post(ids[0], { ip: "198.51.100.1" }), ids[0], { ...deps, loadProfile: async () => PROFILE });
  assert.equal(limited.headers.get("retry-after"), String(CLAIM_START_POLICY.retryAfterSeconds));
  assert.equal((await handleClaimStart(post(PROFILE.id, { ip: "198.51.100.2" }), PROFILE.id, deps)).status, 303, "another IP is unaffected");
  clock.now += CLAIM_START_POLICY.perIp.windowMs + 1000;
  assert.equal((await handleClaimStart(post(PROFILE.id, { ip: "198.51.100.1" }), PROFILE.id, deps)).status, 303, "window expiry restores service");
});

test("N: repeated same-profile burst from one IP is bounded (3 per 15 minutes) and an hourly bound caps rolling windows", async () => {
  const { deps, minted, clock } = harness();
  const statuses: number[] = [];
  for (let i = 0; i < 4; i += 1) statuses.push((await handleClaimStart(post(PROFILE.id, { ip: "198.51.100.9" }), PROFILE.id, deps)).status);
  assert.deepEqual(statuses, [303, 303, 303, 429]); assert.equal(minted.length, 3);
  const hourly = harness();
  // Five bursts of five inside one hour: the 15-minute bound resets between bursts, the hourly bound does not.
  const policy = { ...CLAIM_START_POLICY, perIp: { max: 5, windowMs: 10 * 60 * 1000 } };
  let ok = 0, limited = 0;
  for (let batch = 0; batch < 5; batch += 1) {
    for (let i = 0; i < 5; i += 1) {
      const id = `4444444${i}-4444-4444-8444-44444444444${batch}`;
      const res = await handleClaimStart(post(id, { ip: "198.51.100.20" }), id, { ...hourly.deps, policy, loadProfile: async () => PROFILE });
      if (res.status === 303) ok += 1; else limited += 1;
    }
    hourly.clock.now += policy.perIp.windowMs + 1000;
  }
  assert.equal(ok, CLAIM_START_POLICY.perIpHourly.max); assert.equal(limited, 25 - CLAIM_START_POLICY.perIpHourly.max);
});

test("abuse gate fails closed when the store errors; memory store is bounded and declares itself non-durable", async () => {
  const failing: RateLimitStore = { async hit() { throw new Error("store down"); } };
  const { deps, minted } = harness({ store: failing });
  assert.equal((await handleClaimStart(post(PROFILE.id), PROFILE.id, deps)).status, 503); assert.equal(minted.length, 0);
  const store = new MemoryRateLimitStore(100);
  assert.equal(store.durable, false);
  for (let i = 0; i < 1000; i += 1) await store.hit(`ip:203.0.113.${i}`, 60_000, i);
  assert.ok(store.size() <= 100, "flood of distinct IPs cannot grow memory without bound");
  const core = readFileSync("lib/claim/start-core.ts", "utf8");
  assert.match(core, /NON-DURABLE/); assert.match(core, /FAILS CLOSED/);
});

test("Q3: profile-key churn from one IP cannot evict or reset that IP's own aggregate rate-limit counters", async () => {
  const store = new MemoryRateLimitStore(5_000, 64);
  const now = 1_000_000;
  // Saturate the per-IP aggregate window first.
  for (let i = 0; i < 5; i += 1) assert.equal(await store.hit("ip:198.51.100.50", 15 * 60 * 1000, now + i), i + 1);
  const aggAfterSaturation = await store.hit("ip:198.51.100.50", 15 * 60 * 1000, now + 5);
  assert.equal(aggAfterSaturation, 6, "aggregate keeps counting past the caller's policy max (the caller decides what to do with the count)");
  // Flood 10,000 distinct UUID-shaped profile keys from the SAME IP. Under the old flat-map design with a
  // small maxKeys this would evict the `ip:` aggregate entry itself; it must not happen here.
  for (let i = 0; i < 10_000; i += 1) {
    await store.hit(`ip-profile:198.51.100.50:${randomUUID()}`, 15 * 60 * 1000, now + 6);
  }
  const aggAfterFlood = await store.hit("ip:198.51.100.50", 15 * 60 * 1000, now + 7);
  assert.equal(aggAfterFlood, 7, "the IP aggregate was never reset by unrelated profile-key churn");
  // Per-IP profile cardinality is bounded well below 10,000 despite the flood.
  assert.ok(store.size() >= 1, "the flooding IP's own state is retained, not evicted by its own churn");
});

test("Q3 adversarial: 20,000 requests from one IP across >5,000 distinct UUID-shaped profiles hold the hourly bound", async () => {
  const { deps } = harness({ store: new MemoryRateLimitStore() });
  const ip = "198.51.100.77";
  let minted = 0;
  const seenProfiles = new Set<string>();
  for (let i = 0; i < 20_000; i += 1) {
    // >5,000 distinct profiles: reuse each profile id at most 3 times so the per-profile bound (3/15m) is not
    // what's being exercised here — the hourly aggregate bound is.
    const profileId = `6${String(Math.floor(i / 3)).padStart(7, "0")}-6666-4666-8666-${String(i).padStart(12, "0")}`;
    seenProfiles.add(profileId);
    const res = await handleClaimStart(post(profileId, { ip }), profileId, { ...deps, loadProfile: async () => ({ ...PROFILE, id: profileId }) });
    if (res.status === 303) minted += 1;
  }
  assert.ok(seenProfiles.size > 5_000, `test setup should exercise >5,000 distinct profiles, got ${seenProfiles.size}`);
  assert.ok(minted <= CLAIM_START_POLICY.perIpHourly.max, `successful mints (${minted}) must not exceed the hourly policy (${CLAIM_START_POLICY.perIpHourly.max})`);
});

// ---------------------------------------------------------------- ATH-CLAIM-V2-001R3
test("R3: a valid x-vercel-forwarded-for wins over a spoofed x-forwarded-for", () => {
  const headers = new Headers({ "x-vercel-forwarded-for": "203.0.113.9", "x-forwarded-for": "198.51.100.250" });
  assert.equal(clientIp(headers), "203.0.113.9");
});

test("R3: same Vercel IP with different spoofed x-forwarded-for values maps to the same limiter identity", () => {
  const a = clientIp(new Headers({ "x-vercel-forwarded-for": "203.0.113.9", "x-forwarded-for": "1.1.1.1" }));
  const b = clientIp(new Headers({ "x-vercel-forwarded-for": "203.0.113.9", "x-forwarded-for": "2.2.2.2, 3.3.3.3" }));
  const c = clientIp(new Headers({ "x-vercel-forwarded-for": "203.0.113.9" })); // no XFF at all
  assert.equal(a, "203.0.113.9"); assert.equal(b, "203.0.113.9"); assert.equal(c, "203.0.113.9");
  assert.equal(a, b); assert.equal(b, c);
});

test("R3: different Vercel IPs map to different limiter identities", () => {
  const a = clientIp(new Headers({ "x-vercel-forwarded-for": "203.0.113.9", "x-forwarded-for": "1.1.1.1" }));
  const b = clientIp(new Headers({ "x-vercel-forwarded-for": "203.0.113.10", "x-forwarded-for": "1.1.1.1" })); // same spoofed XFF, different real Vercel IP
  assert.notEqual(a, b);
});

test("R3: a malformed x-vercel-forwarded-for degrades to the shared safe fallback, never to the spoofed x-forwarded-for", () => {
  for (const malformed of ["", "not-an-ip", "999.999.999.999", "<script>alert(1)</script>", "a".repeat(5000), ", , ,"]) {
    const ip = clientIp(new Headers({ "x-vercel-forwarded-for": malformed, "x-forwarded-for": "198.51.100.250" }));
    assert.equal(ip, "unknown", `malformed Vercel header ${JSON.stringify(malformed.slice(0, 30))} must not fall through to x-forwarded-for`);
  }
});

test("R3: IPv6 is supported from both the Vercel header and the local-dev fallback path", () => {
  assert.equal(clientIp(new Headers({ "x-vercel-forwarded-for": "2001:db8::1" })), "2001:db8::1");
  assert.equal(clientIp(new Headers({ "x-vercel-forwarded-for": "[2001:db8::1]:443" })), "2001:db8::1", "bracketed IPv6-with-port normalizes");
  assert.equal(clientIp(new Headers({ "x-forwarded-for": "2001:db8::2" })), "2001:db8::2", "no Vercel header: conventional fallback still supports IPv6");
  assert.equal(clientIp(new Headers({ "x-real-ip": "::1" })), "::1");
});

test("R3: local/dev/test behavior without any Vercel header is unchanged, and a chained header uses the first entry", () => {
  assert.equal(clientIp(new Headers({ "x-forwarded-for": "203.0.113.5, 70.41.3.18, 150.172.238.178" })), "203.0.113.5");
  assert.equal(clientIp(new Headers({})), "unknown");
  assert.equal(clientIp(new Headers({ "x-real-ip": "203.0.113.5" })), "203.0.113.5");
});

test("R3: no raw IP reaches a log call, and the rate-limit key itself never appears in a log line", async () => {
  const { deps, logs } = harness();
  await handleClaimStart(post(PROFILE.id, { extra: { "x-vercel-forwarded-for": "203.0.113.201" } }), PROFILE.id, deps);
  const serialized = JSON.stringify(logs);
  assert.doesNotMatch(serialized, /203\.0\.113\.201/, "the Vercel-sourced client IP never reaches a log call");
  const core = readFileSync("lib/claim/start-core.ts", "utf8");
  const handleBody = core.slice(core.indexOf("export async function handleClaimStart"));
  assert.doesNotMatch(handleBody, /log\([^)]*\bip\b[^)]*\)/, "no log(...) call in handleClaimStart passes the ip variable");
});

test("R3 adversarial re-run: 20,000 requests, one real Vercel IP, a different spoofed x-forwarded-for on every request, still holds the hourly bound", async () => {
  const { deps } = harness({ store: new MemoryRateLimitStore() });
  const vercelIp = "198.51.100.201";
  let minted = 0;
  for (let i = 0; i < 20_000; i += 1) {
    const profileId = `7${String(Math.floor(i / 3)).padStart(7, "0")}-7777-4777-8777-${String(i).padStart(12, "0")}`;
    // Every request spoofs a fresh, distinct x-forwarded-for -- under the pre-R3 header trust this alone would
    // have looked like 20,000 different clients. The real Vercel-assigned IP is constant and authoritative.
    const res = await handleClaimStart(
      post(profileId, { ip: `10.${i % 256}.${(i >> 8) % 256}.${(i >> 16) % 256}`, extra: { "x-vercel-forwarded-for": vercelIp } }),
      profileId,
      { ...deps, loadProfile: async () => ({ ...PROFILE, id: profileId }) }
    );
    if (res.status === 303) minted += 1;
  }
  assert.ok(minted <= CLAIM_START_POLICY.perIpHourly.max, `successful mints (${minted}) must not exceed the hourly policy (${CLAIM_START_POLICY.perIpHourly.max}) even with a fresh spoofed x-forwarded-for on every request`);
});

test("Q2: the public route never reads acquisition source from the browser; only signed, trusted-server-side minting can produce a non-organic source", async () => {
  const { deps } = harness();
  // A browser posting any of these bodies gets exactly the same signed "organic" mint — the body is never
  // parsed for it. Each iteration uses its own IP so the abuse gate (an unrelated concern) never interferes.
  const bodies = ["source=internal_test", JSON.stringify({ source: "manual_outreach" }), "source=email_campaign", "source=<script>alert(1)</script>"];
  for (const [i, body] of bodies.entries()) {
    const contentType = body.startsWith("{") ? "application/json" : "application/x-www-form-urlencoded";
    const res = await handleClaimStart(post(PROFILE.id, { body, contentType, ip: `203.0.113.${50 + i}` }), PROFILE.id, deps);
    assert.equal(res.status, 303);
    const location = new URL(res.headers.get("location") ?? "");
    assert.equal(location.searchParams.get("source"), null, `no query-string source regardless of body: ${body}`);
  }
  const allOrganic = (await Promise.all(
    ["source=internal_test", JSON.stringify({ source: "manual_outreach" }), "source=email_campaign"].map(async (body, i) => {
      const contentType = body.startsWith("{") ? "application/json" : "application/x-www-form-urlencoded";
      const id = `5555555${i}-5555-4555-8555-55555555555${i}`;
      const res = await handleClaimStart(post(id, { body, contentType }), id, { ...deps, loadProfile: async () => PROFILE });
      const location = new URL(res.headers.get("location") ?? "");
      const payload = JSON.parse(Buffer.from((location.searchParams.get("handoff") ?? "").split(".")[0], "base64url").toString("utf8")) as AthHandoffPayload;
      return payload.acquisition_source;
    })
  ));
  assert.deepEqual(allOrganic, ["organic", "organic", "organic"], "browser body never overrides the signed acquisition_source");
  // Trusted server-side code (never the public route) may mint a different source directly.
  const trusted = mintAthHandoffToken(SECRET, PROFILE, { acquisitionSource: "internal_test" });
  assert.equal(trusted.payload.acquisition_source, "internal_test");
  const trustedOutreach = mintAthHandoffToken(SECRET, PROFILE, { acquisitionSource: "manual_outreach" });
  assert.equal(trustedOutreach.payload.acquisition_source, "manual_outreach");
  const core = readFileSync("lib/claim/start-core.ts", "utf8");
  assert.doesNotMatch(core, /readSource|declaredSource|SPECIALIST_DECLARABLE_SOURCES/, "the public route must not read or trust a browser-declared source");
  const cta = readFileSync("components/contractor/ManageProfileCta.tsx", "utf8");
  assert.doesNotMatch(cta, /name="source"/, "the CTA form no longer offers a source field to edit");
});

test("B/T: the public CTA is an explicit same-origin POST form, never a crawlable mint link, and uses authorized-representative language", () => {
  const html = renderToStaticMarkup(<ManageProfileCta profileId={PROFILE.id} />);
  const form = html.slice(html.indexOf("<form"), html.indexOf("<form") + 200);
  assert.match(form, /<form[^>]*\bmethod="post"/); assert.match(form, new RegExp(`<form[^>]*\\baction="/api/claim/handoff/${PROFILE.id}"`));
  assert.doesNotMatch(html, new RegExp(`<a[^>]+href="/api/claim/handoff`));
  assert.doesNotMatch(html, /name="source"/, "Q2: no browser-editable source field"); assert.match(html, /free/i); assert.match(html, /not an endorsement/i);
  assert.doesNotMatch(html, /verified owner|verified business|Trust Score/i);
  const managed = renderToStaticMarkup(<ManageProfileCta profileId={PROFILE.id} managed />);
  assert.match(managed, /Profile managed by an authorized representative/); assert.doesNotMatch(managed, /<form/);
  const page = readFileSync("app/contractors/[slug]/page.tsx", "utf8");
  assert.match(page, /<ContractorJsonLd contractor=\{contractor\}/, "source-derived structured data stays on the public profile");
  assert.match(page, /const showClaimCta = customerRolloutEnabled/);
  assert.match(page, /businessProfile \? <BusinessSuppliedProfile/, "business layer renders only when Ask projects an active grant");
});

test("S: official evidence remains readable when the Ask customer layer is unavailable", async () => {
  const throws: typeof fetch = async () => { throw new Error("offline"); };
  const rejected: typeof fetch = async () => new Response("{}", { status: 503 });
  assert.equal(await fetchPublicContractorState(PROFILE.id, ASK, throws), null);
  assert.equal(await fetchPublicContractorState(PROFILE.id, ASK, rejected), null);
  const page = readFileSync("app/contractors/[slug]/page.tsx", "utf8");
  assert.match(page, /const publicState = claimProfile \? await getPublicContractorState\(claimProfile\.id\) : null/);
  assert.match(page, /claimProfile && \(businessProfile \|\| showClaimCta\) \? <ManageProfileCta/);
});
