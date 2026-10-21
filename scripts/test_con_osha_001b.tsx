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
  isPublicOshaDetailParentAllowed,
  encodeOshaInspectionCursor,
  decodeOshaInspectionCursor,
} from "../lib/osha/inspection-detail-adapter";
import {
  countKnownCitationItems,
  isPublicOshaDetailTier,
  sortOshaInspectionDetails,
  verifiedOshaInspectionUrl,
  formatOshaCitationStatus,
  formatOshaInspectionStatus,
} from "../lib/osha/inspection-details";
import { formatCurrentCitedPenalty, OSHA_LEGAL_DISCLAIMER, OSHA_MATCH_METHOD } from "../lib/osha/public-record";
import { toPublicOshaRecord } from "../lib/osha/public-record";
import { isOshaDetailEnabled } from "../lib/osha/flag";

const citedFixture = getOshaDetailPreviewFixture("public-citations");
const zeroFixture = getOshaDetailPreviewFixture("public-zero");
const manyFixture = getOshaDetailPreviewFixture("pagination-demo");

test("missing current penalty renders a dash while explicit zero renders $0", () => {
  assert.equal(formatCurrentCitedPenalty(null), "—");
  assert.equal(formatCurrentCitedPenalty(undefined), "—");
  assert.equal(formatCurrentCitedPenalty(0), "$0");
});

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
  assert.ok(page.inspections.every((item) => item.officialUrl === undefined));
  assert.ok(page.inspections.flatMap((item) => item.citations ?? []).every((item) => item.contestDate === undefined && item.finalOrderDate === undefined));
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
  assert.equal(zeroFixture.inspections[0].closeDate, undefined);
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
  assert.equal(verifiedOshaInspectionUrl(known), null);
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
    assert.equal(inspection.officialUrl, undefined);
    assert.ok(inspection.citations?.length);
    for (const citation of inspection.citations ?? []) {
      assert.ok(citation.standard);
      assert.ok(citation.citationType);
      assert.equal(typeof citation.currentPenalty, "number");
      assert.equal(citation.contestDate, undefined);
      assert.equal(citation.finalOrderDate, undefined);
    }
  }
  assert.ok(citedFixture.inspections.every((inspection) => verifiedOshaInspectionUrl(inspection) === null));
  assert.match(html, /Citations are allegations by OSHA and may be contested, reduced, or withdrawn\. A citation is not a final finding of violation\./);
  assert.doesNotMatch(html, /initial penalty|\b(violator|unsafe|bad contractor|score|rating|rank|grade)\b/i);
  assert.match(html, /This public example is not matched to a contractor\./);
  assert.doesNotMatch(html, new RegExp(OSHA_MATCH_METHOD.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(html, new RegExp(OSHA_LEGAL_DISCLAIMER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("detail feature flag defaults off and only enables on an explicit on value", () => {
  assert.equal(isOshaDetailEnabled({}), false);
  assert.equal(isOshaDetailEnabled({ CON_OSHA_001B_DETAIL: "" }), false);
  assert.equal(isOshaDetailEnabled({ CON_OSHA_001B_DETAIL: "true" }), true);
  assert.equal(isOshaDetailEnabled({ CON_OSHA_001B_DETAIL: "invalid" }), false);
  const loader = readFileSync("lib/osha/load-inspection-details.ts", "utf8") as string;
  const route = readFileSync("app/api/contractors/[contractorId]/osha-details/route.ts", "utf8") as string;
  assert.match(loader, /if \(!isOshaDetailEnabled\(\)\)/);
  assert.match(route, /if \(!isOshaDetailEnabled\(\)\).*404/s);
  assert.match(loader, /match_tier IN \('exact', 'strong'\)/);
  assert.match(loader, /OSHA_DETAIL_HELD_LICENSE_KEYS\.has\(`\$\{input\.state\}:\$\{input\.licenseKey\}`\)/);
  assert.match(loader, /id = \$1::uuid AND contractor_id = \$2::uuid AND state = \$3 AND license_key = \$4/);
  assert.match(loader, /contractor_osha_match_inspections b ON b\.inspection_id = i\.id/);
  assert.match(loader, /b\.public_match_id = \$1::uuid AND b\.contractor_id = \$2::uuid/);
  assert.match(loader, /activity_nr = ANY\(string_to_array/);
  assert.match(loader, /ORDER BY i\.open_date DESC NULLS LAST, i\.activity_nr DESC/);
  assert.match(loader, /LIMIT \$9/);
  assert.doesNotMatch(loader, /OFFSET/);
  assert.match(loader, /current_penalty: string \| number \| null; contest_date: string \| null/);
  assert.match(loader, /currentPenalty: citation\.current_penalty == null \? null : Number/);
  assert.match(loader, /to_char\(i\.open_date, 'YYYY-MM-DD'\) AS open_date/);
  assert.match(loader, /to_char\(c\.final_order_date, 'YYYY-MM-DD'\) AS final_order_date/);
  assert.doesNotMatch(loader, /initial_penalty|delete_flag|weak_match|contractor_osha_identity_review/);
  assert.doesNotMatch(loader, /informal settlement/i);
  assert.match(loader, /U: "Unclassified"/);
});

test("B2 held source mismatches keep aggregate cards but have no detail disclosure", () => {
  const recordSource = readFileSync("lib/osha/public-record.ts", "utf8") as string;
  const cardSource = readFileSync("components/contractor/OshaSafetyRecord.tsx", "utf8") as string;
  assert.match(recordSource, /OSHA_DETAIL_HELD_LICENSE_KEYS = new Set\(\["FL:CCC1329816", "FL:CGC1519699"\]\)/);
  assert.match(recordSource, /detailEligible: !OSHA_DETAIL_HELD_LICENSE_KEYS\.has\(`\$\{state\}:\$\{licenseKey\}`\)/);
  assert.match(cardSource, /detailEnabled && record\.detailEligible && contractorId/);
  const heldRecord = toPublicOshaRecord({
    id: "held-match", licenseKey: "CCC1329816", state: "FL", matchTier: "exact",
    nInspections: 36, firstOpen: "1984-01-01", lastOpen: "2026-01-01", nCitationItems: 0,
    nSerious: 0, currentPenalty: 0, nWithFinalOrder: 0, nContested: 0,
  });
  assert.ok(heldRecord);
  const html = renderToStaticMarkup(React.createElement(OshaSafetyRecord, {
    records: [heldRecord], contractorId: "contractor", detailEnabled: true, correctionHref: "/corrections",
  }));
  assert.match(html, /OSHA Safety Record/);
  assert.doesNotMatch(html, /aria-expanded|View inspection details/);
});

test("migration 019 accepts U and records held-source provenance without cascading", () => {
  const migration = readFileSync("schema/migrations/019_con_osha_001b_inspection_details.sql", "utf8") as string;
  assert.match(migration, /viol_type IN \('S', 'W', 'R', 'O', 'U'\)/);
  assert.match(migration, /held_license_keys TEXT\[\]/);
  assert.match(migration, /hold_reason TEXT/);
  assert.match(migration, /status TEXT NOT NULL DEFAULT 'received'/);
  assert.match(migration, /loaded_at TIMESTAMPTZ/);
  assert.doesNotMatch(migration, /ON DELETE CASCADE/i);
});

test("status wording uses only source dates and does not infer settlement or finality", () => {
  assert.equal(formatOshaCitationStatus({ contestDate: "2025-01-02", finalOrderDate: null }), "Contested");
  assert.equal(formatOshaCitationStatus({ contestDate: null, finalOrderDate: "2025-03-04" }), "Final order 2025-03-04");
  assert.equal(formatOshaCitationStatus({ contestDate: null, finalOrderDate: null }), null);
  assert.equal(formatOshaInspectionStatus({ closeDate: "2025-04-05" }), "Inspection closed 2025-04-05");
  assert.equal(formatOshaInspectionStatus({ closeDate: null }), null);
  const component = readFileSync("components/contractor/OshaInspectionDetails.tsx", "utf8") as string;
  assert.doesNotMatch(component, /informal settlement|Resolved|Final\s*\?/i);
});

test("detail parent scope permits exact/strong only and rejects profile or license mismatch", () => {
  const request = { publicMatchId: "m1", contractorId: "c1", state: "FL", licenseKey: "LIC-1" };
  const parent = { id: "m1", contractorId: "c1", state: "FL", licenseKey: "LIC-1", matchTier: "exact" };
  assert.equal(isPublicOshaDetailParentAllowed({ parent, request }), true);
  assert.equal(isPublicOshaDetailParentAllowed({ parent: { ...parent, matchTier: "strong" }, request }), true);
  assert.equal(isPublicOshaDetailParentAllowed({ parent: { ...parent, matchTier: "weak" }, request }), false);
  assert.equal(isPublicOshaDetailParentAllowed({ parent: { ...parent, contractorId: "c2" }, request }), false);
  assert.equal(isPublicOshaDetailParentAllowed({ parent: { ...parent, licenseKey: "LIC-2" }, request }), false);
  assert.equal(isPublicOshaDetailParentAllowed({ parent: null, request }), false);
});

test("inspection cursors encode the stable date and activity-number key", () => {
  const dated = { openDate: "2025-04-03", activityNumber: "123456789" };
  assert.deepEqual(decodeOshaInspectionCursor(encodeOshaInspectionCursor(dated)), dated);
  const nullDated = { openDate: null, activityNumber: "123456788" };
  assert.deepEqual(decodeOshaInspectionCursor(encodeOshaInspectionCursor(nullDated)), nullDated);
  assert.equal(decodeOshaInspectionCursor(null), null);
  assert.throws(() => decodeOshaInspectionCursor("garbage"), OshaDetailUnavailableError);
});

test("draft detail schema is restricted, scoped, and uses no cascades", () => {
  const migration = readFileSync("schema/migrations/019_con_osha_001b_inspection_details.sql", "utf8") as string;
  const rollback = readFileSync("schema/rollback/019_con_osha_001b_inspection_details.rollback.sql", "utf8") as string;
  for (const table of ["contractor_osha_inspections", "contractor_osha_citations", "contractor_osha_match_inspections", "osha_detail_load_receipts"]) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
    assert.match(migration, new RegExp(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`));
    assert.match(migration, new RegExp(`REVOKE ALL ON ${table} FROM PUBLIC`));
    assert.match(migration, new RegExp(`REVOKE ALL ON ${table} FROM anon`));
    assert.match(migration, new RegExp(`REVOKE ALL ON ${table} FROM authenticated`));
  }
  assert.doesNotMatch(migration, /ON DELETE CASCADE/i);
  assert.match(migration, /UNIQUE \(public_match_id, activity_nr\)/);
  assert.match(migration, /UNIQUE \(inspection_id, citation_id\)/);
  assert.match(migration, /activity_nr TEXT NOT NULL UNIQUE/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS contractor_osha_match_inspections/);
  assert.doesNotMatch(migration.match(/CREATE TABLE IF NOT EXISTS contractor_osha_inspections \(([\s\S]*?)\n\);/)?.[1] ?? "", /public_match_id/);
  assert.match(rollback, /DO NOT EXECUTE/);
  assert.doesNotMatch(rollback, /DROP TABLE[^\n]*CASCADE/i);
});
