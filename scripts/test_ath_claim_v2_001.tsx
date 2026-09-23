/**
 * ATH-CLAIM-V2-001 — Contractor V2 reference implementation suite (Section 13, specialist side).
 * Pure: injects fake loader/minter/store. No database, no network, no production connection.
 */
import assert from "node:assert/strict";
import { createHmac, timingSafeEqual } from "node:crypto";
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
  declaredSource,
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
  const res = await handleClaimStart(post(PROFILE.id, { body: "source=organic" }), PROFILE.id, deps);
  assert.equal(res.status, 303);
  const location = new URL(res.headers.get("location") ?? "");
  assert.equal(location.origin, ASK); assert.equal(location.pathname, "/claim/continue"); assert.equal(location.searchParams.get("source"), "organic");
  assert.equal(minted.length, 1); assert.equal(location.searchParams.get("handoff"), minted[0]);
  askAccepts(minted[0]);
  assert.equal(res.headers.get("cache-control"), "no-store"); assert.match(res.headers.get("x-robots-tag") ?? "", /noindex/);
  const mintLog = logs.find((l) => l.event === "claim_handoff_minted");
  assert.ok(mintLog); assert.doesNotMatch(JSON.stringify(logs), new RegExp(minted[0].slice(0, 20)), "token is never logged");
  assert.doesNotMatch(JSON.stringify(logs), new RegExp(PROFILE.id), "profile id is never logged");
  assert.ok(logs.some((l) => l.event === "claim_cta_activated"));
  const again = await handleClaimStart(post(PROFILE.id, { body: "source=organic" }), PROFILE.id, deps);
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
  for (let i = 0; i < 1000; i += 1) await store.hit(`flood:${i}`, 60_000, i);
  assert.ok(store.size() <= 100, "flood cannot grow memory without bound");
  const core = readFileSync("lib/claim/start-core.ts", "utf8");
  assert.match(core, /NON-DURABLE/); assert.match(core, /FAILS CLOSED/);
});

test("Section 6: specialists may declare organic / manual_outreach / internal_test only; email_campaign is never self-declared", async () => {
  assert.equal(declaredSource("internal_test"), "internal_test"); assert.equal(declaredSource("manual_outreach"), "manual_outreach");
  assert.equal(declaredSource("email_campaign"), "organic"); assert.equal(declaredSource("<script>"), "organic"); assert.equal(declaredSource(undefined), "organic");
  const { deps } = harness();
  const form = await handleClaimStart(post(PROFILE.id, { body: "source=internal_test" }), PROFILE.id, deps);
  assert.equal(new URL(form.headers.get("location") ?? "").searchParams.get("source"), "internal_test");
  const json = await handleClaimStart(post(PROFILE.id, { body: JSON.stringify({ source: "manual_outreach" }), contentType: "application/json" }), PROFILE.id, deps);
  assert.equal(new URL(json.headers.get("location") ?? "").searchParams.get("source"), "manual_outreach");
  const bogus = await handleClaimStart(post(PROFILE.id, { body: "source=email_campaign" }), PROFILE.id, deps);
  assert.equal(new URL(bogus.headers.get("location") ?? "").searchParams.get("source"), "organic");
});

test("B/T: the public CTA is an explicit same-origin POST form, never a crawlable mint link, and uses authorized-representative language", () => {
  const html = renderToStaticMarkup(<ManageProfileCta profileId={PROFILE.id} />);
  const form = html.slice(html.indexOf("<form"), html.indexOf("<form") + 200);
  assert.match(form, /<form[^>]*\bmethod="post"/); assert.match(form, new RegExp(`<form[^>]*\\baction="/api/claim/handoff/${PROFILE.id}"`));
  assert.doesNotMatch(html, new RegExp(`<a[^>]+href="/api/claim/handoff`));
  assert.match(html, /name="source" value="organic"/); assert.match(html, /free/i); assert.match(html, /not an endorsement/i);
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
