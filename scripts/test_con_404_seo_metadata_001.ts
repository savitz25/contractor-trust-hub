import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { ContractorDetail } from "../lib/contractors/types";
import {
  notFoundPageMetadata,
  streamedNotFoundHead,
} from "../lib/seo/not-found-metadata";
import {
  isTransientProfileDbError,
  metadataAfterProfileLookupError,
} from "../lib/seo/profile-lookup";
import { trustReportMetadata } from "../lib/seo/trust-report-seo";
import { absoluteUrl } from "../lib/site";

const HOMEPAGE = "https://www.contractortrusthub.com";

test("a genuine 404 streams noindex and does not canonicalize to the homepage", () => {
  const robots = notFoundPageMetadata.robots;
  assert.equal(typeof robots, "object");
  assert.ok(robots && typeof robots !== "string");
  if (!robots || typeof robots === "string") return;
  assert.equal(robots.index, false);
  assert.equal(robots.follow, true);
  assert.equal(robots.googleBot?.index, false);
  assert.equal(robots.googleBot?.follow, true);
  assert.equal(notFoundPageMetadata.alternates?.canonical, null);

  const html = streamedNotFoundHead();
  assert.match(html, /<meta name="robots" content="noindex"\/>/);
  assert.match(html, /<meta name="robots" content="noindex, follow"\/>/);
  assert.match(html, /<meta name="googlebot" content="noindex, follow"\/>/);
  assert.doesNotMatch(html, /content="index, follow"/);
  assert.doesNotMatch(html, /rel="canonical"/);
  assert.doesNotMatch(html, new RegExp(HOMEPAGE.replace(/\./g, "\\.")));

  const notFound = readFileSync("app/not-found.tsx", "utf8");
  assert.match(notFound, /export const metadata: Metadata = notFoundPageMetadata/);
  const layout = readFileSync("app/layout.tsx", "utf8");
  assert.match(layout, /index: true/);
  assert.match(layout, /canonical: `\$\{resolveShareOrigin\(\)\}\/`/);
});

test("a confirmed missing profile keeps the 404 contract and a published profile stays indexable", () => {
  const page = readFileSync("app/contractors/[slug]/page.tsx", "utf8");
  assert.match(page, /title: "Contractor not found"/);
  assert.match(page, /robots: notFoundPageMetadata\.robots/);
  assert.match(page, /alternates: notFoundPageMetadata\.alternates/);
  assert.match(page, /if \(c === null\)/);
  assert.match(page, /if \(contractor === null\) notFound\(\)/);
  assert.match(
    page,
    /if \(isTransientProfileDbError\(e\) \|\| !isSoftProfileLookupError\(e\)\) throw e/,
  );
  assert.match(page, /return metadataAfterProfileLookupError\(error\)/);

  const profile = {
    id: "profile-test-id",
    slug: "b1-valid-regression-profile",
    displayName: "Valid Regression Profile",
    legalName: null,
    dbaName: null,
    primaryCity: null,
    primaryCounty: null,
    homeState: "FL",
    isThinProfile: true,
    licenses: [],
    entities: [],
    discipline: [],
  } satisfies ContractorDetail;
  const metadata = trustReportMetadata(profile);
  assert.deepEqual(metadata.robots, { index: true, follow: true });
  const canonical = String(
    (metadata.alternates as { canonical: string }).canonical,
  );
  assert.equal(
    canonical,
    absoluteUrl("/contractors/b1-valid-regression-profile"),
  );
  assert.notEqual(canonical, HOMEPAGE);
  assert.notEqual(canonical, `${HOMEPAGE}/`);
});

test("timeouts and database errors stay distinct from a confirmed 404", () => {
  const timeout = Object.assign(
    new Error("canceling statement due to statement timeout"),
    { code: "57014" },
  );
  assert.equal(isTransientProfileDbError(timeout), true);
  assert.throws(
    () => metadataAfterProfileLookupError(timeout),
    (error: unknown) => error === timeout,
  );

  const unavailable = Object.assign(new Error("connect ECONNREFUSED"), {
    code: "ECONNREFUSED",
  });
  const metadata = metadataAfterProfileLookupError(unavailable);
  assert.deepEqual(metadata.robots, { index: false, follow: true });
  assert.equal(metadata.alternates, undefined);
  assert.notEqual(metadata.title, "Page not found");
});
