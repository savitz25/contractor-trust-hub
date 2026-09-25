/**
 * Issuing jurisdiction is the credential source. Business home_state stays the address.
 * Verify state filters follow source_system. Statement timeout is not a database outage.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { SEARCH_DATABASE_UNAVAILABLE_MESSAGE, SEARCH_TIMEOUT_MESSAGE, dbUserFacingError } from "../lib/db.ts";
import { searchContractors } from "../lib/contractors/queries.ts";
import { officialBoardVerifyLabel, officialBoardVerifyUrl } from "../lib/contractors/trust-report.ts";
import type { ContractorDetail } from "../lib/contractors/types.ts";
import { trustReportJsonLd, trustReportMetadata } from "../lib/seo/trust-report-seo.ts";
import { evidenceSlugFromHomeState } from "../lib/states/evidence-copy.ts";
import { reportEvidenceSlug, reportJurisdiction, stateForLicenseSource } from "../lib/states/jurisdiction.ts";

function profile(source: string, homeState: string, key: string, city = "Mulberry"): ContractorDetail {
  return {
    id: "profile-1",
    slug: "example",
    displayName: "Floyd's Refrigeration Service Inc",
    legalName: "Floyd's Refrigeration Service Inc",
    dbaName: null,
    primaryCity: city,
    primaryCounty: "Polk",
    homeState,
    isThinProfile: false,
    licenses: [{
      id: "lic-1",
      externalKey: key,
      occupationCode: "R39R",
      licenseNumber: key.split(":").pop() ?? key,
      statusNormalized: "active",
      primaryStatus: "Active",
      secondaryStatus: null,
      originalLicensureDate: null,
      effectiveDate: null,
      expirationDate: null,
      addressLine1: null,
      city,
      state: homeState,
      postalCode: null,
      countyName: "Polk",
      boardNumber: null,
      lastVerifiedAt: null,
      sourceSystem: source,
    }],
    entities: [],
    discipline: [],
  } as ContractorDetail;
}

function titleOf(meta: ReturnType<typeof trustReportMetadata>): string {
  const title = meta.title as string | { absolute?: string } | null | undefined;
  if (!title) return "";
  return typeof title === "string" ? title : title.absolute ?? "";
}

test("canonical source systems map to their issuing states", () => {
  assert.equal(stateForLicenseSource("az_roc")?.code, "AZ");
  assert.equal(stateForLicenseSource("fl_dbpr")?.code, "FL");
  assert.equal(stateForLicenseSource("nj_dca")?.code, "NJ");
  assert.equal(stateForLicenseSource("tx_tdlr")?.code, "TX");
  assert.equal(stateForLicenseSource("tx_tsbpe")?.code, "TX");
  assert.equal(stateForLicenseSource("ca_cslb")?.code, "CA");
  assert.equal(stateForLicenseSource("or_ccb")?.code, "OR");
  assert.equal(stateForLicenseSource("wa_lni")?.code, "WA");
  assert.equal(stateForLicenseSource("not_a_board"), null);
});

test("az_roc with a Florida business address renders an Arizona report and keeps the address", () => {
  const contractor = profile("az_roc", "FL", "AZ-ROC:048164");
  const title = titleOf(trustReportMetadata(contractor));
  assert.match(title, /Arizona Contractor Trust Report/);
  assert.doesNotMatch(title, /Florida/);
  const json = trustReportJsonLd(contractor, "/contractors/example");
  const main = json.mainEntity as { address?: { addressLocality?: string; addressRegion?: string }; identifier?: { name?: string; value?: string } };
  assert.equal(main.address?.addressLocality, "Mulberry");
  assert.equal(main.address?.addressRegion, "FL");
  assert.equal(main.identifier?.value, "048164");
  assert.match(main.identifier?.name ?? "", /Arizona ROC/);
  assert.doesNotMatch(main.identifier?.name ?? "", /Florida DBPR/);
  assert.match(officialBoardVerifyLabel(contractor), /ROC/);
  assert.match(officialBoardVerifyUrl(contractor), /azroc|roc\.az\.gov/i);
});

test("Florida DBPR, New Jersey DCA, and Texas TDLR keep their own report titles", () => {
  assert.match(titleOf(trustReportMetadata(profile("fl_dbpr", "FL", "CBC1268883", "Fort Myers"))), /Florida Contractor Trust Report/);
  assert.match(titleOf(trustReportMetadata(profile("nj_dca", "NJ", "NJ-HIC:13VH13621300", "Garfield"))), /New Jersey Contractor Trust Report/);
  assert.match(titleOf(trustReportMetadata(profile("tx_tdlr", "TX", "TX-TDLR:10001", "Kerrville"))), /Texas Contractor Trust Report/);
});

test("Arizona Verify finds AZ-ROC:048164 when the business address is Florida", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const db = {
    async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
      calls.push({ sql, params: params ?? [] });
      return [{
        id: "profile-1",
        slug: "az-az-roc-048164-floyd-s-refrigeration-service-inc",
        display_name: "Floyd's Refrigeration Service Inc",
        legal_name: null,
        dba_name: null,
        primary_city: "Mulberry",
        primary_county: "Polk",
        home_state: "FL",
        external_key: "AZ-ROC:048164",
        occupation_code: "R39R",
        status_normalized: "active",
        primary_status: "Active",
        last_verified_at: null,
        source_system: "az_roc",
        secondary_status: null,
        entity_status: null,
        entity_name: null,
        has_discipline: false,
      } as T];
    },
  };
  const found = await searchContractors("048164", { stateSlug: "az" }, db);
  assert.equal(calls.length, 1);
  assert.doesNotMatch(calls[0].sql, /home_state = \$/);
  assert.ok((calls[0].params[1] as string[]).includes("az_roc"));
  assert.equal(found.results.length, 1);
  assert.equal(found.results[0].primaryLicenseKey, "AZ-ROC:048164");
  assert.equal(found.results[0].state, "FL");
  assert.equal(found.results[0].sourceSystem, "az_roc");
});

test("exact Florida credential lookup still queries fl_dbpr and does not require a rewritten address", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const db = {
    async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
      calls.push({ sql, params: params ?? [] });
      return [];
    },
  };
  await searchContractors("CBC1268883", { stateSlug: "fl" }, db);
  assert.doesNotMatch(calls[0].sql, /home_state = \$/);
  assert.deepEqual(calls[0].params[1], ["fl_dbpr"]);
});

function surface(source: string, home: string, city = "Atlanta") {
  const contractor = profile(source, home, "X-1", city);
  const report = reportJurisdiction(contractor.licenses);
  const title = titleOf(trustReportMetadata(contractor));
  const json = JSON.stringify(trustReportJsonLd(contractor, "/contractors/example"));
  return { contractor, report, title, json };
}

test("unknown sources do not manufacture a Florida issuing jurisdiction", () => {
  for (const [source, home] of [
    ["ga_sos", "GA"],
    ["", "NC"],
    ["tn_board", "TN"],
    ["ma_board", "MA"],
    ["pa_board", "PA"],
    ["unmapped", "OH"],
  ] as const) {
    const { report, title, json, contractor } = surface(source, home);
    assert.equal(reportEvidenceSlug(contractor.licenses, home), null, source || "empty source");
    assert.equal(report.slug, null);
    assert.equal(report.title, "Contractor Trust Report");
    assert.equal(report.kicker, "Contractor Trust Report 2.0");
    assert.equal(report.credentialLabel, "Credential");
    assert.doesNotMatch(`${title} ${report.kicker} ${json}`, /Florida|DBPR|Arizona|Colorado/);
    const main = JSON.parse(json).mainEntity as { address?: { addressRegion?: string } };
    assert.equal(main.address?.addressRegion, home);
    assert.equal(officialBoardVerifyLabel(contractor), "Open official board search");
    assert.doesNotMatch(officialBoardVerifyUrl(contractor), /myfloridalicense|dbpr/i);
  }
  // Business-location helper may still default unknown home states. The report path must not use it.
  assert.equal(evidenceSlugFromHomeState("GA"), "fl");
  assert.equal(evidenceSlugFromHomeState("NC"), "fl");
});

test("registered boards use one jurisdiction for the title and the visible kicker", () => {
  const cases = [
    ["co_dora", "Colorado"],
    ["va_dpor", "Virginia"],
    ["ny_dol_pw", "New York"],
    ["il_idfpr_roofing", "Illinois"],
    ["wi_dsps", "Wisconsin"],
    ["fl_dbpr", "Florida"],
    ["nj_dca", "New Jersey"],
    ["tx_tdlr", "Texas"],
    ["tx_tsbpe", "Texas"],
    ["az_roc", "Arizona"],
  ] as const;
  for (const [source, name] of cases) {
    const { report, title } = surface(source, "FL", "Mulberry");
    assert.equal(report.kicker, `${name} · Contractor Trust Report 2.0`, source);
    assert.match(title, new RegExp(`${name} Contractor Trust Report`), source);
    if (name !== "Florida") assert.doesNotMatch(report.kicker, /Florida/);
  }
});

test("the profile header kicker is the registry string, not a Florida else branch", () => {
  const page = readFileSync(new URL("../app/contractors/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(page, /\{report\.kicker\}/);
  assert.doesNotMatch(page, /Florida · Contractor Trust Report 2\.0/);
  assert.doesNotMatch(page, /getStateBySlug\("fl"\)/);
});

test("statement timeout and database unavailability use different copy", () => {
  assert.equal(
    dbUserFacingError(new Error("canceling statement due to statement timeout")),
    SEARCH_TIMEOUT_MESSAGE,
  );
  assert.match(SEARCH_TIMEOUT_MESSAGE, /Search took too long/);
  assert.doesNotMatch(SEARCH_TIMEOUT_MESSAGE, /could not reach the license database/i);
  assert.equal(
    dbUserFacingError(new Error("timeout exceeded when trying to connect")),
    SEARCH_DATABASE_UNAVAILABLE_MESSAGE,
  );
  assert.match(SEARCH_DATABASE_UNAVAILABLE_MESSAGE, /could not reach the license database/i);
  assert.equal(
    dbUserFacingError(new Error("remaining connection slots are reserved")),
    SEARCH_DATABASE_UNAVAILABLE_MESSAGE,
  );
});
