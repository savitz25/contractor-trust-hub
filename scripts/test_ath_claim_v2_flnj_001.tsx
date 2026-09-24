/**
 * ATH-CLAIM-V2-FLNJ-001 — FL + NJ claim availability (Contractor side). Pure: no database, no network.
 * FL behaviour must be unchanged; NJ is claimable only through the exact `nj_dca` credential source; every other
 * state shows no claim doorway; the signed payload carries the selected credential's real source/state.
 */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ManageProfileCta } from "../components/contractor/ManageProfileCta.tsx";
import { CLAIMABLE_CREDENTIAL_SOURCES, CLAIM_STATES, claimStateForSource, eligibleClaimProfile, isClaimableCredentialPair, type ClaimProfile } from "../lib/claim/eligibility.ts";
import { claimCtaEnabledFor, claimEnabledStates, claimModeEnabledFor, claimStateEnabled, selectClaimableCredential } from "../lib/claim/rollout.ts";
import { mintAthHandoffToken, type AthHandoffPayload } from "../lib/claim/handoff-contract.ts";
import { MemoryRateLimitStore, handleClaimHandoffGet, handleClaimStart, type ClaimStartDeps } from "../lib/claim/start-core.ts";
import type { ContractorDetail } from "../lib/contractors/types.ts";

(globalThis as { React?: typeof React }).React = React;

const SECRET = "ath-claim-v2-flnj-001-contractor-test-secret-32";
const SITE = "https://www.contractortrusthub.com";
const ASK = "https://www.asktrusthub.com";

// Shapes mirror real Contractor production rows (2026-09-24 inventory): NJ keys look like NJ-HIC:13VH07122600.
const NJ_HIC: ClaimProfile = { id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaa1", slug: "nj-nj-hic-13vh00000001-example-improvements-llc", externalKey: "NJ-HIC:13VH00000001", displayName: "Example Improvements LLC", homeState: "NJ", sourceSystem: "nj_dca" };
const NJ_ELE: ClaimProfile = { id: "aaaaaaaa-2222-4222-8222-aaaaaaaaaaa2", slug: "nj-nj-ele-34eb00000002-example-electric-llc", externalKey: "NJ-ELE:34EB00000002", displayName: "Example Electric LLC", homeState: "NJ", sourceSystem: "nj_dca" };
const FL: ClaimProfile = { id: "11111111-1111-4111-8111-111111111111", slug: "cbc015082-acme-roofing", externalKey: "CBC015082", displayName: "Acme Roofing", homeState: "FL", sourceSystem: "fl_dbpr" };

function detail(p: { id: string; slug: string; displayName: string; homeState: string | null; isThin?: boolean }, licenses: Array<{ sourceSystem: string; externalKey: string; state: string | null; occupationCode?: string }>): ContractorDetail {
  return {
    id: p.id, slug: p.slug, displayName: p.displayName, homeState: p.homeState, isThinProfile: Boolean(p.isThin),
    licenses: licenses.map((l, i) => ({ id: `lic-${i}`, sourceSystem: l.sourceSystem, externalKey: l.externalKey, state: l.state, occupationCode: l.occupationCode ?? "HIC", occupationDescription: null, licenseNumber: l.externalKey, statusNormalized: "active", primaryStatus: "Active", secondaryStatus: null, originalLicensureDate: null, effectiveDate: null, expirationDate: null, lastVerifiedAt: null, county: null, city: null, board: null })),
    entities: [], discipline: [], observations: [],
  } as unknown as ContractorDetail;
}

/** Mirrors Ask's verifier after FLNJ-001: HMAC + a v2 payload whose (source, state) pair is allow-listed. */
function askAccepts(token: string): AthHandoffPayload {
  const [body, signature, extra] = token.split(".");
  assert.ok(body && signature && !extra);
  assert.equal(signature, createHmac("sha256", SECRET).update(body, "utf8").digest("base64url"));
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as AthHandoffPayload;
  assert.equal(payload.v, 2); assert.equal(payload.aud, "asktrusthub"); assert.equal(payload.hub_id, "contractor");
  assert.equal(payload.identifier_namespace, "credential"); assert.equal(payload.entity_class, "contractor");
  assert.ok(isClaimableCredentialPair(payload.source_system, payload.home_state), `pair ${payload.source_system}/${payload.home_state}`);
  assert.equal(payload.canonical_profile_url, `${SITE}/contractors/${payload.slug}`);
  assert.ok(payload.exp - payload.iat === 15 * 60);
  return payload;
}

test("source allow-list is exactly FL:fl_dbpr and NJ:nj_dca; research-only NJ sources never map to a claim state", () => {
  assert.deepEqual(CLAIMABLE_CREDENTIAL_SOURCES, { FL: ["fl_dbpr"], NJ: ["nj_dca"] });
  assert.deepEqual([...CLAIM_STATES], ["FL", "NJ"]);
  for (const s of ["nj_sos", "nj_enforcement", "nj_dca_construction_permits", "ct_dcp", "va_dpor", "ca_cslb", "pa_ag", "oh_dcp", "tx_tdlr", "", null]) assert.equal(claimStateForSource(s), null, String(s));
  assert.equal(claimStateForSource("nj_dca"), "NJ"); assert.equal(claimStateForSource("fl_dbpr"), "FL");
  assert.equal(isClaimableCredentialPair("nj_dca", "FL"), false); assert.equal(isClaimableCredentialPair("fl_dbpr", "NJ"), false);
});

test("eligibility: NJ HIC and NJ specialty-board (ELE) profiles are claimable via nj_dca; FL unchanged and evaluated first", () => {
  assert.deepEqual(eligibleClaimProfile(detail(NJ_HIC, [{ sourceSystem: "nj_dca", externalKey: NJ_HIC.externalKey, state: "NJ", occupationCode: "HIC" }])), NJ_HIC);
  assert.deepEqual(eligibleClaimProfile(detail(NJ_ELE, [{ sourceSystem: "nj_dca", externalKey: NJ_ELE.externalKey, state: "NJ", occupationCode: "ELE" }])), NJ_ELE);
  assert.deepEqual(eligibleClaimProfile(detail(FL, [{ sourceSystem: "fl_dbpr", externalKey: "CBC015082", state: "FL" }])), FL);
  // Holds both: FL wins (pre-FLNJ behaviour preserved).
  assert.deepEqual(eligibleClaimProfile(detail({ ...FL, homeState: "FL" }, [{ sourceSystem: "nj_dca", externalKey: "NJ-HIC:13VH99999999", state: "NJ" }, { sourceSystem: "fl_dbpr", externalKey: "CBC015082", state: "FL" }])), FL);
});

test("eligibility: excluded NJ shapes and every other state yield NO claim doorway", () => {
  const njBase = { id: NJ_HIC.id, slug: NJ_HIC.slug, displayName: NJ_HIC.displayName, homeState: "NJ" };
  assert.equal(eligibleClaimProfile(detail(njBase, [{ sourceSystem: "fl_dbpr", externalKey: "CBC000001", state: "NJ" }])), null, "NJ business holding only an FL DBPR credential at an NJ address");
  assert.equal(eligibleClaimProfile(detail(njBase, [{ sourceSystem: "ct_dcp", externalKey: "HIC.0000001", state: "NJ" }])), null, "out-of-state credential");
  assert.equal(eligibleClaimProfile(detail(njBase, [{ sourceSystem: "nj_sos", externalKey: "0400000000", state: "NJ" }])), null, "entity record is not a credential");
  assert.equal(eligibleClaimProfile(detail(njBase, [{ sourceSystem: "nj_enforcement", externalKey: "CASE-1", state: "NJ" }])), null, "enforcement row is not a credential");
  assert.equal(eligibleClaimProfile(detail(njBase, [{ sourceSystem: "nj_dca", externalKey: "   ", state: "NJ" }])), null, "empty credential");
  assert.equal(eligibleClaimProfile(detail({ ...njBase, isThin: true }, [{ sourceSystem: "nj_dca", externalKey: NJ_HIC.externalKey, state: "NJ" }])), null, "thin/research-only profile");
  assert.equal(eligibleClaimProfile(detail(njBase, [])), null, "no credential rows");
  for (const [state, source, key] of [["CA", "ca_cslb", "1234567"], ["PA", "pa_ag", "PA000001"], ["OH", "oh_dcp", "OH-1"], ["TX", "tx_tdlr", "TX-1"], ["GA", "ga_sos", "GA-1"], ["MA", "ma_hic", "MA-1"], ["CT", "ct_dcp", "HIC.0000001"]]) {
    assert.equal(eligibleClaimProfile(detail({ ...njBase, homeState: state }, [{ sourceSystem: source, externalKey: key, state }])), null, state);
    assert.equal(eligibleClaimProfile(detail({ ...njBase, homeState: state }, [{ sourceSystem: "nj_dca", externalKey: "NJ-HIC:13VH00000009", state }])), null, `${state} business with an nj_dca row recorded outside NJ`);
  }
});

test("server-side credential selection (SQL path): FL rule exactly as before; NJ only when FL does not apply", () => {
  const row = (o: Partial<Parameters<typeof selectClaimableCredential>[0][number]>) => ({ id: NJ_HIC.id, slug: NJ_HIC.slug, display_name: NJ_HIC.displayName, home_state: "NJ", external_key: NJ_HIC.externalKey, source_system: "nj_dca", license_state: "NJ", ...o });
  assert.deepEqual(selectClaimableCredential([row({})]), NJ_HIC);
  // Best fl_dbpr row (ordered first) fails the FL state rule (NJ business, NJ address) -> NJ credential is used.
  assert.deepEqual(selectClaimableCredential([row({ external_key: "CBC000001", source_system: "fl_dbpr", license_state: "NJ" }), row({})]), NJ_HIC);
  // Best fl_dbpr row passes the FL rule -> FL claim, exactly the pre-FLNJ answer.
  assert.deepEqual(selectClaimableCredential([row({ id: FL.id, slug: FL.slug, display_name: FL.displayName, home_state: "FL", external_key: "CBC015082", source_system: "fl_dbpr", license_state: "FL" }), row({ id: FL.id, slug: FL.slug, display_name: FL.displayName, home_state: "FL" })]), FL);
  assert.equal(selectClaimableCredential([row({ external_key: "CBC000001", source_system: "fl_dbpr", license_state: "NJ" })]), null, "NJ business, FL credential only");
  assert.equal(selectClaimableCredential([]), null);
});

test("rollout gate: ATH_CLAIM_ENABLED_STATES is required in addition to the mode; unsupported/unset fails closed; canary keeps working", () => {
  const secret = { ATH_HANDOFF_SECRET: "x".repeat(40) };
  assert.deepEqual([...claimEnabledStates({})], []);
  assert.deepEqual([...claimEnabledStates({ ATH_CLAIM_ENABLED_STATES: "FL,NJ" })], ["FL", "NJ"]);
  assert.deepEqual([...claimEnabledStates({ ATH_CLAIM_ENABLED_STATES: " fl , nj ,CA,PA,OH" })], ["FL", "NJ"], "unknown states ignored");
  assert.equal(claimStateEnabled("NJ", { ATH_CLAIM_ENABLED_STATES: "FL" }), false);
  assert.equal(claimStateEnabled("TX", { ATH_CLAIM_ENABLED_STATES: "FL,NJ,TX" }), false, "not a claim state");
  const all = { ...secret, ATH_CLAIM_CTA_MODE: "all", ATH_CLAIM_ENABLED_STATES: "FL,NJ" };
  assert.equal(claimCtaEnabledFor(NJ_HIC.id, "NJ", all), true);
  assert.equal(claimCtaEnabledFor(FL.id, "FL", all), true);
  assert.equal(claimCtaEnabledFor(NJ_HIC.id, "NJ", { ...all, ATH_CLAIM_ENABLED_STATES: "FL" }), false, "all means all eligible profiles inside the allow-list");
  assert.equal(claimCtaEnabledFor(NJ_HIC.id, "NJ", { ...all, ATH_CLAIM_ENABLED_STATES: "" }), false, "absent allow-list enables nothing even under all");
  assert.equal(claimCtaEnabledFor(NJ_HIC.id, "NJ", { ...all, ATH_CLAIM_CTA_MODE: "off" }), false);
  const canary = { ...secret, ATH_CLAIM_CTA_MODE: "canary", ATH_CLAIM_CANARY_PROFILE_IDS: NJ_HIC.id.toUpperCase(), ATH_CLAIM_ENABLED_STATES: "FL,NJ" };
  assert.equal(claimCtaEnabledFor(NJ_HIC.id, "NJ", canary), true);
  assert.equal(claimCtaEnabledFor(FL.id, "FL", canary), false, "canary is still profile-scoped");
  assert.equal(claimCtaEnabledFor(NJ_HIC.id, "NJ", { ...canary, ATH_CLAIM_ENABLED_STATES: "FL" }), false, "canary still needs the state enabled");
  assert.equal(claimModeEnabledFor(NJ_HIC.id, { ...all, ATH_HANDOFF_SECRET: "short" }), false);
});

test("signed handoff carries the exact selected credential: source, state, key, UUID, slug; the pair is enforced at mint", () => {
  for (const p of [NJ_HIC, NJ_ELE, FL]) {
    const { token, payload } = mintAthHandoffToken(SECRET, p);
    const seen = askAccepts(token);
    assert.equal(seen.source_system, p.sourceSystem); assert.equal(seen.home_state, p.homeState);
    assert.equal(seen.external_key, p.externalKey); assert.equal(seen.native_profile_id, p.id); assert.equal(seen.slug, p.slug);
    assert.equal(seen.acquisition_source, "organic"); assert.equal(payload.nonce.length >= 32, true);
  }
  assert.throws(() => mintAthHandoffToken(SECRET, { ...NJ_HIC, homeState: "FL" }), /not claimable/);
  assert.throws(() => mintAthHandoffToken(SECRET, { ...FL, sourceSystem: "nj_dca" }), /not claimable/);
  assert.throws(() => mintAthHandoffToken(SECRET, { ...NJ_HIC, sourceSystem: "ct_dcp" }), /not claimable/);
});

function harness(states: string[], profiles: ClaimProfile[]) {
  const minted: string[] = []; const logs: Array<{ event: string; fields: Record<string, unknown> }> = [];
  const deps: ClaimStartDeps = {
    enabled: () => true,
    stateEnabled: (s) => states.includes(s),
    durablePreflight: async () => ({ status: "allowed" as const }),
    loadProfile: async (id) => profiles.find((p) => p.id === id.toLowerCase()) ?? null,
    mint: (profile) => { const { token } = mintAthHandoffToken(SECRET, profile); minted.push(token); return { token }; },
    store: new MemoryRateLimitStore(), now: () => Date.now(), askOrigin: ASK, allowedOrigins: [SITE], log: (event, fields = {}) => logs.push({ event, fields }),
  };
  return { deps, minted, logs };
}
const post = (id: string, origin: string | null = SITE) => new Request(`${SITE}/api/claim/handoff/${id}`, { method: "POST", headers: origin ? { origin, "x-forwarded-for": "203.0.113.7" } : { "x-forwarded-for": "203.0.113.7" } });

test("claim start: NJ POST mints exactly one NJ token; GET still 405; cross-origin 403; NJ outside the allow-list is 404 with 0 mints", async () => {
  const on = harness(["FL", "NJ"], [NJ_HIC, FL]);
  const res = await handleClaimStart(post(NJ_HIC.id), NJ_HIC.id, on.deps);
  assert.equal(res.status, 303);
  const location = new URL(res.headers.get("location")!);
  assert.equal(location.origin, ASK); assert.equal(location.pathname, "/claim/continue");
  assert.equal(on.minted.length, 1);
  const payload = askAccepts(location.searchParams.get("handoff")!);
  assert.equal(payload.home_state, "NJ"); assert.equal(payload.source_system, "nj_dca"); assert.equal(payload.external_key, NJ_HIC.externalKey);
  assert.ok(on.logs.some((l) => l.event === "claim_handoff_minted" && l.fields.state === "NJ" && l.fields.source_system === "nj_dca"));
  assert.equal(handleClaimHandoffGet().status, 405);
  assert.equal((await handleClaimStart(post(NJ_HIC.id, "https://evil.example"), NJ_HIC.id, on.deps)).status, 403);
  assert.equal((await handleClaimStart(post(NJ_HIC.id, null), NJ_HIC.id, on.deps)).status, 403);
  const flOnly = harness(["FL"], [NJ_HIC, FL]);
  assert.equal((await handleClaimStart(post(NJ_HIC.id), NJ_HIC.id, flOnly.deps)).status, 404, "NJ not enabled -> unavailable");
  assert.equal(flOnly.minted.length, 0);
  assert.equal((await handleClaimStart(post(FL.id), FL.id, flOnly.deps)).status, 303, "FL unaffected");
  const none = harness([], [NJ_HIC, FL]);
  assert.equal((await handleClaimStart(post(FL.id), FL.id, none.deps)).status, 404, "no allow-list -> nothing, even FL");
});

test("CTA copy is state-neutral and never hard-codes FL; the page gates on state and passes it to the CTA", () => {
  const html = renderToStaticMarkup(<ManageProfileCta profileId={NJ_HIC.id} state="NJ" sourceSystem="nj_dca" />);
  assert.match(html, /Claim or manage this profile — free/); assert.match(html, /not an endorsement/i);
  assert.doesNotMatch(html, /Florida|DBPR|\bFL\b/);
  const cta = readFileSync("components/contractor/ManageProfileCta.tsx", "utf8");
  assert.doesNotMatch(cta, /state: "FL"|source_system: "fl_dbpr"/, "no hard-coded FL analytics dimensions");
  const page = readFileSync("app/contractors/[slug]/page.tsx", "utf8");
  assert.match(page, /claimCtaEnabledFor\(claimProfile\.id, claimProfile\.homeState\)/);
  assert.match(page, /<ManageProfileCta profileId=\{claimProfile\.id\} state=\{claimProfile\.homeState\} sourceSystem=\{claimProfile\.sourceSystem\}/);
  const route = readFileSync("app/api/claim/handoff/[profileId]/route.ts", "utf8");
  assert.match(route, /stateEnabled: claimStateEnabled/); assert.match(route, /enabled: claimModeEnabledFor/);
  const server = readFileSync("lib/claim/server.ts", "utf8");
  assert.match(server, /source_system IN \('fl_dbpr', 'nj_dca'\)/, "server query is source allow-listed");
  assert.match(readFileSync("lib/claim/rollout.ts", "utf8"), /ATH_CLAIM_ENABLED_STATES/);
});
