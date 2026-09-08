import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BusinessSuppliedProfile } from "../components/contractor/BusinessSuppliedProfile.tsx";
import { parsePublicBusinessProfile } from "../lib/business-profile/public-contract.ts";
import { parsePublicBusinessReplies } from "../lib/business-replies/public-contract.ts";

const ID = "11111111-1111-4111-8111-111111111111";
const fixture = JSON.parse(readFileSync("fixtures/customer-publication/contractor-business-profile-v1.json", "utf8"));
const page = readFileSync("app/contractors/[slug]/page.tsx", "utf8");

test("canonical V1 fixture parses and renders unmistakable provenance without completeness or endorsement", () => {
  const parsed = parsePublicBusinessProfile(fixture, ID); assert.ok(parsed);
  const html = renderToStaticMarkup(<BusinessSuppliedProfile profile={parsed} officialFormationDate="2004-01-02" />);
  assert.match(html, /Profile managed by an authorized representative/);
  assert.match(html, /Information supplied by the business/);
  assert.match(html, /not a statement of license authority/);
  assert.match(html, /Official Florida entity filing date/);
  assert.doesNotMatch(html, /(?:Trust Score|Verified business|Approved contractor|\d+\/11)/i);
});

test("claim intake flag is decoupled from profile and response publication", () => {
  assert.match(page, /const showClaimCta = customerRolloutEnabled/);
  assert.match(page, /const \[businessProfile, businessReplies\] = claimProfile\s*\? await Promise\.all/);
  assert.doesNotMatch(page, /\[businessProfile, businessReplies\] = customerRolloutEnabled/);
  assert.match(page, /businessReplies\?\.replies\.length/);
});

test("profile contract rejects private, malformed, unsafe, oversized, and mismatched data", () => {
  const reject = (candidate: unknown) => assert.equal(parsePublicBusinessProfile(candidate, ID), null);
  reject({ ...fixture, contractVersion: 2 }); reject({ ...fixture, hub: "move" }); reject({ ...fixture, nativeProfileId: "22222222-2222-4222-8222-222222222222" }); reject({ ...fixture, managed: false }); reject({ ...fixture, source: "DBPR" }); reject({ ...fixture, claimantEmail: "private@example.test" });
  reject({ ...fixture, fields: { ...fixture.fields, contact_context: "private" } }); reject({ ...fixture, fields: { description: "<script>alert(1)</script>" } }); reject({ ...fixture, fields: { website: "javascript:alert(1)" } }); reject({ ...fixture, fields: { website: "https://user:secret@example.test" } }); reject({ ...fixture, fields: { public_email: "bad" } }); reject({ ...fixture, fields: { public_phone: "call me" } }); reject({ ...fixture, fields: { founded_year: "2999" } });
  reject({ ...fixture, services: Array(31).fill("Roofing") }); reject({ ...fixture, services: ["Roofing", "roofing"] }); reject({ ...fixture, hours: [{ weekday: 1, closed: false, opensAt: "17:00", closesAt: "09:00" }] }); reject({ ...fixture, hours: [{ weekday: 1, closed: true, opensAt: "09:00" }] }); reject({ ...fixture, hours: [{ weekday: 1, closed: true }, { weekday: 1, closed: true }] }); reject({ ...fixture, freshness: { ...fixture.freshness, secret: "x" } }); reject({ ...fixture, freshness: { ...fixture.freshness, state: "STALE", mayBeOutdated: false } });
});

test("business response contract rejects wrong identity and private or malformed data", () => {
  const reply = { contractVersion: 1, hub: "contractor", nativeProfileId: ID, replies: [{ id: "33333333-3333-4333-8333-333333333333", replyType: "CONTEXT", targetType: "LICENSE_RECORD", targetRecordId: "CBC123", body: "The business supplied this factual timeline for consumer context.", source: "BUSINESS_RESPONSE", publishedAt: "2026-09-07T12:00:00.000Z", updatedAt: null }] };
  assert.ok(parsePublicBusinessReplies(reply, ID));
  assert.equal(parsePublicBusinessReplies({ ...reply, nativeProfileId: "22222222-2222-4222-8222-222222222222" }, ID), null);
  assert.equal(parsePublicBusinessReplies({ ...reply, internalNote: "private" }, ID), null);
  assert.equal(parsePublicBusinessReplies({ ...reply, replies: [{ ...reply.replies[0], body: "<script>malicious content that is long enough to pass length</script>" }] }, ID), null);
  assert.equal(parsePublicBusinessReplies({ ...reply, replies: [{ ...reply.replies[0], updatedAt: "not-a-date" }] }, ID), null);
});

test("source-derived SEO remains separate and account failure cannot replace the Trust Report", () => {
  assert.match(page, /<ContractorJsonLd contractor=\{contractor\}/);
  assert.doesNotMatch(page, /<ContractorJsonLd[^>]*businessProfile/);
  assert.match(page, /businessProfile \? <BusinessSuppliedProfile/);
  assert.match(page, /businessReplies\?\.replies\.length \? <BusinessResponses/);
});
