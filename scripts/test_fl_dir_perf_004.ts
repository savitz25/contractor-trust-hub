/**
 * FL-DIR-PERF-004: county listings collect license ids through existing
 * indexes, then recheck the original WHERE clause. Results stay identical.
 *
 * Default mode (no database): source and key guards.
 * FL_DIR_PERF_DB=parity against the disposable fixture
 * (scripts/fl_dir_perf_004/fixture.sql): old-vs-new parity and a plain EXPLAIN.
 * Never a shared or production database.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { parseBrowseParams } from "../lib/discovery/browse";
import { getCounty, getDiscoveryState } from "../lib/discovery/config";
import {
  floridaBrowseStatement,
  floridaCitiesStatement,
  floridaCountyCodeEqualityKeys,
  floridaCountyCodeStoredKeys,
  floridaCountyCodesArePlainNumeric,
  floridaCountyNameKeys,
  listFloridaBrowse,
  listFloridaCitiesChecked,
} from "../lib/discovery/florida-list";
import type { TradeDef } from "../lib/discovery/types";
import { query } from "../lib/db";

const mode = process.env.FL_DIR_PERF_DB || "unreachable";
if (mode !== "parity") {
  process.env.DATABASE_URL = "postgres://fl_dir_perf_test@127.0.0.1:9/postgres_unreachable";
}

const state = getDiscoveryState("florida");
assert.ok(state);
const county = (slug: string) => {
  const found = getCounty(state, slug);
  assert.ok(found, slug);
  return found;
};
const browse = (sp: Record<string, string> = {}) => parseBrowseParams(sp);
const specialty: TradeDef = {
  slug: "roof-specialty",
  label: "Roof specialty",
  title: "Roof specialty",
  description: "synthetic",
  occupationCodes: ["CCC"],
  classCodes: ["SPC"],
  descriptionIncludes: ["shingle"],
};
const ccc: TradeDef = {
  slug: "ccc-only",
  label: "CCC",
  title: "CCC",
  description: "synthetic",
  occupationCodes: ["CCC"],
};
const roofers: TradeDef = {
  slug: "roofers",
  label: "Roofers",
  title: "Roofers",
  description: "synthetic",
  occupationCodes: ["CCC", "RC"],
};

test("county name keys cover space and hyphen forms, including aliases", () => {
  const miami = floridaCountyNameKeys(["Miami-Dade", "Miami Dade", "Dade"]);
  for (const key of ["miami-dade", "miami dade", "dade"]) assert.ok(miami.includes(key), key);
  const indian = floridaCountyNameKeys(["Indian River"]);
  assert.deepEqual(indian.sort(), ["indian river", "indian-river"]);
});

test("plain numeric county codes are required for the indexed lookup", () => {
  assert.equal(floridaCountyCodesArePlainNumeric(["58", "058"]), true);
  assert.equal(floridaCountyCodesArePlainNumeric([]), true);
  assert.equal(floridaCountyCodesArePlainNumeric(["58", "5A"]), false);
  const keys = floridaCountyCodeEqualityKeys(["58"]);
  for (const key of ["58", "058", "0058", "00058", "00000000058"]) assert.ok(keys.includes(key), key);
  assert.equal(keys.includes(" 58 "), false);
  assert.equal(keys.includes("58 "), false);
  const stored = floridaCountyCodeStoredKeys(["58"]);
  for (const key of ["58", "0058", " 58 ", "58 ", " 0058 ", "  58", "00000000058", " 00000000058 "]) {
    assert.ok(stored.includes(key), key);
  }
  assert.equal(stored.includes("580"), false);
  assert.equal(stored.includes("   58"), false);
});

test("source: queries.ts is unchanged and a non-numeric code keeps the old join", () => {
  const queries = readFileSync("lib/discovery/queries.ts", "utf8");
  assert.doesNotMatch(queries, /county_license_ids/);
  assert.equal(existsSync("lib/discovery/florida-county-prefetch.ts"), false);
  const orange = floridaBrowseStatement({ county: county("orange"), browse: browse() }, "auto");
  assert.ok(orange);
  assert.equal(orange.prefetch, true);
  assert.match(orange.sql, /county_license_ids AS MATERIALIZED/);
  assert.match(orange.sql, /LOWER\(TRIM\(l\.county_name\)\) = ANY/);
  assert.match(orange.sql, /l\.county_code = ANY/);
  assert.doesNotMatch(orange.sql, /LIKE/);
  assert.match(orange.sql, /LOWER\(TRIM\(c\.primary_county\)\) = ANY/);
  assert.match(orange.sql, /LOWER\(TRIM\(COALESCE\(l\.county_name, ''\)\)\)/);
  assert.equal((orange.sql.match(/\bFROM licenses\b/g) || []).length, 2);
  const bound = JSON.stringify(orange.params);
  for (const key of ["0058", " 58 ", "58 ", " 0058 ", "00000000058"]) {
    assert.ok(bound.includes(JSON.stringify(key)), key);
  }
  assert.equal(bound.includes(JSON.stringify("580")), false);
  assert.equal(bound.includes(JSON.stringify(" 23 ")), false);
  const roofers = floridaBrowseStatement(
    {
      county: county("orange"),
      trade: { slug: "roofers", label: "Roofers", title: "Roofers", description: "synthetic", occupationCodes: ["CCC", "RC"] },
      browse: browse(),
    },
    "auto",
  );
  assert.ok(roofers);
  const cte = roofers.sql.slice(0, roofers.sql.indexOf("matched AS"));
  assert.match(cte, /l\.occupation_code = ANY/);
  assert.match(cte, /l\.source_system = \$1/);
  assert.equal((roofers.sql.match(/\bFROM licenses\b/g) || []).length, 2);
  const legacy = floridaBrowseStatement({ county: county("orange"), browse: browse() }, "legacy");
  assert.ok(legacy);
  assert.equal(legacy.prefetch, false);
  assert.doesNotMatch(legacy.sql, /county_license_ids/);
  const odd = floridaBrowseStatement(
    {
      county: { slug: "odd", name: "Odd", matchNames: ["Odd"], matchCodes: ["5A"] },
      browse: browse(),
    },
    "auto",
  );
  assert.ok(odd);
  assert.equal(odd.prefetch, false);
  assert.match(odd.sql, /FROM contractors c/);
  const cities = floridaCitiesStatement(county("orange"), null, "auto");
  assert.ok(cities?.prefetch);
  assert.match(cities.sql, /county_license_ids AS MATERIALIZED/);
});

async function signature(
  kind: "browse" | "cities",
  readMode: "auto" | "legacy",
  args: { countySlug: string; trade?: TradeDef | null; sp?: Record<string, string> },
) {
  const selected = county(args.countySlug);
  if (kind === "cities") {
    const result = await listFloridaCitiesChecked(selected, args.trade ?? null, readMode);
    assert.equal(result.ok, true);
    return result.facets.map((facet) => `${facet.slug}:${facet.count}`);
  }
  const result = await listFloridaBrowse(
    { county: selected, trade: args.trade ?? null, browse: browse(args.sp ?? {}) },
    readMode,
  );
  return {
    total: result.total,
    stats: result.stats,
    slugs: result.results.map((row) => row.slug),
  };
}

if (mode === "parity") {
  const cases: Array<{ label: string; countySlug: string; trade?: TradeDef | null; sp?: Record<string, string> }> = [
    { label: "orange page 1", countySlug: "orange" },
    { label: "orange page 2", countySlug: "orange", sp: { page: "2" } },
    { label: "miami-dade page 1", countySlug: "miami-dade" },
    { label: "miami-dade page 2", countySlug: "miami-dade", sp: { page: "2" } },
    { label: "palm beach page 1", countySlug: "palm-beach" },
    { label: "palm beach page 2", countySlug: "palm-beach", sp: { page: "2" } },
    { label: "ccc trade", countySlug: "orange", trade: ccc },
    { label: "ccc trade page 2", countySlug: "orange", trade: ccc, sp: { page: "2" } },
    { label: "roofers page 1", countySlug: "orange", trade: roofers },
    { label: "roofers page 2", countySlug: "orange", trade: roofers, sp: { page: "2" } },
    { label: "class or description", countySlug: "orange", trade: specialty },
    { label: "status active", countySlug: "orange", sp: { status: "active" } },
    { label: "status inactive", countySlug: "orange", sp: { status: "inactive" } },
    { label: "tenure lt5", countySlug: "orange", sp: { tenure: "lt5" } },
    { label: "tenure 5to15", countySlug: "orange", sp: { tenure: "5to15" } },
    { label: "tenure gt15", countySlug: "orange", sp: { tenure: "gt15" } },
    { label: "entity linked", countySlug: "orange", sp: { entity: "linked" } },
    { label: "entity unlinked", countySlug: "orange", sp: { entity: "unlinked" } },
    { label: "discipline present", countySlug: "orange", sp: { discipline: "present" } },
    { label: "discipline none", countySlug: "orange", sp: { discipline: "none" } },
    { label: "city orlando", countySlug: "orange", sp: { city: "orlando" } },
    { label: "city orlando page 2", countySlug: "orange", sp: { city: "orlando", page: "2" } },
    { label: "sort longest", countySlug: "orange", sp: { sort: "longest" } },
    { label: "sort updated", countySlug: "orange", sp: { sort: "updated" } },
    { label: "sort entity", countySlug: "orange", sp: { sort: "entity" } },
  ];

  for (const item of cases) {
    test(`parity ${item.label}`, async () => {
      const legacy = await signature("browse", "legacy", item);
      const current = await signature("browse", "auto", item);
      assert.deepEqual(current, legacy);
    });
  }

  test("parity covers code-only, contractor-county, hyphen names, and excludes thin profiles", async () => {
    const current = await signature("browse", "auto", { countySlug: "orange" });
    const legacy = await signature("browse", "legacy", { countySlug: "orange" });
    assert.deepEqual(current, legacy);
    const slugs = (current as { slugs: string[] }).slugs.concat(
      ((await signature("browse", "auto", { countySlug: "orange", sp: { page: "2" } })) as { slugs: string[] }).slugs,
    );
    const page3 = (await signature("browse", "auto", { countySlug: "orange", sp: { page: "3" } })) as { slugs: string[] };
    const all = slugs.concat(page3.slugs);
    for (const slug of [
      "orange-code-only",
      "orange-code-pad",
      "orange-code-widepad",
      "orange-code-spaced",
      "orange-code-trail",
      "orange-code-spaced-pad",
      "orange-code-longpad",
      "orange-primary-name",
      "orange-primary-code",
      "orange-primary-widepad",
      "orange-primary-spaced",
      "orange-primary-longpad",
      "orange-lower-name",
      "orange-two-licenses",
    ]) {
      assert.ok(all.includes(slug), slug);
    }
    assert.equal(all.includes("orange-thin"), false);
    assert.equal(all.includes("not-orange-580"), false);
    assert.equal(all.includes("miami-code-spaced"), false);
    const miami = (await signature("browse", "auto", { countySlug: "miami-dade" })) as { slugs: string[] };
    for (const slug of ["miami-hyphen", "miami-space", "miami-alias", "miami-code-spaced"]) {
      assert.ok(miami.slugs.includes(slug), slug);
    }
    const palm = (await signature("browse", "auto", { countySlug: "palm-beach" })) as { slugs: string[] };
    for (const slug of ["palm-space", "palm-alias"]) assert.ok(palm.slugs.includes(slug), slug);
  });

  test("city facets match the legacy county join", async () => {
    const legacy = await signature("cities", "legacy", { countySlug: "orange" });
    const current = await signature("cities", "auto", { countySlug: "orange" });
    assert.deepEqual(current, legacy);
    assert.ok((current as string[]).some((row) => row.startsWith("orlando:")));
  });

  test("plain EXPLAIN of the county read does not scan all contractors", async () => {
    const current = floridaBrowseStatement({ county: county("orange"), browse: browse() }, "auto");
    const legacy = floridaBrowseStatement({ county: county("orange"), browse: browse() }, "legacy");
    assert.ok(current && legacy);
    const currentPlan = (
      await query<{ "QUERY PLAN": string }>(`EXPLAIN ${current.sql}`, current.params)
    )
      .map((row) => row["QUERY PLAN"])
      .join("\n");
    const legacyPlan = (
      await query<{ "QUERY PLAN": string }>(`EXPLAIN ${legacy.sql}`, legacy.params)
    )
      .map((row) => row["QUERY PLAN"])
      .join("\n");
    assert.match(legacyPlan, /Seq Scan on contractors/);
    assert.doesNotMatch(currentPlan, /Seq Scan on contractors/);
    assert.doesNotMatch(currentPlan, /Seq Scan on licenses/);
    assert.match(
      currentPlan,
      /licenses_county_name_lower_idx|licenses_county_code_idx|contractors_primary_county_lower_idx/,
    );
    console.log(`FL_DIR_PERF_004_EXPLAIN\n${currentPlan}`);
  });

  test("plain EXPLAIN of orange roofers does not scan every license", async () => {
    const current = floridaBrowseStatement(
      { county: county("orange"), trade: roofers, browse: browse() },
      "auto",
    );
    assert.ok(current);
    const plan = (await query<{ "QUERY PLAN": string }>(`EXPLAIN ${current.sql}`, current.params))
      .map((row) => row["QUERY PLAN"])
      .join("\n");
    assert.doesNotMatch(plan, /Seq Scan on contractors/);
    assert.doesNotMatch(plan, /Seq Scan on licenses/);
    assert.match(
      plan,
      /licenses_county_name_lower_idx|licenses_county_code_idx|licenses_occupation_source_idx|contractors_primary_county_lower_idx/,
    );
    console.log(`FL_DIR_PERF_004_ROOFERS_EXPLAIN\n${plan}`);
  });
}
