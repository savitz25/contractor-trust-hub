import assert from "node:assert/strict";
import { test } from "node:test";
import { FLORIDA_COUNTY_INTEL_CATALOG } from "../lib/intelligence/county-catalog.ts";
import {
  buildCountyIntelligencePayload,
  publicCountyMetrics,
} from "../lib/intelligence/county-payload.ts";
import {
  countyResearchCoverage,
  evaluateEnhancedLocalResearchGate,
} from "../lib/intelligence/coverage.ts";

const GENERATED = "2026-08-26T00:00:00.000Z";

function counts(kind: "broward" | "palm-beach") {
  return {
    tracked: kind === "broward" ? 11568 : 9325,
    active: kind === "broward" ? 8414 : 7043,
    tradeTracked: kind === "broward" ? 9454 : 7965,
    tradeActive: kind === "broward" ? 8413 : 7043,
    asOf: GENERATED,
    occupationRows: [
      { occupation_code: "CGC", tracked: 10, active: 8 },
      { occupation_code: "RR", tracked: 4, active: 3 },
      { occupation_code: "CCC", tracked: 6, active: 5 },
    ],
    jurisdictionRows:
      kind === "broward"
        ? [
            { kind: "unincorporated", n: 1 },
            { kind: "municipal", n: 31 },
          ]
        : [
            { kind: "unincorporated", n: 1 },
            { kind: "municipal", n: 39 },
          ],
    permitRows: 0,
    localCredentialRows: 0,
    contactRows: null,
    sourceFileRows: 0,
  };
}

test("both counties stay Statewide Research", () => {
  for (const slug of ["broward", "palm-beach", "miami-dade", "pinellas"] as const) {
    assert.equal(countyResearchCoverage(slug), "statewide");
    const p = buildCountyIntelligencePayload({
      countySlug: slug,
      generatedAt: GENERATED,
      timedOut: false,
      counts: counts(slug === "palm-beach" ? "palm-beach" : "broward"),
    });
    assert.equal(p.coverageLevel, "statewide");
    assert.equal(p.enhancedGateActivated, false);
    assert.equal(p.canonicalPath, FLORIDA_COUNTY_INTEL_CATALOG[slug].canonicalPath);
  }
});

test("Enhanced gate stays inactive without local activity evidence", () => {
  assert.equal(
    evaluateEnhancedLocalResearchGate({
      sourceFilesLoaded: true,
      permitOrLocalCredentialCoverage: true,
      identityAttributionValidated: true,
      jurisdictionDenominatorKnown: true,
      recencySufficient: true,
      noCriticalCoverageAmbiguity: true,
      operatingActivityEvidence: false,
    }),
    "statewide"
  );
});

test("public metrics omit INTERNAL_ONLY permit zeros", () => {
  const p = buildCountyIntelligencePayload({
    countySlug: "broward",
    generatedAt: GENERATED,
    timedOut: false,
    counts: counts("broward"),
  });
  const pub = publicCountyMetrics(p);
  assert.ok(pub.some((m) => m.id === "county_credentials" && m.value === 11568));
  assert.ok(pub.some((m) => m.id === "mapped_local_jurisdictions" && m.value === 32));
  assert.equal(
    pub.some((m) => m.id === "permits" || m.id === "local_credentials"),
    false
  );
  const permits = p.metrics.find((m) => m.id === "permits");
  assert.equal(permits?.readiness, "INTERNAL_ONLY");
  assert.equal(permits?.publicEligibility, "internal_only");
});

test("Palm Beach maps 40 jurisdictions as metadata", () => {
  const p = buildCountyIntelligencePayload({
    countySlug: "palm-beach",
    generatedAt: GENERATED,
    timedOut: false,
    counts: counts("palm-beach"),
  });
  assert.equal(p.jurisdictions.totalMapped, 40);
  assert.equal(p.jurisdictions.municipalCount, 39);
  assert.match(p.jurisdictions.disclosure, /does not mean permit activity/i);
});

test("timeout omits numbers instead of publishing zeros", () => {
  const p = buildCountyIntelligencePayload({
    countySlug: "broward",
    generatedAt: GENERATED,
    timedOut: true,
    counts: counts("broward"),
  });
  assert.equal(p.timedOut, true);
  assert.equal(p.metrics.length, 0);
  assert.equal(publicCountyMetrics(p).length, 0);
});

test("Miami-Dade confirmed permits are READY and Pinellas permits stay pending", () => {
  const mdc = buildCountyIntelligencePayload({
    countySlug: "miami-dade",
    generatedAt: GENERATED,
    timedOut: false,
    counts: {
      ...counts("broward"),
      permitEvidence: {
        sourceRows: 139586,
        confirmed: 80810,
        confirmedLast12Months: 40000,
        distinctLicenses: 8015,
        unincorporated: 60000,
        associatedReview: 10000,
        withValuation: 70000,
        recordedValuation: 123,
        contactObservations: 16009,
        contactDistinctLicenses: 5000,
      },
    },
  });
  assert.equal(mdc.coverageLevel, "statewide");
  assert.equal(mdc.enhancedGateActivated, false);
  const pub = publicCountyMetrics(mdc);
  assert.ok(pub.some((m) => m.id === "confirmed_issued_permits" && m.value === 80810));
  assert.equal(pub.some((m) => m.id === "permits"), false);
  assert.match(
    pub.find((m) => m.id === "confirmed_issued_permits")!.disclosure,
    /Not all Miami-Dade permits/i
  );
  const pin = buildCountyIntelligencePayload({
    countySlug: "pinellas",
    generatedAt: GENERATED,
    timedOut: false,
    counts: counts("broward"),
  });
  assert.equal(pin.modules.find((m) => m.id === "permits")?.readiness, "NOT_READY");
  assert.equal(publicCountyMetrics(pin).some((m) => m.id === "permits"), false);
});

test("RR is not in the roofing category", () => {
  const p = buildCountyIntelligencePayload({
    countySlug: "broward",
    generatedAt: GENERATED,
    timedOut: false,
    counts: counts("broward"),
  });
  const roofing = p.categories.find((c) => c.slug === "roofers");
  const residential = p.categories.find((c) => c.slug === "residential-contractors");
  assert.ok(roofing && residential);
  assert.equal(
    roofing.splits.some((s) => s.code === "RR"),
    false
  );
  assert.ok(residential.splits.some((s) => s.code === "RR"));
  assert.ok(roofing.href.includes("/florida/broward/roofers"));
});
