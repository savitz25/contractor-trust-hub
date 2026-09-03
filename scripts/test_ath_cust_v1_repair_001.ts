import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ATH_HANDOFF_TTL_SECONDS, mintAthHandoffToken } from "../lib/claim/handoff-contract.ts";

const profile = {
  id: "0001ac38-0c96-4e2f-8bf6-9ab243f7b79b",
  slug: "ccc1332036-infinite-construction-services-llc",
  externalKey: "CCC1332036",
  displayName: "Infinite Construction Services LLC",
};
const secret = "contractor-v2-repair-test-secret-is-long-enough";

test("new Contractor handoffs are complete exact v2 payloads", () => {
  const now = new Date("2026-09-02T12:00:00Z");
  const { payload, token } = mintAthHandoffToken(secret, profile, { now, nonce: "secure-test-nonce" });
  assert.deepEqual(payload, {
    v: 2, aud: "asktrusthub", hub_id: "contractor", native_profile_id: profile.id,
    slug: profile.slug, external_key: profile.externalKey, source_system: "fl_dbpr", home_state: "FL",
    identifier_namespace: "credential", entity_class: "contractor",
    canonical_profile_url: `https://www.contractortrusthub.com/contractors/${profile.slug}`,
    display_name: profile.displayName, iat: 1788350400, exp: 1788350400 + ATH_HANDOFF_TTL_SECONDS,
    nonce: "secure-test-nonce",
  });
  assert.equal(payload.exp - payload.iat, 900);
  assert.equal(token.split(".").length, 2);
});

test("new mints use independent secure nonces", () => {
  assert.notEqual(mintAthHandoffToken(secret, profile).payload.nonce, mintAthHandoffToken(secret, profile).payload.nonce);
});

test("success redirect and every failure are non-cacheable and non-indexable", () => {
  const route = readFileSync("app/api/claim/handoff/[profileId]/route.ts", "utf8");
  assert.match(route, /new Response\(null, \{ status: 302, headers: \{ \.\.\.NO_STORE, Location:/);
  assert.match(route, /Cache-Control[^\n]+no-store/);
  assert.match(route, /X-Robots-Tag[^\n]+noindex, nofollow/);
  assert.doesNotMatch(route, /Response\.redirect\(/);
});

test("one rollout decision gates CTA, Layer C, and replies", () => {
  const page = readFileSync("app/contractors/[slug]/page.tsx", "utf8");
  assert.match(page, /const customerRolloutEnabled = Boolean\(claimProfile && claimCtaEnabledFor/);
  assert.match(page, /const showClaimCta = customerRolloutEnabled/);
  assert.match(page, /\[businessProfile, businessReplies\] = customerRolloutEnabled && claimProfile/);
  assert.match(page, /getPublicBusinessProfile\(claimProfile\.id\)/);
  assert.match(page, /getPublicBusinessReplies\(claimProfile\.id\)/);
});

test("handoff failures provide bounded safe recovery without leaking internals", () => {
  const route = readFileSync("app/api/claim/handoff/[profileId]/route.ts", "utf8");
  assert.match(route, /Find your profile/);
  assert.match(route, /Verify a credential/);
  assert.match(route, /Request help/);
  assert.doesNotMatch(route, /stack|sql|ATH_HANDOFF_SECRET.*json/i);
});

test("repair contains no DB writes, ranking, publication, or token-in-HTML path", () => {
  const files = ["lib/claim/handoff-contract.ts", "lib/claim/server.ts", "app/api/claim/handoff/[profileId]/route.ts", "app/contractors/[slug]/page.tsx"];
  const source = files.map((file) => readFileSync(file, "utf8")).join("\n");
  assert.doesNotMatch(source, /\b(?:INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|UPSERT|trust_score|rank_score)\b/i);
  const cta = readFileSync("components/contractor/ManageProfileCta.tsx", "utf8");
  assert.doesNotMatch(cta, /handoff=|ATH_HANDOFF_SECRET/);
});
