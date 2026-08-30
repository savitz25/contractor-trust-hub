import assert from "node:assert/strict";
import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { eligibleClaimProfile } from "../lib/claim/eligibility.ts";
import {
  ATH_HANDOFF_AUDIENCE,
  ATH_HANDOFF_TTL_SECONDS,
  mintAthHandoffToken,
  type AthHandoffPayload,
} from "../lib/claim/handoff-contract.ts";
import type { ContractorDetail } from "../lib/contractors/types.ts";

const SECRET = "ath-cust-003-compatible-test-secret-32-chars";
const PROFILE = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "cbc015082-acme-roofing",
  externalKey: "CBC015082",
};

function contractor(overrides: Partial<ContractorDetail> = {}): ContractorDetail {
  return {
    id: PROFILE.id,
    slug: PROFILE.slug,
    displayName: "Acme Roofing",
    legalName: null,
    dbaName: null,
    primaryCity: "Tampa",
    primaryCounty: "Hillsborough",
    homeState: "FL",
    isThinProfile: false,
    licenses: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        externalKey: PROFILE.externalKey,
        occupationCode: "CBC",
        licenseNumber: "015082",
        statusNormalized: "active",
        primaryStatus: "Current",
        secondaryStatus: null,
        originalLicensureDate: null,
        effectiveDate: null,
        expirationDate: null,
        addressLine1: null,
        city: "Tampa",
        state: "FL",
        postalCode: null,
        countyName: null,
        boardNumber: null,
        lastVerifiedAt: null,
        sourceSystem: "fl_dbpr",
      },
    ],
    entities: [],
    discipline: [],
    ...overrides,
  };
}

// Mirrors the production Ask verifier contract and adapter checks audited at origin/main.
function askAccepts(token: string, expected = PROFILE, now = new Date("2026-01-01T00:05:00Z")) {
  const [body, signature, extra] = token.split(".");
  assert.ok(body && signature && !extra);
  const calculated = createHmac("sha256", SECRET).update(body, "utf8").digest("base64url");
  assert.equal(timingSafeEqual(Buffer.from(signature), Buffer.from(calculated)), true);
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as AthHandoffPayload;
  assert.equal(payload.v, 1);
  assert.equal(payload.aud, "asktrusthub");
  assert.equal(payload.hub_id, "contractor");
  assert.equal(payload.home_state, "FL");
  assert.equal(payload.source_system, "fl_dbpr");
  assert.ok(payload.exp >= Math.floor(now.getTime() / 1000));
  assert.equal(payload.native_profile_id, expected.id);
  assert.equal(payload.slug, expected.slug);
  assert.equal(payload.external_key, expected.externalKey);
  return payload;
}

test("FL non-thin fl_dbpr profile is eligible", () => assert.deepEqual(eligibleClaimProfile(contractor()), PROFILE));
test("thin profile is ineligible", () => assert.equal(eligibleClaimProfile(contractor({ isThinProfile: true })), null));
test("non-FL profile is ineligible", () => {
  const c = contractor({ homeState: "NJ" });
  c.licenses[0].state = "NJ";
  assert.equal(eligibleClaimProfile(c), null);
});
test("unsupported source is ineligible", () => {
  const c = contractor();
  c.licenses[0].sourceSystem = "nj_dca";
  assert.equal(eligibleClaimProfile(c), null);
});
test("missing external key is ineligible", () => {
  const c = contractor();
  c.licenses[0].externalKey = "";
  assert.equal(eligibleClaimProfile(c), null);
});

test("eligible profile mints a production-compatible Ask token", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const { token, payload } = mintAthHandoffToken(SECRET, PROFILE, { now, nonce: "fresh-nonce" });
  assert.equal(payload.aud, ATH_HANDOFF_AUDIENCE);
  assert.equal(payload.exp - payload.iat, ATH_HANDOFF_TTL_SECONDS);
  assert.equal(payload.nonce, "fresh-nonce");
  assert.deepEqual(askAccepts(token), payload);
  assert.equal(token.includes("@"), false);
});

test("minting creates a fresh nonce", () => {
  const a = mintAthHandoffToken(SECRET, PROFILE).payload.nonce;
  const b = mintAthHandoffToken(SECRET, PROFILE).payload.nonce;
  assert.notEqual(a, b);
});

test("Ask contract rejects UUID, slug, and credential swaps", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  for (const changed of [
    { ...PROFILE, id: "33333333-3333-4333-8333-333333333333" },
    { ...PROFILE, slug: "swapped" },
    { ...PROFILE, externalKey: "CGC999999" },
  ]) {
    const { token } = mintAthHandoffToken(SECRET, changed, { now });
    assert.throws(() => askAccepts(token));
  }
});

test("expired token is rejected by Ask contract", () => {
  const { token } = mintAthHandoffToken(SECRET, PROFILE, { now: new Date("2020-01-01T00:00:00Z") });
  assert.throws(() => askAccepts(token));
});

test("secret and token remain server-side and claim route is non-indexable", () => {
  const component = readFileSync("components/contractor/ManageProfileCta.tsx", "utf8");
  const route = readFileSync("app/api/claim/handoff/[profileId]/route.ts", "utf8");
  const server = readFileSync("lib/claim/server.ts", "utf8");
  assert.doesNotMatch(component, /ATH_HANDOFF_SECRET|handoff=|externalKey/);
  assert.doesNotMatch(server, /NEXT_PUBLIC_ATH_HANDOFF_SECRET/);
  assert.doesNotMatch(route, /console\.(?:info|log).*token/);
  assert.match(route, /X-Robots-Tag.*noindex, nofollow/);
});

test("claim code has no Layer A mutation or ranking/publication dependency", () => {
  const server = readFileSync("lib/claim/server.ts", "utf8");
  const route = readFileSync("app/api/claim/handoff/[profileId]/route.ts", "utf8");
  assert.doesNotMatch(`${server}\n${route}`, /\b(?:INSERT|UPDATE|DELETE|UPSERT|publication_state|rank_score|trust_score)\b/i);
  assert.match(server, /WHERE c\.id = \$1::uuid/);
  assert.match(server, /c\.is_thin_profile = FALSE/);
});
