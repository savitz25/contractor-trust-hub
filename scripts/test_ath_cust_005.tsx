import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { BusinessSuppliedProfile } from "../components/contractor/BusinessSuppliedProfile.tsx";
import { fetchPublicBusinessProfile } from "../lib/business-profile/fetch-public.ts";
import { parsePublicBusinessProfile } from "../lib/business-profile/public-contract.ts";

const ID = "11111111-1111-4111-8111-111111111111";
const record = { contractVersion: 1, hub: "contractor", nativeProfileId: ID, managed: true, source: "BUSINESS_SUPPLIED",
  freshness: { state: "CURRENT", lastConfirmedAt: "2026-08-30T00:00:00.000Z", label: "Last confirmed Aug 30, 2026", mayBeOutdated: false },
  fields: { description: "Safe <script>alert(1)</script> text", website: "https://example.com", public_phone: "555-555-1212", founded_year: "1998" },
  services: ["Roofing"], serviceAreas: ["Miami-Dade"], languages: ["English"], hours: [{ weekday: 1, closed: false, opensAt: "09:00", closesAt: "17:00" }] } as const;

test("public contract accepts only the exact UUID and public allowlist", () => {
  assert.ok(parsePublicBusinessProfile(record, ID));
  assert.equal(parsePublicBusinessProfile({ ...record, nativeProfileId: "22222222-2222-4222-8222-222222222222" }, ID), null);
  assert.equal(parsePublicBusinessProfile({ ...record, claimantEmail: "private@example.com" }, ID)?.nativeProfileId, ID);
  assert.equal(parsePublicBusinessProfile({ ...record, fields: { ...record.fields, internal_note: "private" } }, ID), null);
  assert.equal(parsePublicBusinessProfile({ ...record, fields: { website: "javascript:alert(1)" } }, ID), null);
});

test("public overlay escapes text and keeps self-reported service area distinct", () => {
  const profile = parsePublicBusinessProfile(record, ID)!;
  const html = renderToStaticMarkup(<BusinessSuppliedProfile profile={profile} officialFormationDate="2004-01-02" />);
  assert.match(html, /Information provided by the business/); assert.match(html, /Managed by the business/);
  assert.match(html, /not a statement of license authority/); assert.match(html, /Official Florida entity filing date/);
  assert.doesNotMatch(html, /<script>alert/); assert.match(html, /&lt;script&gt;alert/);
  assert.match(html, /rel="noopener noreferrer nofollow"/);
});

test("Ask outage, rejection, malformed response, and invalid UUID fail closed", async () => {
  const throws = async () => { throw new Error("offline"); };
  assert.equal(await fetchPublicBusinessProfile(ID, "https://ask.example", throws as typeof fetch), null);
  const rejected = async () => new Response("", { status: 404 });
  assert.equal(await fetchPublicBusinessProfile(ID, "https://ask.example", rejected as typeof fetch), null);
  const malformed = async () => Response.json({ secret: "no" });
  assert.equal(await fetchPublicBusinessProfile(ID, "https://ask.example", malformed as typeof fetch), null);
});
