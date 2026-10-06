/**
 * MD-ENRICH-001: business-website enrichment shaping + profile section wording.
 * Synthetic values only — the reviewed Miami-Dade inputs stay outside this public repository.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BusinessWebsiteEnrichment } from "../components/contractor/BusinessWebsiteEnrichment";
import { shapeEnrichment, telHref, type EnrichmentRow } from "../lib/contractors/enrichment-shape";

const at = "2026-10-06T01:08:00.000Z";
const row = (field: string, value: string, extra: Partial<EnrichmentRow> = {}): EnrichmentRow => ({
  field,
  value,
  ordinal: 0,
  is_suppressed: false,
  source_refs: ["https://example-builder.test/contact/"],
  observed_at: at,
  ...extra,
});

const full = [
  row("website", "https://www.example-builder.test/"),
  row("phone", "(305) 555-0100"),
  row("phone", "305-555-0101 (Broward)", { ordinal: 1 }),
  row("email", "info@example-builder.test"),
  row("address_location", "Doral, FL"),
  row("specialty", "Roof repair"),
  row("specialty", "Kitchen remodeling", { ordinal: 1 }),
];

test("suppressed observations never reach the public shape", () => {
  const shaped = shapeEnrichment([
    row("website", "https://suppressed.test/", { is_suppressed: true }),
    row("phone", "305-555-0199", { is_suppressed: true }),
    row("email", "x@suppressed.test", { is_suppressed: true }),
    row("address_location", "Mesa, AZ", { is_suppressed: true }),
    row("specialty", "HVAC service", { source_refs: ["https://suppressed.test/services"] }),
  ]);
  assert.ok(shaped);
  assert.equal(shaped.website, null);
  assert.deepEqual(shaped.phones, []);
  assert.deepEqual(shaped.emails, []);
  assert.deepEqual(shaped.otherLocations, []);
  assert.deepEqual(shaped.services, ["HVAC service"]);
  assert.deepEqual(shaped.sourceUrls, [], "source refs must not resurface a suppressed website");
  const html = renderToStaticMarkup(<BusinessWebsiteEnrichment data={shaped} correctionHref="/corrections?slug=x" />);
  assert.doesNotMatch(html, /suppressed\.test|555-0199|Mesa/);
  assert.doesNotMatch(html, /Business contact information/);
});

test("all-suppressed or empty input renders nothing", () => {
  assert.equal(shapeEnrichment([]), null);
  assert.equal(shapeEnrichment([row("phone", "305-555-0199", { is_suppressed: true })]), null);
  assert.equal(shapeEnrichment([row("email", "N/A"), row("phone", "Unknown"), row("specialty", "None")]), null);
});

test("unsafe website schemes are dropped", () => {
  const shaped = shapeEnrichment([row("website", "javascript:alert(1)"), row("specialty", "Painting")]);
  assert.equal(shaped?.website, null);
});

test("labels keep business-listed data separate from DBPR facts", () => {
  const shaped = shapeEnrichment(full)!;
  const html = renderToStaticMarkup(<BusinessWebsiteEnrichment data={shaped} correctionHref="/corrections?slug=x" />);
  assert.match(html, /Business website/);
  assert.match(html, /rel="nofollow noopener noreferrer"/);
  assert.match(html, /Business phone/);
  assert.match(html, /Business email/);
  assert.match(html, /Other locations/);
  assert.match(html, /From the business website/);
  assert.match(html, /Doral, FL/);
  assert.match(html, /Services listed by the business/);
  assert.match(html, /not the DBPR license classification/);
  assert.match(html, /Source: business website/);
  assert.match(html, /tel:\+13055550101/);
  assert.doesNotMatch(html, /Verified by TrustHub|TrustHub verified|N\/A|Unknown|>None</);
  assert.match(html, /has not been verified by TrustHub/);
});

test("no-email profile shows no email row and no placeholder", () => {
  const shaped = shapeEnrichment(full.filter((r) => r.field !== "email"))!;
  const html = renderToStaticMarkup(<BusinessWebsiteEnrichment data={shaped} correctionHref="/c" />);
  assert.doesNotMatch(html, /Business email|mailto:/);
});

test("claim line respects the existing claim CTA gate", () => {
  const shaped = shapeEnrichment(full)!;
  const off = renderToStaticMarkup(<BusinessWebsiteEnrichment data={shaped} correctionHref="/corrections?slug=x" />);
  assert.match(off, /Is this your business\?/);
  assert.match(off, /Correct this profile/);
  assert.doesNotMatch(off, /#manage-profile/);
  const on = renderToStaticMarkup(<BusinessWebsiteEnrichment data={shaped} correctionHref="/c" claimAvailable />);
  assert.match(on, /href="#manage-profile"[^>]*>Claim this profile/);
});

test("telHref ignores label digits and rejects partial numbers", () => {
  assert.equal(telHref("(954) 555-0142 (Broward)"), "tel:+19545550142");
  assert.equal(telHref("1-877-555-0199"), "tel:+18775550199");
  assert.equal(telHref("555-0100"), null);
});

test("profile page wires the section after DBPR licenses and keeps the gated claim CTA", () => {
  const page = readFileSync("app/contractors/[slug]/page.tsx", "utf8");
  assert.ok(page.indexOf("<LicensesSection") < page.indexOf("<BusinessWebsiteEnrichment"));
  assert.match(page, /claimCtaRendered && claimProfile \? <ManageProfileCta/);
  assert.match(page, /const claimCtaRendered = Boolean\(claimProfile && \(businessProfile \|\| showClaimCta\)\)/);
});

test("migration is additive, RLS-on, no anon/authenticated access", () => {
  const sql = readFileSync("schema/migrations/017_contractor_enrichment_observations.sql", "utf8");
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON contractor_enrichment_observations FROM anon/);
  assert.match(sql, /UNIQUE \(contractor_id, field, value_normalized, batch_id\)/);
  assert.doesNotMatch(sql, /ALTER TABLE (contractors|licenses)|UPDATE (contractors|licenses)|GRANT /i);
});

test("raw business contact inputs are not in the repository", () => {
  for (const name of [
    "miami-dade-publish-ready-2026-10-06.csv",
    "miami-dade-publish-ready-2026-10-06.json",
    "miami-dade-publish-ready-flagged-2026-10-06.csv",
  ]) {
    assert.equal(existsSync(name), false);
    assert.equal(existsSync(`data/${name}`), false);
  }
  const receipt = readFileSync("docs/md-enrich-001/dry-run-production-receipt.json", "utf8");
  assert.doesNotMatch(receipt, /@[a-z0-9-]+\.[a-z]{2,}|\(\d{3}\) \d{3}-\d{4}|\d{3}-\d{3}-\d{4}/i);
});
