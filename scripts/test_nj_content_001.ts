/**
 * CONTRACTOR-NJ-CONTENT-001.
 * Unique county research is derived from the acquired NJ snapshots.
 * License-by-trade counts are not invented when the HIC roster was not acquired.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  NJ_CONTENT_LASTMOD,
  NJ_HIC_LOOKUP_URL,
  allNjCountyContent,
  countyResearchText,
  displayCountyName,
  newJerseyStateDescription,
  newJerseyStateTitle,
  sharedSentenceShare,
  statewideCountyRows,
} from "../lib/new-jersey-intelligence/content/nj-content";
import { NEW_JERSEY_SNAPSHOT } from "../lib/new-jersey-intelligence/snapshot";
import { nonContractorSitemapEntries } from "../lib/seo/sitemap-data";

const pages = allNjCountyContent();

test("four county pages share under 40% of their research sentences", () => {
  const texts = pages.map(countyResearchText);
  const measured = sharedSentenceShare(texts);
  console.log(
    `NJ_CONTENT_OVERLAP shared=${measured.shared.toFixed(4)} words=${measured.words.join(",")}`,
  );
  assert.ok(measured.shared < 0.4, `shared sentence share ${measured.shared}`);
  for (const words of measured.words) {
    assert.ok(words >= 180, `research text is ${words} words`);
  }
});

test("titles carry the county name and the held vendor count", () => {
  for (const page of pages) {
    assert.match(page.title, new RegExp(`${page.name} County`));
    assert.match(page.description, new RegExp(page.vendorCount.toLocaleString("en-US")));
    assert.match(page.description, new RegExp(page.dcaRecords.toLocaleString("en-US")));
    assert.equal(page.profileCount, 0);
    assert.ok(page.vendorCount > 0);
    assert.ok(page.featuredVendors.length >= 5);
    assert.equal(page.faqs.length, 4);
    assert.ok(page.neighbors.length >= 1);
  }
});

test("trade license counts stay uncounted when the roster was not acquired", () => {
  for (const page of pages) {
    const text = page.faqs.map((faq) => faq.answer).join(" ");
    assert.match(text, /does not publish a license count/);
    assert.match(text, /roofing, home improvement, HVAC, plumbing, or electrical/);
    assert.equal(page.bulkComplaintRows, 0);
  }
  const union = pages.find((page) => page.slug === "union-county");
  assert.ok(union);
  assert.equal(union.novs.length, 1);
  assert.equal(union.novs[0].town, "Plainfield");
  const monmouth = pages.find((page) => page.slug === "monmouth-county");
  const somerset = pages.find((page) => page.slug === "somerset-county");
  assert.ok(monmouth);
  assert.ok(somerset);
  assert.equal(monmouth.novs.length, 0);
  assert.equal(monmouth.coverage, "LOOKUP_OR_REQUEST_ONLY");
  assert.equal(somerset.coverage, "NO_COUNTY_OFFICE_IN_ATH_AUDIT");
});

test("state page lists all 21 counties and features the four acquired files first", () => {
  const rows = statewideCountyRows();
  assert.equal(rows.length, 21);
  assert.equal(displayCountyName("CAPE MAY"), "Cape May");
  assert.equal(displayCountyName("MONMOUTH"), "Monmouth");
  assert.deepEqual(
    rows.slice(0, 4).map((row) => row.slug),
    ["monmouth-county", "middlesex-county", "union-county", "somerset-county"],
  );
  assert.equal(rows.filter((row) => row.slug).length, 4);
  const records = NEW_JERSEY_SNAPSHOT.construction.total_source_records;
  assert.equal(records, 2678341);
  assert.match(newJerseyStateTitle(records), /2,678,341/);
  assert.match(newJerseyStateDescription(records), /21 counties/);
  assert.equal(NJ_HIC_LOOKUP_URL, "https://newjersey.mylicense.com/verification/");
});

test("sitemap lastmod changes only the five NJ research URLs", () => {
  const dated = nonContractorSitemapEntries().filter((entry) => entry.lastmod);
  assert.deepEqual(
    dated.map((entry) => new URL(entry.loc).pathname).sort(),
    [
      "/new-jersey",
      "/new-jersey/middlesex-county",
      "/new-jersey/monmouth-county",
      "/new-jersey/somerset-county",
      "/new-jersey/union-county",
    ],
  );
  for (const entry of dated) assert.equal(entry.lastmod, NJ_CONTENT_LASTMOD);
});

test("unsuffixed county paths 301 to the published county pages", () => {
  const config = readFileSync("next.config.ts", "utf8");
  for (const [from, to] of [
    ["/new-jersey/monmouth", "/new-jersey/monmouth-county"],
    ["/new-jersey/middlesex", "/new-jersey/middlesex-county"],
    ["/new-jersey/union", "/new-jersey/union-county"],
    ["/new-jersey/somerset", "/new-jersey/somerset-county"],
  ]) {
    assert.match(config, new RegExp(`source: "${from}"`));
    assert.match(config, new RegExp(`destination: "${to}"`));
  }
  assert.match(config, /statusCode: 301/);
});

test("NJ routes stay server-rendered and the new links are present", () => {
  assert.throws(() => readFileSync("app/new-jersey/loading.tsx"));
  assert.throws(() => readFileSync("app/new-jersey/[county]/loading.tsx"));
  const countyPage = readFileSync("app/new-jersey/[county]/page.tsx", "utf8");
  const countyUi = readFileSync("components/new-jersey/nj-county-page.tsx", "utf8");
  const stateUi = readFileSync("components/new-jersey/nj-state-page.tsx", "utf8");
  const home = readFileSync("components/home-intel/ContractorHomeIntelligence.tsx", "utf8");
  assert.doesNotMatch(countyPage, /loading\.tsx|Suspense/);
  assert.match(countyPage, /buildNewJerseyCountyJsonLd\(snapshot, content\.faqs, content\.description\)/);
  const jsonld = readFileSync("lib/new-jersey-intelligence/jsonld.ts", "utf8");
  assert.match(jsonld, /FAQPage/);
  assert.match(countyUi, /Neighboring researched counties/);
  assert.match(stateUi, /All 21 New Jersey counties/);
  assert.match(stateUi, /\/new-jersey\/monmouth-county/);
  assert.match(stateUi, /\/ask\?q=New%20Jersey%20home%20improvement%20contractor%20registration/);
  assert.match(home, /\/new-jersey\/monmouth-county/);
  assert.match(home, /\/new-jersey\/union-county/);
});
