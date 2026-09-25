/**
 * ATH-SEARCH-UX-001: company-name candidate card interaction and wording.
 * Matching, order, counts, and profile hrefs are inputs. This file checks presentation only.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AskResultCard } from "../components/ask/AskResultCard";
import { AskResults } from "../components/ask/AskResults";
import {
  NAME_CANDIDATE_LIST_NOTICE,
  NAME_CANDIDATE_RECORDED_ADDRESS_MEANING,
  matchSummary,
  recordedAddressLine,
  traceMatchText,
} from "../lib/ask/candidate-card-presentation";
import { NAME_MATCH_DISCLAIMER, type AskEntityCard } from "../lib/ask/execute";
import { RESEARCH_QUERY_VERSION, type ContractorResearchQuery } from "../lib/ask/plan";
import { attachRecordedAddresses } from "../lib/ask/recorded-address-projection";
import { formatLicenseAddress, nameSearchFilterAccount } from "../lib/ask/recorded-address-display";
import { classifySpecialistSearchClick } from "../lib/specialist-search/analytics";
import { ASK_CONTRACT_VERSION, type AskResult } from "../lib/ask/types";
import type { AskExecution } from "../lib/ask/execute";

const LONG_NAME = "VANTAGE ARCHITECTURAL SOLUTIONS AND MECHANICAL ENGINEERING HOLDINGS LIMITED LIABILITY COMPANY";
const MULTI_CLASS = "Warm-Air Heating, Ventilating and Air-Conditioning (+1 more)";

function card(partial: Partial<AskEntityCard> & Pick<AskEntityCard, "contractorId" | "displayName" | "profileHref">): AskEntityCard {
  return {
    slug: "slug",
    credentialKey: "718694",
    occupationCode: "C20",
    occupationLabel: MULTI_CLASS,
    statusNormalized: "current",
    statusLabel: "CLEAR in indexed California record",
    city: null,
    county: "Los Angeles",
    state: "CA",
    sourceLabel: "California Contractors State License Board (CSLB)",
    sourceSystem: "ca_cslb",
    geographyNote: NAME_CANDIDATE_RECORDED_ADDRESS_MEANING,
    evidenceCount: 0,
    newestEvidenceDate: null,
    whyMatched: `The public display name contains every required supplied word (VANTAGE); each one begins or equals a word of that name. Matched on the public display name: “VANTAGE AIR INC”. ${NAME_MATCH_DISCLAIMER}`,
    evidence: [],
    credentialJurisdictionLabel: "California · California Contractors State License Board (CSLB)",
    matchedOn: { field: "display_name", value: "VANTAGE AIR INC", method: "PREFIX_OR_TOKEN" },
    ...partial,
  };
}

function plan(): ContractorResearchQuery {
  return {
    version: RESEARCH_QUERY_VERSION,
    planId: "plan-test",
    mode: "entity",
    rawQuery: "vantage",
    recovery: null,
    geographyRequirement: null,
    geographyAction: null,
    geographyChoice: null,
    geographyCorrection: null,
    identity: { identifier: null, entityQuery: "vantage", nameJurisdiction: null },
    geography: { state: null, city: null, countySlug: null, countyLabel: null, evidenceType: "unknown", method: "No geography filter applied." },
    compareCountySlugs: [],
    trade: { familyId: null, label: null, occupationCodes: [], classLabels: [], discoverySlug: null },
    credentialStatus: "all",
    evidenceFamily: null,
    sort: { field: "name", direction: "asc" },
    grain: "contractor_profile",
    requestedMetric: null,
    limit: 10,
    page: 1,
    offset: 0,
    executable: true,
    failMessage: null,
    changeHints: ["Add a credential number"],
    notes: [],
  };
}

function interpreted(): AskResult {
  return {
    version: ASK_CONTRACT_VERSION,
    query: "vantage",
    mode: "entity",
    supported: true,
    interpretation: {
      identifier: null,
      entityQuery: "vantage",
      location: "Every jurisdiction served by ContractorTrustHub name search",
      trade: "Not specified",
      credentialStatus: "all",
      evidenceFamily: "Not specified",
      entityType: "Company-name candidates",
      sort: "name",
      notes: [],
    },
    href: "/ask?q=vantage",
    count: null,
    aggregate: null,
    comparison: null,
    failMessage: null,
    changeHints: ["Add a credential number"],
  };
}

function execution(results: AskEntityCard[], name: boolean): AskExecution {
  return {
    ok: true,
    blocked: false,
    blockMessage: null,
    contractorCount: name ? null : results.length,
    credentialCount: name ? null : results.length,
    evidenceSourceRows: null,
    grainLabel: "contractor profile",
    asOf: "2026-09-24",
    snapshotFingerprint: "2715b52bae3b",
    results,
    page: 1,
    pageSize: name ? 10 : 24,
    sqlContract: name ? "contractor-name-candidates-v1 (shared name core; every name-searchable jurisdiction)" : "parameterized exact credential / normalized name search",
    evidenceJoinable: null,
    compare: null,
    nameSearch: name
      ? {
          resultState: "COMPLETED_WITH_CANDIDATES",
          supplied: "VANTAGE",
          normalized: "VANTAGE",
          requiredWords: ["VANTAGE"],
          optionalWordsDropped: [],
          jurisdiction: null,
          scopeMeaning: "Every jurisdiction served by ContractorTrustHub name search was searched.",
          searchedJurisdictions: ["CA", "LA"],
          returned: results.length,
          hasMore: false,
          nextPage: null,
          truncated: false,
          completeness: null,
          limitations: ["Candidates are relevant public records matched by name."],
          continuation: [],
          failure: null,
          timingMs: 1,
        }
      : null,
  };
}

function face(html: string): string {
  const start = html.indexOf('data-testid="ask-profile-link"');
  const end = html.indexOf("cth-result-card__actions");
  assert.ok(start >= 0 && end > start);
  return html.slice(start, end);
}

test("name-candidate card uses one profile anchor, keeps the destination, and leaves Save and Trace outside it", () => {
  const row = card({
    contractorId: "contractor:profile:ca-ca-cslb-718694-vantage-air-inc",
    slug: "ca-ca-cslb-718694-vantage-air-inc",
    displayName: LONG_NAME,
    profileHref: "/contractors/ca-ca-cslb-718694-vantage-air-inc",
  });
  const html = renderToStaticMarkup(<AskResultCard card={row} />);
  const links = html.match(/data-testid="ask-profile-link"/g) ?? [];
  assert.equal(links.length, 1);
  assert.match(html, /href="\/contractors\/ca-ca-cslb-718694-vantage-air-inc"/);
  assert.equal(html.includes("View profile"), true);
  const identity = face(html);
  assert.match(identity, /View profile/);
  assert.doesNotMatch(identity, /<button|<details|<summary/);
  assert.match(html, /data-search-action="save"/);
  assert.match(html, /data-search-action="trace"/);
  assert.ok(html.indexOf('data-search-action="profile"') < html.indexOf('data-search-action="save"'));
  assert.ok(html.indexOf('data-search-action="save"') < html.indexOf('data-search-action="trace"'));
  assert.match(html, new RegExp(LONG_NAME));
  assert.match(html, /718694/);
  assert.match(html, /Warm-Air Heating, Ventilating and Air-Conditioning \(\+1 more\)/);
  assert.match(html, /CLEAR in indexed California record/);
  assert.match(html, /Credential jurisdiction/);
  assert.match(html, /California Contractors State License Board \(CSLB\)/);
  assert.match(html, /Recorded address/);
  assert.match(html, /Los Angeles County, CA/);
  assert.doesNotMatch(face(html), /prefix\/token|Why this matched/);
  assert.match(html, /prefix or token · field: display name · “VANTAGE AIR INC”/);
  assert.doesNotMatch(face(html), /exact/i);
  assert.doesNotMatch(html, /Safe|Trusted|Verified by TrustHub|Get a Quote|Preferred|Contact/);
  assert.doesNotMatch(html, /text-\[var\(--success\)\]|bg-green|text-green/);
  assert.doesNotMatch(html, new RegExp(NAME_MATCH_DISCLAIMER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(html, /contains every required supplied word \(VANTAGE\)/);
  assert.match(html, /prefix or token · field: display name · “VANTAGE AIR INC”/);
  assert.doesNotMatch(face(html), new RegExp(NAME_CANDIDATE_RECORDED_ADDRESS_MEANING.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(html, new RegExp(NAME_CANDIDATE_RECORDED_ADDRESS_MEANING.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("out-of-state address, unknown status, alias, and exact source name stay distinct", () => {
  const out = card({
    contractorId: "la",
    displayName: "Vantage Architectural Solutions, LLC",
    profileHref: "/contractors/la-lslbc-1354-vantage-architectural-solutions-llc",
    credentialKey: "1354",
    occupationLabel: "Commercial License Certificate",
    occupationCode: null,
    statusLabel: "Status not reported",
    statusNormalized: null,
    county: "Out-of-State",
    state: "LA",
    city: null,
    sourceLabel: "Louisiana State Licensing Board for Contractors (LSLBC)",
    credentialJurisdictionLabel: "Louisiana · Louisiana State Licensing Board for Contractors (LSLBC)",
    matchedOn: { field: "dba_name", value: "Vantage Architectural Solutions, LLC", method: "DOCUMENTED_ALIAS" },
  });
  const html = renderToStaticMarkup(<AskResultCard card={out} />);
  assert.match(html, /Status · <\/span>Status not reported/);
  assert.doesNotMatch(html, /Active\/current|CLEAR/);
  assert.match(html, /Source marks this address as out of jurisdiction/);
  assert.doesNotMatch(html, /Out-of-State County|Out-of-State, LA/);
  assert.match(html, /Credential jurisdiction · <\/span>Louisiana/);
  assert.match(html, /documented alias · field: dba name/);
  assert.doesNotMatch(face(html), /documented alias/);
  assert.doesNotMatch(matchSummary(out, "VANTAGE") ?? "", /exact/i);

  const exact = matchSummary(
    card({
      contractorId: "exact",
      displayName: "VANTAGE CONSTRUCTION",
      profileHref: "/contractors/example",
      matchedOn: { field: "display_name", value: "VANTAGE CONSTRUCTION", method: "EXACT_SOURCE_NAME" },
    }),
    "VANTAGE CONSTRUCTION",
  );
  assert.equal(exact, "Matched “VANTAGE CONSTRUCTION” · exact source name on display name");
  const normalized = matchSummary(
    card({
      contractorId: "norm",
      displayName: "WORSHAM CONSTRUCTION COMPANY INC",
      profileHref: "/contractors/cbc015082-worsham-construction-company-inc",
      matchedOn: { field: "legal_name", value: "WORSHAM CONSTRUCTION COMPANY INC", method: "NORMALIZED_NAME" },
    }),
    "Worsham Construction",
  );
  assert.equal(normalized, "Matched “Worsham Construction” · normalized name match on legal name");
  const unknown = matchSummary(
    card({
      contractorId: "fuzzy",
      displayName: "VANTAGE",
      profileHref: "/contractors/example",
      matchedOn: { field: "display_name", value: "VANTAGE", method: "FUZZY_CANDIDATE" },
    }),
    "VANTAGE",
  );
  assert.equal(unknown, "Matched “VANTAGE” · fuzzy candidate on display name");
  assert.doesNotMatch(unknown ?? "", /exact/);
});

test("exact identifier results are not name-candidate cards and rows without a profile do not advertise one", () => {
  const exact = card({
    contractorId: "id-1",
    displayName: "WORSHAM CONSTRUCTION COMPANY INC",
    profileHref: "/contractors/cbc015082-worsham-construction-company-inc",
    credentialKey: "CBC015082",
    occupationLabel: "Certified Building Contractor",
    statusLabel: "Current in indexed Florida record",
    matchedOn: null,
    whyMatched: "Matches the submitted credential identifier in the published licensing corpus.",
    geographyNote: "Recorded licensing address; not service territory or current availability.",
    credentialJurisdictionLabel: null,
    county: "Duval",
    state: "FL",
    city: "Jacksonville",
  });
  assert.equal(matchSummary(exact), "Exact credential identifier match");
  const exactHtml = renderToStaticMarkup(<AskResultCard card={exact} />);
  assert.match(exactHtml, /Exact credential identifier match/);
  assert.match(exactHtml, /href="\/contractors\/cbc015082-worsham-construction-company-inc"/);
  assert.doesNotMatch(exactHtml, /prefix\/token|does not establish that the record is the exact business|Name matched/);
  assert.match(exactHtml, /Recorded address · <\/span>Jacksonville, FL/);
  assert.match(exactHtml, /County · <\/span>Duval County/);

  const hidden = card({
    contractorId: "none",
    slug: "",
    displayName: "Research only row",
    profileHref: null,
    matchedOn: null,
    whyMatched: "Indexed record without a public profile.",
    credentialJurisdictionLabel: null,
  });
  const hiddenHtml = renderToStaticMarkup(<AskResultCard card={hidden} />);
  assert.equal(hiddenHtml.includes("View profile"), false);
  assert.equal(hiddenHtml.includes('data-search-action="profile"'), false);
  assert.match(hiddenHtml, /No public profile is published for this row/);
  assert.match(hiddenHtml, /href="\/verify"/);
  assert.match(hiddenHtml, /Research in Verify/);
});

test("the shared list notice is once above name candidates and is absent from exact-identifier results", () => {
  const first = card({
    contractorId: "a",
    displayName: "VANTAGE AIR INC",
    profileHref: "/contractors/ca-ca-cslb-718694-vantage-air-inc",
    slug: "ca-ca-cslb-718694-vantage-air-inc",
  });
  const second = card({
    contractorId: "b",
    displayName: "VANTAGE BUILDERS",
    profileHref: "/contractors/ca-ca-cslb-1009024-vantage-builders",
    slug: "ca-ca-cslb-1009024-vantage-builders",
    credentialKey: "1009024",
  });
  const html = renderToStaticMarkup(
    <AskResults interpreted={interpreted()} plan={plan()} execution={execution([first, second], true)} />,
  );
  assert.equal(html.split(NAME_CANDIDATE_LIST_NOTICE).length - 1, 1);
  assert.ok(html.indexOf(NAME_CANDIDATE_LIST_NOTICE) < html.indexOf("VANTAGE AIR INC"));
  assert.ok(html.indexOf("/contractors/ca-ca-cslb-718694-vantage-air-inc") < html.indexOf("/contractors/ca-ca-cslb-1009024-vantage-builders"));
  assert.match(html, />2</);
  assert.doesNotMatch(html, new RegExp(NAME_MATCH_DISCLAIMER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  const identifier = renderToStaticMarkup(
    <AskResults
      interpreted={interpreted()}
      plan={{ ...plan(), identity: { identifier: "CBC015082", entityQuery: null } }}
      execution={execution([card({
        contractorId: "id",
        displayName: "WORSHAM CONSTRUCTION COMPANY INC",
        profileHref: "/contractors/cbc015082-worsham-construction-company-inc",
        matchedOn: null,
        whyMatched: "Matches the submitted credential identifier in the published licensing corpus.",
        geographyNote: "Recorded licensing address; not service territory or current availability.",
      })], false)}
    />,
  );
  assert.equal(identifier.includes(NAME_CANDIDATE_LIST_NOTICE), false);
  assert.match(identifier, /Exact credential identifier match/);
  assert.match(identifier, /Matches the submitted credential identifier in the published licensing corpus/);
  assert.equal(identifier.includes("Why this matched"), false);
});

test("cohort cards keep their own explanation and destination", () => {
  const cohort = card({
    contractorId: "cohort",
    displayName: "SAMPLE ROOFING INC",
    profileHref: "/contractors/sample-roofing",
    matchedOn: null,
    credentialJurisdictionLabel: null,
    geographyNote: "Broward County recorded address in the indexed licensing record — not service territory.",
    whyMatched: "This contractor appears because an indexed Florida DBPR credential record matched the structured filters.",
    statusLabel: "Active/current in indexed DBPR record",
  });
  const html = renderToStaticMarkup(<AskResultCard card={cohort} />);
  assert.equal(face(html).includes("Why this matched"), false);
  assert.match(html, /indexed Florida DBPR credential record matched the structured filters/);
  assert.match(html, /href="\/contractors\/sample-roofing"/);
  assert.match(html, /Broward County recorded address/);
  assert.equal(matchSummary(cohort), null);
});

test("trace text drops only the shared disclaimer and address lines do not duplicate the state", () => {
  const why = `The public display name equals the supplied name. ${NAME_MATCH_DISCLAIMER}`;
  assert.equal(traceMatchText(why), "The public display name equals the supplied name.");
  assert.equal(traceMatchText("Matches the submitted credential identifier in the published licensing corpus."), "Matches the submitted credential identifier in the published licensing corpus.");
  assert.equal(recordedAddressLine({ city: "Jacksonville", county: "Duval", state: "FL" }), "Jacksonville, Duval County, FL");
  assert.equal(recordedAddressLine({ city: null, county: "Cameron", state: "TX" }), "Cameron County, TX");
  assert.equal(recordedAddressLine({ city: "Little Rock", county: "Out-of-State", state: "LA" }), "Little Rock");
  assert.equal(
    NAME_CANDIDATE_RECORDED_ADDRESS_MEANING,
    "Recorded address on the profile. Separate from the credential jurisdiction; not service territory or current availability.",
  );
});

test("Florida place filter that name search ignores stays visible and does not reorder cards", () => {
  const florida = card({
    contractorId: "fl-1815743",
    displayName: "SNYDER AIR CONDITIONING, PLUMBING & ELECTRIC, LLC",
    profileHref: "/contractors/cac1815743-snyder-air-conditioning-plumbing-electric-llc",
    credentialKey: "1815743",
    county: "Palm Beach",
    city: "BOCA RATON",
    state: "FL",
    statusLabel: "C in indexed Florida record",
    credentialJurisdictionCode: "FL",
    credentialJurisdictionLabel: "Florida · Florida DBPR — Construction Industry Licensing Board",
  });
  const texas = card({
    contractorId: "tx-97866",
    displayName: "SNYDER AIR CONDITIONING LLC",
    profileHref: "/contractors/tx-tdlr-a-c-contractor-97866-be-snyder-air-conditioning-llc",
    credentialKey: "97866",
    county: "Cameron",
    city: null,
    state: "TX",
    statusLabel: "active in indexed Texas record",
    sourceLabel: "Texas Department of Licensing and Regulation",
    credentialJurisdictionCode: "TX",
    credentialJurisdictionLabel: "Texas · Texas Department of Licensing and Regulation",
  });
  const geography = { ...plan().geography, state: "FL" as const, countyLabel: "Florida (statewide in this extract)" };
  const html = renderToStaticMarkup(
    <AskResults interpreted={interpreted()} plan={{ ...plan(), geography }} execution={execution([florida, texas], true)} />,
  );
  assert.match(html, /Selected on the form/);
  assert.match(html, /Applied to these name candidates/);
  assert.match(html, /Place, trade, status, and evidence selections were not applied/);
  assert.match(html, /Name matched — not proof this is the firm you mean/);
  assert.match(html, /BOCA RATON, Palm Beach County, FL/);
  assert.match(html, /Cameron County, TX/);
  assert.match(html, /C in indexed Florida record/);
  assert.match(html, /active in indexed Texas record/);
  assert.equal(html.includes("Credential jurisdiction is Texas. The selected"), false);
  assert.equal(html.includes("Trade: HVAC"), false);
  assert.ok(html.indexOf("/contractors/cac1815743-snyder-air-conditioning-plumbing-electric-llc") < html.indexOf("/contractors/tx-tdlr-a-c-contractor-97866-be-snyder-air-conditioning-llc"));
  assert.doesNotMatch(html, /office|headquarters|service area/);
});

test("license address keeps street and ZIP on that credential and leaves the v1 files untouched", async () => {
  const florida = formatLicenseAddress({
    street: "100 EXAMPLE WAY",
    city: "BOCA RATON",
    state: "FL",
    postalCode: "33432",
    county: "Palm Beach",
  });
  assert.equal(florida.line, "100 EXAMPLE WAY, BOCA RATON, FL 33432");
  assert.equal(florida.countyLabel, "Palm Beach County");
  assert.equal(florida.outOfJurisdiction, false);
  const texas = formatLicenseAddress({ county: "Cameron", state: "TX" });
  assert.equal(texas.line, "Cameron County, TX");
  assert.equal(texas.countyLabel, null);
  const outside = formatLicenseAddress({ city: "Little Rock", state: "AR", county: "Out-of-State", postalCode: "72201" });
  assert.equal(outside.line, "Little Rock, AR 72201");
  assert.equal(outside.countyLabel, null);
  assert.equal(outside.outOfJurisdiction, true);
  const cityOnly = formatLicenseAddress({ city: "Little Rock", county: "Out-of-State" });
  assert.equal(cityOnly.line, null);
  assert.equal(cityOnly.locationOnly, "Little Rock");

  const calls: string[] = [];
  const db = {
    query: async (sql: string) => {
      calls.push(sql);
      return [
        { slug: "fl-boca", license_number: "1815743", external_key: "CAC1815743", address_line_1: "100 EXAMPLE WAY", city: "BOCA RATON", state: "FL", postal_code: "33432", county_name: "Palm Beach", is_thin_profile: false },
        { slug: "fl-jax", license_number: "1822714", external_key: "CAC1822714", address_line_1: null, city: "JACKSONVILLE", state: "FL", postal_code: "32216", county_name: "Duval", is_thin_profile: false },
        { slug: "tx", license_number: "97866", external_key: "TX-TDLR:97866", address_line_1: null, city: null, state: "TX", postal_code: null, county_name: "Cameron", is_thin_profile: false },
        { slug: "other", license_number: "1815743", external_key: "OTHER", address_line_1: "999 OTHER ST", city: "MIAMI", state: "FL", postal_code: "33101", county_name: "Miami-Dade", is_thin_profile: false },
      ];
    },
  };
  const cards = [
    card({ contractorId: "a", slug: "fl-boca", displayName: "A", profileHref: "/contractors/fl-boca", credentialKey: "1815743" }),
    card({ contractorId: "b", slug: "fl-jax", displayName: "B", profileHref: "/contractors/fl-jax", credentialKey: "1822714", city: "JACKSONVILLE", county: "Duval", state: "FL" }),
    card({ contractorId: "c", slug: "tx", displayName: "C", profileHref: "/contractors/tx", credentialKey: "97866", city: null, county: "Cameron", state: "TX" }),
  ];
  const projected = await attachRecordedAddresses(cards, db as never);
  assert.equal(projected.queries, 1);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /address_line_1/);
  assert.doesNotMatch(calls[0], /email|phone|raw_payload|claim/i);
  assert.equal(projected.results[0].publicAddress?.line, "100 EXAMPLE WAY, BOCA RATON, FL 33432");
  assert.equal(projected.results[0].publicAddress?.countyLabel, "Palm Beach County");
  assert.equal(projected.results[1].publicAddress?.line, "JACKSONVILLE, FL 32216");
  assert.equal(projected.results[1].publicAddress?.countyLabel, "Duval County");
  assert.equal(projected.results[2].publicAddress?.line, "Cameron County, TX");
  assert.notEqual(projected.results[0].publicAddress?.line, projected.results[2].publicAddress?.line);
  assert.equal(projected.results.map((row) => row.credentialKey).join(), "1815743,1822714,97866");
  const html = renderToStaticMarkup(<AskResultCard card={projected.results[0]} />);
  assert.match(html, /100 EXAMPLE WAY, BOCA RATON, FL 33432/);
  assert.match(html, /Palm Beach County/);
  assert.doesNotMatch(html, /999 OTHER ST|phone|email/);
  const link = html.match(/<a[^>]*data-testid="ask-profile-link"[\s\S]*?<\/a>/)?.[0] ?? "";
  assert.match(link, /View profile/);
  assert.doesNotMatch(link, /1815743|100 EXAMPLE WAY/);

  const failed = await attachRecordedAddresses(cards, { query: async () => { throw new Error("down"); } } as never);
  assert.equal(failed.status, "unavailable");
  assert.equal(failed.queries, 1);
  const failedHtml = renderToStaticMarkup(<AskResultCard card={failed.results[2]} />);
  assert.match(failedHtml, /not a finding that the source has no address/);

  const account = nameSearchFilterAccount(
    { geography: { state: "FL", countySlug: null, countyLabel: null }, trade: { label: "HVAC" }, credentialStatus: "active_current", evidenceFamily: null },
    { jurisdiction: null },
  );
  assert.deepEqual(account.selected, ["Florida", "HVAC", "Active/current"]);
  assert.match(account.applied, /were not applied/);
  const constrained = nameSearchFilterAccount(
    { geography: { state: "FL", countySlug: null, countyLabel: null }, trade: { label: null }, credentialStatus: "all", evidenceFamily: null },
    { jurisdiction: "NJ" },
  );
  assert.match(constrained.applied, /Credential jurisdiction NJ was applied/);
});

test("one profile activation is not also a save or a trace", () => {
  assert.equal(classifySpecialistSearchClick("profile", "VANTAGE AIR INC View profile → 718694"), "profile");
  assert.equal(classifySpecialistSearchClick(null, "Research this contractor"), "profile");
  assert.equal(classifySpecialistSearchClick("save", "Save to research View profile"), null);
  assert.equal(classifySpecialistSearchClick("trace", "Trace this result"), "trace");
  assert.equal(classifySpecialistSearchClick("trace", "Trace this result View profile"), "trace");
  assert.equal(classifySpecialistSearchClick(null, "Research in Verify"), null);
  assert.equal(classifySpecialistSearchClick(null, "View evidence"), null);
});

test("focus, hover, and reduced motion stay on separate selectors", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.cth-profile-link:focus-visible/);
  assert.match(css, /\.cth-result-secondary:focus-visible/);
  assert.match(css, /\.cth-result-card:hover[\s\S]*translateY\(-2px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.cth-result-card:hover \{[\s\S]*transform: none;/);
  assert.match(css, /min-height: var\(--th-control\)/);
});
