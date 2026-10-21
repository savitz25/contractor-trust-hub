/**
 * CON-OSHA-001: OSHA profile card, flag, and draft schema.
 * Inspection rows are blocked because the handoff has license totals only.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OshaSafetyRecord } from "../components/contractor/OshaSafetyRecord";
import { OSHA_PREVIEW_SAMPLES, previewRecord } from "../data/preview/con-osha-001-fixtures";
import { isOshaProfileEnabled, oshaPreviewShowcaseAllowed, OSHA_PROFILE_FLAG } from "../lib/osha/flag";
import {
  formatOshaSummary,
  loadPublicOshaMatches,
  OSHA_LEGAL_DISCLAIMER,
  OSHA_MATCH_METHOD,
  OSHA_PENALTY_LABEL,
  PUBLIC_OSHA_MATCH_SQL,
  toPublicOshaRecord,
  type OshaPublicRecord,
} from "../lib/osha/public-record";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

function render(record: OshaPublicRecord | null, href = "/corrections?slug=cbc015082&license=CBC015082") {
  if (!record) return renderToStaticMarkup(React.createElement(OshaSafetyRecord, { records: [], correctionHref: href }));
  return renderToStaticMarkup(
    React.createElement(OshaSafetyRecord, { records: [record], correctionHref: href }),
  );
}

const exact = previewRecord("fl-exact-multi");
const strong = previewRecord("fl-strong-multi");
const singleYear = previewRecord("fl-exact-single-year");
const njExact = previewRecord("nj-exact-multi");
const njContest = previewRecord("nj-strong-contest-same-year");

test("exact and strong public fixtures render named license totals", () => {
  assert.ok(exact && strong && njExact);
  const html = render(exact);
  assert.match(html, /OSHA Safety Record/);
  assert.match(html, /Florida license CGC011008/);
  assert.match(html, /2 OSHA inspections \(1995\u20132002\) · 5 cited items · 3 serious/);
  assert.match(html, /data-osha-license="CGC011008"/);
  assert.match(render(strong), /Florida license CUC056822/);
  assert.match(render(strong), /3 OSHA inspections \(1985\u20132009\)/);
  assert.match(render(njExact), /New Jersey license 13VH05973500/);
});

test("weak and no-match render nothing", () => {
  assert.equal(
    toPublicOshaRecord({
      ...OSHA_PREVIEW_SAMPLES[0].source,
      matchTier: "weak",
    }),
    null,
  );
  assert.equal(render(null), "");
  assert.equal(previewRecord("missing"), null);
});

test("single year does not become a range and missing dates invent nothing", () => {
  assert.ok(singleYear && njContest);
  assert.match(render(singleYear), /1 OSHA inspection \(2024\) · 0 cited items · 0 serious/);
  assert.doesNotMatch(render(singleYear), /2024\u2013/);
  assert.match(render(njContest), /2 OSHA inspections \(1977\)/);
  const undated = toPublicOshaRecord({
    ...OSHA_PREVIEW_SAMPLES[0].source,
    firstOpen: null,
    lastOpen: null,
  });
  assert.ok(undated);
  assert.equal(undated.summary, "2 OSHA inspections · 5 cited items · 3 serious");
  assert.equal(formatOshaSummary(1, "not-a-date", "not-a-date", 0, 0).includes("("), false);
});

test("flag off performs no OSHA query and invalid config fails closed", async () => {
  assert.equal(isOshaProfileEnabled({}), false);
  assert.equal(isOshaProfileEnabled({ [OSHA_PROFILE_FLAG]: "maybe" }), false);
  assert.equal(isOshaProfileEnabled({ [OSHA_PROFILE_FLAG]: "off" }), false);
  let calls = 0;
  const off = await loadPublicOshaMatches(
    { contractorId: "c-1", homeState: "FL", licenseKeys: ["CGC011008"] },
    {
      enabled: false,
      query: async () => {
        calls += 1;
        return [];
      },
    },
  );
  assert.equal(off.queryCount, 0);
  assert.equal(calls, 0);
  assert.equal(off.records, null);
  const page = read("app/contractors/[slug]/page.tsx");
  assert.match(page, /isOshaProfileEnabled\(\)/);
  const loader = read("lib/osha/load-public-record.ts");
  assert.match(loader, /if \(!isOshaProfileEnabled\(\)\) return null/);
});

test("public query is exact or strong on the profile table only", async () => {
  assert.match(PUBLIC_OSHA_MATCH_SQL, /contractor_osha_license_matches/);
  assert.match(PUBLIC_OSHA_MATCH_SQL, /match_tier IN \('exact', 'strong'\)/);
  assert.doesNotMatch(PUBLIC_OSHA_MATCH_SQL, /contractor_osha_identity_review/);
  assert.doesNotMatch(PUBLIC_OSHA_MATCH_SQL, /initial_penalty/);
  assert.doesNotMatch(PUBLIC_OSHA_MATCH_SQL, /osha_activity_nrs/);
  let sql = "";
  const result = await loadPublicOshaMatches(
    { contractorId: "c-1", homeState: "FL", licenseKeys: ["CGC011008", "WEAK1"] },
    {
      enabled: true,
      query: async (text) => {
        sql = text;
        return [
          {
            license_key: "CGC011008",
            state: "FL",
            match_tier: "exact",
            n_inspections: 2,
            first_open: "1995-08-10",
            last_open: "2002-03-22",
            n_citation_items: 5,
            n_serious: 3,
            current_penalty_amount: 11750,
            n_with_final_order: 5,
            n_contested: 5,
          },
          {
            license_key: "WEAK1",
            state: "FL",
            match_tier: "weak",
            n_inspections: 4,
            first_open: "2000-01-01",
            last_open: "2001-01-01",
            n_citation_items: 1,
            n_serious: 1,
            current_penalty_amount: 10,
            n_with_final_order: 1,
            n_contested: 1,
          },
        ];
      },
    },
  );
  assert.match(sql, /match_tier IN \('exact', 'strong'\)/);
  assert.equal(result.queryCount, 1);
  assert.equal(result.records?.length, 1);
  assert.equal(result.records?.[0].licenseKey, "CGC011008");
  const idle = await loadPublicOshaMatches(
    { contractorId: "c-1", homeState: "TX", licenseKeys: ["CGC011008"] },
    { enabled: true, query: async () => [] },
  );
  assert.equal(idle.queryCount, 0);
});

test("penalty, disclaimer, correction link, and prohibited language", () => {
  const html = render(exact, "/corrections?slug=fixture&license=CGC011008");
  assert.equal(html.includes(OSHA_PENALTY_LABEL), true);
  assert.match(html, /\$11,750/);
  assert.equal(html.includes(OSHA_LEGAL_DISCLAIMER), true);
  assert.equal(html.includes(OSHA_MATCH_METHOD), true);
  assert.match(html, /href="\/corrections\?slug=fixture&amp;license=CGC011008"/);
  assert.match(html, /Report an error/);
  assert.doesNotMatch(html, /initial penalty/i);
  assert.doesNotMatch(html, /\$67,315,136|initial_penalty/);
  assert.doesNotMatch(html, /\bviolator\b/i);
  assert.doesNotMatch(html, /\bunsafe\b/i);
  assert.doesNotMatch(html, /\b(score|rating|ranking|rank|grade)\b/i);
  assert.doesNotMatch(html, /osha\.gov|establishment\.inspection_detail/);
  assert.doesNotMatch(html, /href="https?:/);
});

test("aggregate card has no inspection expansion or source-gap copy", () => {
  assert.ok(exact);
  const html = render(exact);
  const card = read("components/contractor/OshaSafetyRecord.tsx");
  const preview = read("app/preview/osha-safety-record/page.tsx");
  const aside = html.replace(OSHA_LEGAL_DISCLAIMER, "");
  assert.match(html, /2 OSHA inspections \(1995\u20132002\)/);
  assert.doesNotMatch(html, /<details|<summary/);
  assert.doesNotMatch(html, /Inspection list blocked/);
  assert.doesNotMatch(html, /handoff|activity number|inspection link/i);
  assert.doesNotMatch(html, /1995-08-10|2002-03-22/);
  assert.doesNotMatch(html, /osha\.gov|establishment\.inspection_detail/);
  assert.doesNotMatch(aside, /contest/i);
  assert.doesNotMatch(aside, /final[- ]order/i);
  assert.doesNotMatch(card, /Inspection list blocked|<details|<summary|handoff|nContested|nWithFinalOrder/);
  assert.match(preview, /Inspection-level details are not included in the current source handoff/);
  assert.match(preview, /data-testid="osha-preview-source-limit"/);
  assert.doesNotMatch(card, /data-testid="osha-preview-source-limit"/);
  assert.doesNotMatch(card, /matchMedia|useMediaQuery/);
  assert.match(card, /overflow-x-hidden/);
  for (const sample of OSHA_PREVIEW_SAMPLES) {
    assert.match(sample.scenario, /aggregate totals/);
    assert.match(sample.scenario, /Public-data fixture/);
    assert.doesNotMatch(sample.scenario, /inspection row|inspection detail|verified inspection/i);
  }
});

test("draft schema does not invent inspections or delete contractors", () => {
  const migration = read("schema/migrations/018_con_osha_001_osha_safety_record.sql");
  const rollback = read("schema/rollback/018_con_osha_001_osha_safety_record.rollback.sql");
  assert.match(migration, /DO NOT EXECUTE/);
  assert.match(migration, /CHECK \(match_tier IN \('exact', 'strong'\)\)/);
  assert.match(migration, /CHECK \(match_tier = 'weak'\)/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL ON contractor_osha_license_matches FROM anon/);
  assert.match(migration, /ON DELETE RESTRICT/);
  assert.match(migration, /osha_load_receipts/);
  assert.match(migration, /REFERENCES ingest_batches/);
  assert.doesNotMatch(migration, /ON DELETE CASCADE/);
  assert.doesNotMatch(migration, /CREATE TABLE[^;]*contractor_osha_inspections/i);
  assert.doesNotMatch(migration, /INSERT INTO contractors/i);
  assert.match(rollback, /DO NOT EXECUTE/);
  assert.match(rollback, /DELETE FROM contractor_osha_license_matches/);
  assert.doesNotMatch(rollback, /DELETE FROM contractors/i);
  const loader = read("lib/osha/load-public-record.ts");
  assert.doesNotMatch(loader, /INSERT INTO contractors/i);
});

test("preview showcase cannot resolve in production and is not a public route", () => {
  assert.equal(oshaPreviewShowcaseAllowed({ VERCEL_ENV: "production", NODE_ENV: "development" }), false);
  assert.equal(oshaPreviewShowcaseAllowed({ NODE_ENV: "production" }), false);
  assert.equal(oshaPreviewShowcaseAllowed({ NODE_ENV: "development" }), true);
  assert.equal(oshaPreviewShowcaseAllowed({ VERCEL_ENV: "preview", NODE_ENV: "production" }), true);
  const preview = read("app/preview/osha-safety-record/page.tsx");
  assert.match(preview, /oshaPreviewShowcaseAllowed/);
  assert.match(preview, /notFound\(\)/);
  assert.match(preview, /index: false/);
  const sitemap = read("lib/seo/sitemap-data.ts");
  assert.doesNotMatch(sitemap, /osha-safety-record/);
  assert.equal(OSHA_PREVIEW_SAMPLES.filter((sample) => sample.state === "FL").length, 3);
  assert.equal(OSHA_PREVIEW_SAMPLES.filter((sample) => sample.state === "NJ").length, 3);
  assert.equal(OSHA_PREVIEW_SAMPLES.some((sample) => sample.matchTier === "weak"), false);
});

function localDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

function dbRow(overrides: Record<string, unknown> = {}) {
  return {
    license_key: "CGC011008",
    state: "FL",
    match_tier: "exact",
    n_inspections: 2,
    first_open: "1995-08-10",
    last_open: "2002-03-22",
    n_citation_items: 5,
    n_serious: 3,
    current_penalty_amount: 11750,
    n_with_final_order: 5,
    n_contested: 5,
    ...overrides,
  };
}

async function loadRows(rows: Record<string, unknown>[]) {
  let calls = 0;
  const result = await loadPublicOshaMatches(
    { contractorId: "c-1", homeState: "FL", licenseKeys: ["CGC011008"] },
    {
      enabled: true,
      query: async () => {
        calls += 1;
        return rows;
      },
    },
  );
  assert.equal(calls, result.queryCount);
  return result;
}

test("postgres DATE objects become calendar days and the card still renders", async () => {
  const result = await loadRows([
    dbRow({
      first_open: localDate(1995, 8, 10),
      last_open: localDate(2002, 3, 22),
    }),
  ]);
  assert.equal(result.queryCount, 1);
  assert.equal(result.records?.length, 1);
  const record = result.records?.[0];
  assert.ok(record);
  assert.equal(record.matchTier, "exact");
  assert.equal(record.firstOpen, "1995-08-10");
  assert.equal(record.lastOpen, "2002-03-22");
  assert.match(record.summary, /1995\u20132002/);
  const html = render(record);
  assert.match(html, /OSHA Safety Record/);
  assert.match(html, /2 OSHA inspections \(1995\u20132002\)/);
  assert.match(html, /data-osha-license="CGC011008"/);
});

test("ISO string dates stay YYYY-MM-DD", async () => {
  const result = await loadRows([dbRow()]);
  assert.equal(result.queryCount, 1);
  assert.equal(result.records?.[0].firstOpen, "1995-08-10");
  assert.equal(result.records?.[0].lastOpen, "2002-03-22");
  assert.match(result.records?.[0].summary ?? "", /1995\u20132002/);
});

test("null postgres dates keep the aggregate and invent no year", async () => {
  const result = await loadRows([dbRow({ first_open: null, last_open: null })]);
  const record = result.records?.[0];
  assert.ok(record);
  assert.equal(record.firstOpen, null);
  assert.equal(record.lastOpen, null);
  assert.equal(record.summary, "2 OSHA inspections · 5 cited items · 3 serious");
  assert.doesNotMatch(record.summary, /\(|\d{4}/);
});

test("an invalid Date object fails closed without dropping the record", async () => {
  const result = await loadRows([
    dbRow({ first_open: new Date(NaN), last_open: new Date(NaN) }),
  ]);
  const record = result.records?.[0];
  assert.ok(record);
  assert.equal(record.firstOpen, null);
  assert.equal(record.lastOpen, null);
  assert.equal(record.summary, "2 OSHA inspections · 5 cited items · 3 serious");
  assert.equal(String(new Date(NaN)).includes("Invalid Date"), true);
  assert.doesNotMatch(record.summary, /Invalid Date/);
});

test("a malformed date string fails closed without dropping the record", async () => {
  const result = await loadRows([
    dbRow({ first_open: "not-a-date", last_open: "08/10/1995" }),
  ]);
  const record = result.records?.[0];
  assert.ok(record);
  assert.equal(record.firstOpen, null);
  assert.equal(record.lastOpen, null);
  assert.doesNotMatch(record.summary, /\(|1995|08\/10/);
});

test("one invalid date endpoint does not invent a range", async () => {
  const result = await loadRows([
    dbRow({ first_open: localDate(1995, 8, 10), last_open: new Date(NaN) }),
  ]);
  const record = result.records?.[0];
  assert.ok(record);
  assert.equal(record.firstOpen, "1995-08-10");
  assert.equal(record.lastOpen, null);
  assert.equal(record.summary, "2 OSHA inspections · 5 cited items · 3 serious");
  assert.doesNotMatch(record.summary, /1995|\u2013|\(/);
});

test("a weak match stays excluded when its dates are Date objects", async () => {
  const result = await loadRows([
    dbRow({
      license_key: "WEAK1",
      match_tier: "weak",
      first_open: localDate(2000, 1, 1),
      last_open: localDate(2001, 1, 1),
    }),
  ]);
  assert.equal(result.queryCount, 1);
  assert.equal(result.records, null);
});

test("public SQL projects DATE columns as YYYY-MM-DD text", () => {
  assert.match(PUBLIC_OSHA_MATCH_SQL, /to_char\(first_open, 'YYYY-MM-DD'\) AS first_open/);
  assert.match(PUBLIC_OSHA_MATCH_SQL, /to_char\(last_open, 'YYYY-MM-DD'\) AS last_open/);
  assert.doesNotMatch(PUBLIC_OSHA_MATCH_SQL, /,\s*first_open\s*,/);
  assert.doesNotMatch(PUBLIC_OSHA_MATCH_SQL, /,\s*last_open\s*,/);
  assert.doesNotMatch(read("lib/osha/public-record.ts"), /as string \| null/);
  const migration = read("schema/migrations/018_con_osha_001_osha_safety_record.sql");
  assert.match(migration, /first_open\s+DATE/);
  assert.match(migration, /last_open\s+DATE/);
});

test("profile loader keeps an exact record when dates arrive as Date objects", { timeout: 120_000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), "osha-date-"));
  const script = join(dir, "loader.mts");
  writeFileSync(
    script,
    `
import { mock } from "node:test";

mock.module("@/lib/db", {
  namedExports: {
    query: async () => [
      {
        license_key: "CGC011008",
        state: "FL",
        match_tier: "exact",
        n_inspections: 2,
        first_open: new Date(1995, 7, 10),
        last_open: new Date(2002, 2, 22),
        n_citation_items: 5,
        n_serious: 3,
        current_penalty_amount: 11750,
        n_with_final_order: 5,
        n_contested: 5,
      },
    ],
  },
});

const mod = await import(${JSON.stringify(pathToFileURL(join(root, "lib/osha/load-public-record.ts")).href)});
const records = await mod.loadPublicOshaSafetyRecord({
  contractorId: "c-1",
  homeState: "FL",
  licenseKeys: ["CGC011008"],
});
console.log(JSON.stringify({
  count: records?.length ?? 0,
  firstOpen: records?.[0]?.firstOpen ?? null,
  lastOpen: records?.[0]?.lastOpen ?? null,
  summary: records?.[0]?.summary ?? null,
  tier: records?.[0]?.matchTier ?? null,
}));
`,
  );
  try {
    const result = spawnSync(
      "npx --yes tsx --conditions=react-server --experimental-test-module-mocks \"" + script + "\"",
      {
        cwd: root,
        encoding: "utf8",
        shell: true,
        env: { ...process.env, CON_OSHA_001_PROFILE: "1" },
      },
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.doesNotMatch(result.stderr || "", /public read failed|trim is not a function/);
    const line = (result.stdout || "").trim().split(/\r?\n/).filter((item) => item.startsWith("{")).at(-1);
    assert.ok(line, result.stdout);
    const parsed = JSON.parse(line) as {
      count: number;
      firstOpen: string | null;
      lastOpen: string | null;
      summary: string | null;
      tier: string | null;
    };
    assert.equal(parsed.count, 1);
    assert.equal(parsed.tier, "exact");
    assert.equal(parsed.firstOpen, "1995-08-10");
    assert.equal(parsed.lastOpen, "2002-03-22");
    assert.match(parsed.summary ?? "", /1995\u20132002/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
