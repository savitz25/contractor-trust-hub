import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { showUnlinkedPermitHistory } from "../lib/contractors/activity-signals";
import {
  businessManagedSignal,
  contentChangedAtSql,
  disciplineRowIsPublic,
  ENRICHED_PROFILE_SQL,
  enrichedProfileSql,
  enrichedSitemapPageSql,
  enrichedSitemapProbeSql,
  enrichmentObservationIsVisible,
  oshaMatchRenders,
  profileEnrichmentRefreshSelectSql,
  profileIndexRobots,
  resolveProfileEnrichment,
  withBusinessManagedSignal,
  type ProfileEnrichment,
} from "../lib/contractors/profile-enrichment";
import { buildEvidencePillars, officialBoardVerifyLabel } from "../lib/contractors/trust-report";
import { buildShareSummary } from "../lib/contractors/share-summary";
import type { ContractorDetail, LicenseDetail } from "../lib/contractors/types";
import type { EnrichmentRow } from "../lib/contractors/enrichment-shape";

const row = (field: string, value: string, suppressed = false): EnrichmentRow => ({
  field,
  value,
  ordinal: 0,
  is_suppressed: suppressed,
  source_refs: null,
  observed_at: null,
});

function license(sourceSystem: string): LicenseDetail {
  return {
    id: "lic-1",
    externalKey: "CBC0000001",
    occupationCode: "CBC",
    licenseNumber: "15082",
    statusNormalized: "active",
    primaryStatus: "C",
    secondaryStatus: null,
    originalLicensureDate: null,
    effectiveDate: null,
    expirationDate: null,
    addressLine1: null,
    city: "Lakeland",
    state: "FL",
    postalCode: null,
    countyName: "Polk",
    boardNumber: null,
    lastVerifiedAt: "2026-08-10T00:00:00.000Z",
    sourceSystem,
  };
}

function contractor(sourceSystem: string, homeState: string): ContractorDetail {
  return {
    id: "c-1",
    slug: "cbc0000001-example",
    displayName: "Example Construction",
    legalName: "Example Construction Inc",
    dbaName: null,
    primaryCity: "Lakeland",
    primaryCounty: "Polk",
    homeState,
    isThinProfile: false,
    licenses: [license(sourceSystem)],
    entities: [],
    discipline: [],
  };
}

test("each public signal alone is enriched", () => {
  const cases: Array<[string, ProfileEnrichment]> = [
    ["business_contact", resolveProfileEnrichment({ observations: [row("phone", "305-555-0100")] })],
    ["public_contact", resolveProfileEnrichment({ attributedPublicContact: true })],
    ["confirmed_permit", resolveProfileEnrichment({ confirmedPermit: true })],
    ["osha", resolveProfileEnrichment({ oshaRendered: oshaMatchRenders({ enabled: true, matchTier: "exact", state: "FL", licenseKeyMatches: true }) })],
    ["discipline", resolveProfileEnrichment({ disciplinePublic: true })],
    ["business_managed", resolveProfileEnrichment({ businessManaged: { active: true, hasBusinessSuppliedContent: true } })],
  ];
  for (const [signal, result] of cases) {
    assert.equal(result.enriched, true, signal);
    assert.deepEqual(result.signals, [signal]);
  }
});

test("license and Sunbiz alone stay thin", () => {
  const result = resolveProfileEnrichment({});
  assert.equal(result.enriched, false);
  assert.deepEqual(result.signals, []);
});

test("suppressed, placeholder, withheld, and unrendered OSHA stay thin", () => {
  assert.equal(enrichmentObservationIsVisible(row("phone", "305-555-0100", true)), false);
  assert.equal(resolveProfileEnrichment({ observations: [row("website", "n/a")] }).enriched, false);
  assert.equal(resolveProfileEnrichment({ observations: [row("website", "example.com")] }).enriched, false);
  assert.equal(resolveProfileEnrichment({ observations: [row("email", "not-an-email")] }).enriched, false);
  assert.equal(resolveProfileEnrichment({ observations: [row("website", "https://example.com")] }).signals[0], "business_contact");
  assert.equal(businessManagedSignal({ active: true, hasBusinessSuppliedContent: false }), false);
  assert.equal(oshaMatchRenders({ enabled: false, matchTier: "exact", state: "FL", licenseKeyMatches: true }), false);
  assert.equal(oshaMatchRenders({ enabled: true, matchTier: "weak", state: "FL", licenseKeyMatches: true }), false);
  assert.equal(disciplineRowIsPublic({
    sourceSystem: "fl_dbpr",
    publicationState: "WITHHELD",
    identityState: "EXACT",
    contractorId: "c",
    licenseId: "l",
    linkedToContractor: true,
  }, true), false);
  assert.equal(disciplineRowIsPublic({
    sourceSystem: "fl_dbpr",
    publicationState: "PUBLIC_ELIGIBLE",
    identityState: "EXACT",
    contractorId: "c",
    licenseId: "l",
    linkedToContractor: true,
    correctionHold: true,
  }, true), false);
  assert.equal(disciplineRowIsPublic({
    sourceSystem: "fl_dbpr",
    publicationState: "INTERNAL",
    identityState: "EXACT",
    contractorId: null,
    licenseId: "l",
    linkedToContractor: true,
  }, false), true);
  assert.equal(disciplineRowIsPublic({
    sourceSystem: "fl_dbpr",
    publicationState: "INTERNAL",
    identityState: "REVIEW_REQUIRED",
    licenseId: "l",
    linkedToContractor: true,
    correctionHold: true,
  }, false), false);
  assert.equal(disciplineRowIsPublic({
    sourceSystem: "fl_dfs",
    publicationState: "INTERNAL",
    identityState: "EXACT",
    licenseId: "l",
    linkedToContractor: true,
  }, true), false);
  assert.equal(disciplineRowIsPublic({
    sourceSystem: "nj_enforcement",
    publicationState: "PUBLIC_ELIGIBLE",
    linkedToContractor: true,
  }, false), true);
});

test("the sitemap predicate matches the rendered signals and ignores contractor bulk touch", () => {
  const sql = enrichedProfileSql({ oshaEnabled: false });
  assert.match(sql, /contractor_enrichment_observations/);
  assert.match(sql, /public_contact_observations/);
  assert.match(sql, /permit_attributions/);
  assert.match(sql, /identity_state = 'CONFIRMED'/);
  assert.match(sql, /discipline_actions/);
  assert.match(sql, /correction_hold/);
  assert.match(sql, /WITHHELD/);
  assert.match(sql, /identity_state IN \('EXACT', 'DETERMINISTIC'\)/);
  assert.match(sql, /license_id IS NOT NULL/);
  assert.doesNotMatch(sql, /PUBLIC_ELIGIBLE/);
  assert.doesNotMatch(sql, /contractor_osha_license_matches/);
  assert.doesNotMatch(sql, /c\.updated_at/);
  assert.match(enrichedProfileSql({ oshaEnabled: true, oshaStates: ["FL", "NJ"] }), /contractor_osha_license_matches/);
  const changed = contentChangedAtSql({ oshaEnabled: false });
  assert.match(changed, /e\.loaded_at/);
  assert.match(changed, /a\.updated_at/);
  assert.match(changed, /d\.updated_at/);
  assert.match(changed, /last_verified_at/);
  assert.doesNotMatch(changed, /c\.updated_at/);
  assert.doesNotMatch(changed, /contractor_osha_license_matches/);
  assert.match(ENRICHED_PROFILE_SQL, /EXISTS/);
  const refresh = profileEnrichmentRefreshSelectSql({ oshaEnabled: false });
  assert.match(refresh, /contractor_enrichment_observations/);
  assert.match(refresh, /public_contact_observations/);
  assert.match(refresh, /permit_attributions/);
  assert.match(refresh, /discipline_actions/);
  assert.match(refresh, /last_verified_at/);
  assert.doesNotMatch(refresh, /contractor_osha_license_matches/);
  assert.doesNotMatch(refresh, /c\.updated_at/);
  assert.match(profileEnrichmentRefreshSelectSql({ oshaEnabled: true, oshaStates: ["FL", "NJ"] }), /contractor_osha_license_matches/);
  const page = enrichedSitemapPageSql();
  assert.match(page, /contractor_profile_enrichment/);
  assert.match(page, /ORDER BY c\.slug, c\.contractor_id/);
  assert.doesNotMatch(page, /contractor_enrichment_observations/);
  assert.doesNotMatch(page, /c\.updated_at/);
  assert.doesNotMatch(enrichedSitemapProbeSql(), /UNION|ORDER BY|updated_at/i);
});

test("business-managed content can be folded onto the SQL result", () => {
  const thin: ProfileEnrichment = { enriched: false, signals: [], contentChangedAt: null };
  const enriched = withBusinessManagedSignal(thin, { active: true, hasBusinessSuppliedContent: true });
  assert.equal(enriched.enriched, true);
  assert.deepEqual(enriched.signals, ["business_managed"]);
  assert.equal(withBusinessManagedSignal(thin, { active: true, hasBusinessSuppliedContent: false }).enriched, false);
});

test("robots follow either way and index only enriched profiles", () => {
  assert.deepEqual(profileIndexRobots(true), { index: true, follow: true });
  assert.deepEqual(profileIndexRobots(false), { index: false, follow: true });
});

test("an FL license does not render Texas board copy from a Texas home state", () => {
  const profile = contractor("fl_dbpr", "TX");
  const text = JSON.stringify(buildEvidencePillars(profile));
  assert.equal(text.includes("TDLR"), false);
  assert.equal(text.includes("TSBPE"), false);
  assert.equal(text.includes("TX v1"), false);
  assert.match(text, /Sunbiz/);
  assert.match(text, /Florida Division of Workers/);
  assert.equal(officialBoardVerifyLabel(profile).includes("TDLR"), false);
  const share = JSON.stringify(buildShareSummary(profile));
  assert.equal(share.includes("TDLR"), false);
  assert.equal(share.includes("TSBPE"), false);
});

test("confirmed permits hide the unlinked permit sentence", () => {
  assert.equal(showUnlinkedPermitHistory({ activityStatus: "unavailable", confirmedPermits: false }), true);
  assert.equal(showUnlinkedPermitHistory({ activityStatus: "unavailable", confirmedPermits: true }), false);
  assert.equal(showUnlinkedPermitHistory({ activityStatus: "available", confirmedPermits: true }), false);
});

test("the profile segment does not ship a loading shell", () => {
  assert.equal(existsSync("app/contractors/[slug]/loading.tsx"), false);
});
