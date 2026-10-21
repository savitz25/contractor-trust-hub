import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OshaSafetyRecord, OshaSafetyRecordPreviewCard } from "../components/contractor/OshaSafetyRecord";
import { getOshaDetailPreviewFixture } from "../data/preview/con-osha-001b-details";
import {
  buildPreviewOshaInspectionPage,
  buildUnmatchedPaginationDemoPage,
  buildVerifiedOshaInspectionPage,
  OshaDetailUnavailableError,
} from "../lib/osha/inspection-detail-adapter";
import {
  countKnownCitationItems,
  isPublicOshaDetailTier,
  sortOshaInspectionDetails,
  verifiedOshaInspectionUrl,
} from "../lib/osha/inspection-details";
import { OSHA_LEGAL_DISCLAIMER, OSHA_MATCH_METHOD } from "../lib/osha/public-record";

const citedFixture = getOshaDetailPreviewFixture("public-citations");
const zeroFixture = getOshaDetailPreviewFixture("public-zero");
const manyFixture = getOshaDetailPreviewFixture("pagination-demo");

function renderPreview(fixtureId: string) {
  const fixture = getOshaDetailPreviewFixture(fixtureId);
  assert.ok(fixture?.summary);
  return renderToStaticMarkup(
    React.createElement(OshaSafetyRecordPreviewCard, {
      fixtureId,
      identityLabel: fixture.identityLabel,
      summary: fixture.summary,
      currentPenalty: fixture.currentPenalty ?? 0,
      correctionHref: "/corrections?slug=osha-preview-fixture&license=preview",
    }),
  );
}

test("collapsed production card keeps its server summary and has no unsupported detail affordance", () => {
  const record = {
    licenseKey: "CGC011008",
    state: "FL" as const,
    matchTier: "exact" as const,
    nInspections: 2,
    firstOpen: "1995-08-10",
    lastOpen: "2002-03-22",
    nCitationItems: 5,
    nSerious: 3,
    currentPenalty: 11750,
    nWithFinalOrder: 5,
    nContested: 5,
    summary: "2 OSHA inspections (1995?2002) ? 5 cited items ? 3 serious",
    penaltyLabel: "Cited penalty (current)" as const,
    inspectionList: "blocked" as const,
  };
  const html = renderToStaticMarkup(
    React.createElement(OshaSafetyRecord, {
      records: [record],
      correctionHref: "/corrections?slug=fixture&license=CGC011008",
    }),
  );
  assert.ok(html.includes(record.summary));
  assert.match(html, /Cited penalty \(current\)[\s\S]*\$11,750/);
  assert.match(html, /Citations are allegations by OSHA and may be contested, reduced, or withdrawn\. A citation is not a final finding of violation\./);
  assert.match(html, /Matched to this business by name and location from public OSHA records\./);
  assert.match(html, /Report an error/);
  assert.doesNotMatch(html, /osha-details-toggle|aria-expanded|fetch\(/);
});

test("the preview detail button is a native accessible button with a visible focus and 44px target", () => {
  assert.ok(citedFixture?.summary);
  const html = renderPreview("public-citations");
  assert.match(html, /<button[^>]+type="button"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /aria-controls="[^"]+"/);
  assert.match(html, /min-h-11/);
  assert.match(html, /focus-visible:outline/);
  assert.match(html, /View inspection details/);
  assert.ok(html.includes(citedFixture.summary ?? ""));
  assert.match(html, /Cited penalty \(current\)[\s\S]*\$18,000/);
  assert.match(html, /hidden=""/);
});

test("verified detail fixtures are newest-first, unique, and reconcile with aggregate citation counts", () => {
  assert.ok(citedFixture);
  const count = countKnownCitationItems(citedFixture.inspections);
  assert.equal(count, 5);
  const page = buildPreviewOshaInspectionPage({
    inspections: citedFixture.inspections,
    expectedCitationItems: citedFixture.aggregateCitationItems ?? -1,
  });
  assert.deepEqual(page.inspections.map((item) => item.activityNumber), ["1334666.015", "311401533"]);
  assert.equal(page.totalInspections, 2);
  assert.equal(page.reconciliation?.expectedCitationItems, 5);
  assert.equal(page.reconciliation?.detailCitationItems, 5);
  assert.equal(new Set(page.inspections.map((item) => item.activityNumber)).size, 2);
  assert.equal(page.inspections[0].citations?.filter((citation) => citation.citationType === "Repeat").length, 1);
  assert.equal(page.inspections[1].citations?.filter((citation) => citation.citationType === "Serious").length, 2);
  assert.ok(page.inspections.every((item) => item.officialStatus));
  assert.ok(page.inspections.flatMap((item) => item.citations ?? []).every((item) => item.officialStatus));
});

test("only an official verified zero-citation inspection renders the zero-citation state", () => {
  assert.ok(zeroFixture);
  const count = countKnownCitationItems(zeroFixture.inspections);
  assert.equal(count, 0);
  const page = buildPreviewOshaInspectionPage({
    inspections: zeroFixture.inspections,
    expectedCitationItems: zeroFixture.aggregateCitationItems ?? -1,
  });
  assert.deepEqual(page.inspections[0].citations, []);
  assert.deepEqual(zeroFixture.inspections[0].citations, []);
  assert.equal(zeroFixture.inspections[0].officialStatus, "Case closed: 03/13/2001");
  assert.equal(manyFixture?.inspections.some((inspection) => inspection.citations === null), true);
});

test("detail pages are bounded to ten and Show more receives the next newest-first page", () => {
  assert.ok(manyFixture);
  const first = buildUnmatchedPaginationDemoPage({ inspections: manyFixture.inspections });
  assert.equal(first.inspections.length, 10);
  assert.equal(first.totalInspections, 11);
  assert.equal(first.nextCursor, "10");
  assert.deepEqual(first.inspections.map((item) => item.openDate), [...first.inspections.map((item) => item.openDate)].sort().reverse());
  const second = buildUnmatchedPaginationDemoPage({ inspections: manyFixture.inspections, cursor: first.nextCursor });
  assert.equal(second.inspections.length, 1);
  assert.equal(second.nextCursor, null);
  assert.equal(new Set([...first.inspections, ...second.inspections].map((item) => item.activityNumber)).size, 11);
  assert.equal(first.reconciliation, null);
});

test("weak or unmatched tiers and inconsistent detail fail closed", () => {
  assert.equal(isPublicOshaDetailTier("exact"), true);
  assert.equal(isPublicOshaDetailTier("strong"), true);
  assert.equal(isPublicOshaDetailTier("weak"), false);
  assert.equal(isPublicOshaDetailTier("unmatched"), false);
  assert.throws(
    () => buildVerifiedOshaInspectionPage({
      matchTier: "weak",
      inspections: citedFixture?.inspections ?? [],
      expectedCitationItems: 5,
    }),
    OshaDetailUnavailableError,
  );
  assert.throws(
    () => buildPreviewOshaInspectionPage({
      inspections: citedFixture?.inspections ?? [],
      expectedCitationItems: 6,
    }),
    (error: unknown) => error instanceof OshaDetailUnavailableError && error.reason === "reconciliation_failed",
  );
  assert.throws(
    () => buildPreviewOshaInspectionPage({
      inspections: [{ ...(citedFixture?.inspections[0] as object), citations: null } as never],
      expectedCitationItems: 0,
    }),
    (error: unknown) => error instanceof OshaDetailUnavailableError && error.reason === "reconciliation_failed",
  );
});

test("verified OSHA links are exact trusted source URLs, not guessed from activity numbers", () => {
  assert.ok(citedFixture);
  const known = citedFixture.inspections[0];
  assert.equal(verifiedOshaInspectionUrl(known), known.officialUrl);
  assert.equal(
    verifiedOshaInspectionUrl({ ...known, officialUrl: `https://evil.example/ords/imis/establishment.inspection_detail?id=${known.activityNumber}` }),
    null,
  );
  assert.equal(
    verifiedOshaInspectionUrl({ ...known, officialUrl: `http://www.osha.gov/ords/imis/establishment.inspection_detail?id=${known.activityNumber}` }),
    null,
  );
  assert.equal(
    verifiedOshaInspectionUrl({ ...known, officialUrl: "https://www.osha.gov/ords/imis/establishment.inspection_detail" }),
    null,
  );
  assert.equal(verifiedOshaInspectionUrl({ ...known, officialUrl: undefined }), null);
});

test("failure and retry copy preserve the summary and correction path", () => {
  assert.ok(citedFixture);
  const html = renderPreview("load-failure");
  assert.ok(html.includes(citedFixture.summary ?? ""));
  assert.match(html, /Cited penalty \(current\)[\s\S]*\$18,000/);
  assert.match(html, /Report an error/);
  assert.match(html, /aria-expanded="false"/);
  const client = readFileSync("components/contractor/OshaInspectionDetails.tsx", "utf8") as string;
  assert.match(client, /Inspection details are temporarily unavailable\./);
  assert.match(client, /data-testid="osha-details-retry"/);
  assert.match(client, /Retry/);
});

test("no-match has no card and preview detail API is protected, noindex, and not a production query", () => {
  const api = readFileSync("app/api/preview/osha-safety-record/[sample]/details/route.ts", "utf8") as string;
  const route = readFileSync("app/preview/osha-safety-record/page.tsx", "utf8") as string;
  const sitemap = readFileSync("lib/seo/sitemap-data.ts", "utf8") as string;
  assert.match(api, /oshaPreviewShowcaseAllowed/);
  assert.match(api, /X-Robots-Tag/);
  assert.doesNotMatch(api, /@\/lib\/db|from \"@\/lib\/db\"|contractor_osha_/);
  assert.doesNotMatch(route, /\/api\/osha\/details|loadPublicOshaInspectionDetails/);
  assert.doesNotMatch(sitemap, /osha-safety-record/);
  assert.match(route, /sampleId === OSHA_NO_MATCH_FIXTURE\.fixtureId[\s\S]*\? \[\]/);
  assert.match(route, /sampleId === \"weak-match\"[\s\S]*\? \[\]/);
});

test("source adapter keeps only supported display fields and excludes initial penalty and prohibited language", () => {
  assert.ok(citedFixture);
  const html = renderPreview("public-citations");
  for (const inspection of citedFixture.inspections) {
    assert.ok(inspection.officialUrl);
    assert.ok(inspection.citations?.length);
    for (const citation of inspection.citations ?? []) {
      assert.ok(citation.standard);
      assert.ok(citation.citationType);
      assert.equal(typeof citation.currentPenalty, "number");
      assert.ok(citation.officialStatus);
    }
  }
  assert.ok(citedFixture.inspections.every((inspection) => verifiedOshaInspectionUrl(inspection)));
  assert.match(html, /Citations are allegations by OSHA and may be contested, reduced, or withdrawn\. A citation is not a final finding of violation\./);
  assert.doesNotMatch(html, /initial penalty|\b(violator|unsafe|bad contractor|score|rating|rank|grade)\b/i);
  assert.match(html, /This public example is not matched to a contractor\./);
  assert.doesNotMatch(html, new RegExp(OSHA_MATCH_METHOD.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(html, new RegExp(OSHA_LEGAL_DISCLAIMER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
