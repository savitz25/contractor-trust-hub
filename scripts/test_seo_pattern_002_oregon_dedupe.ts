/**
 * SEO-PATTERN-002 Oregon dedupe (Founder GO t2300u).
 *
 * The Oregon CCB loader writes one contractor profile per (license number,
 * endorsement): external_key OR-CCB:<number>:<code>. On Production 9,762 CCB
 * license numbers have 2-4 profiles, so /oregon/multnomah said "6,545 active
 * contractors" for 5,050 licensees and listed one business as several cards.
 *
 * With dedupeByLicenseNumber (Oregon only) every directory listing, total and
 * facet count is one entry per authoritative license number in the state's
 * license source. Never by name. The other endorsement profiles stay on the
 * card (relatedProfiles) and discipline is checked across all of them.
 * AZ/WA keep per-profile identity and byte-identical SQL.
 *
 * Default mode (CI, no DB): source and SQL-shape guards, plus strict failure
 * against a closed loopback port.
 * Fixture mode (loopback only):
 *   psql -f scripts/seo_pattern_002_guard/synthetic_schema.sql \
 *        -f scripts/seo_pattern_002_guard/oregon_dedupe_fixture.sql
 *   SEO002_GUARD_DB=fixture DATABASE_URL=postgres://...@127.0.0.1:<port>/<db>
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  countByTrade,
  countCountiesForTrade,
  DiscoveryDirectoryUnavailableError,
  directoryIdentitySql,
  LICENSE_IDENTITY_SQL,
  listDiscoveryContractors,
} from "../lib/discovery/queries";
import { getCounty, getDiscoveryState, getTrade } from "../lib/discovery/config";
import type { SearchResult } from "../lib/contractors/types";

const mode = process.env.SEO002_GUARD_DB || "unreachable";
if (mode === "unreachable") {
  process.env.DATABASE_URL = "postgres://seo002_or_dedupe_test@127.0.0.1:9/postgres_unreachable";
}
if (mode === "fixture") {
  assert.match(process.env.DATABASE_URL || "", /@(127\.0\.0\.1|localhost):\d+\//, "fixture mode runs only against a loopback database");
}

const OR = "oregon";
const disc = (s: string) => {
  const d = getDiscoveryState(s);
  assert.ok(d, s);
  return d;
};
const geo = (slug: string) => {
  const c = getCounty(disc(OR), slug);
  assert.ok(c, slug);
  return c;
};
const trade = (slug: string) => {
  const t = getTrade(disc(OR), slug);
  assert.ok(t, slug);
  return t;
};
const numberOf = (r: SearchResult) => {
  const m = /^OR-CCB:([^:]*):/.exec(r.primaryLicenseKey || "");
  return m ? m[1] : "";
};

// ------------------------------------------------------------------ source / shape
test("config: only Oregon dedupes by license number", () => {
  assert.equal(disc(OR).dedupeByLicenseNumber, true);
  for (const s of ["arizona", "washington", "florida"]) {
    assert.ok(!disc(s).dedupeByLicenseNumber, `${s} keeps per-profile identity`);
    assert.equal(directoryIdentitySql(disc(s)), "c.id");
  }
  assert.equal(directoryIdentitySql(disc(OR)), LICENSE_IDENTITY_SQL);
});

test("identity is the license number (never a name); blank numbers fall back to the profile id", () => {
  assert.match(LICENSE_IDENTITY_SQL, /l\.license_number/);
  assert.match(LICENSE_IDENTITY_SQL, /'profile:' \|\| c\.id::text/);
  assert.doesNotMatch(LICENSE_IDENTITY_SQL, /display_name|legal_name|_name_raw|dba_name/);
  const src = readFileSync("lib/discovery/queries.ts", "utf8");
  const start = src.indexOf("async function listByLicenseNumber(");
  const body = src.slice(start, src.indexOf("\nexport async function listDiscoveryContractors(", start));
  assert.ok(start > 0 && body.length > 0);
  // DISTINCT ON the license identity, never on a name column.
  assert.match(body, /SELECT DISTINCT ON \(license_identity\)/);
  assert.doesNotMatch(body, /DISTINCT ON \([^)]*name/i);
  // Related evidence is joined by license number within the same source.
  assert.match(body, /l2\.source_system = \$1/);
  assert.match(body, /l2\.license_number = p\.license_number/);
  assert.match(body, /c2\.is_thin_profile = FALSE/);
  // Unique final tie-breaker for stable pagination.
  assert.match(body, /ORDER BY \$\{statusRank\("p"\)\}, p\.display_name, p\.license_identity/);
});

test("AZ/WA listing SQL is unchanged (per-profile DISTINCT ON (c.id) path still present)", () => {
  const src = readFileSync("lib/discovery/queries.ts", "utf8");
  assert.match(src, /SELECT DISTINCT ON \(c\.id\)\n\s+c\.id,/);
  assert.match(src, /if \(disc\.dedupeByLicenseNumber\) \{\n\s+const results = await listByLicenseNumber\(/);
  // The strict guard still wraps the dedupe path (same try block).
  const start = src.indexOf("export async function listDiscoveryContractors(");
  const body = src.slice(start, src.indexOf("\nexport ", start + 10));
  assert.ok(body.indexOf("listByLicenseNumber(") < body.indexOf('throw new DiscoveryDirectoryUnavailableError("listDiscoveryContractors"'));
});

if (mode === "unreachable") {
  test("DB failure: Oregon dedupe listing and facets still reject in strict mode", async () => {
    const isUnavailable = (err: unknown) => err instanceof DiscoveryDirectoryUnavailableError;
    await assert.rejects(() => listDiscoveryContractors({ publicStateSlug: OR, county: geo("multnomah"), strict: true }), isUnavailable);
    await assert.rejects(() => listDiscoveryContractors({ publicStateSlug: OR, county: geo("out-of-state"), strict: true }), isUnavailable);
    await assert.rejects(() => countByTrade(OR, geo("multnomah"), { strict: true }), isUnavailable);
    await assert.rejects(() => countCountiesForTrade(OR, trade("commercial-general"), { strict: true }), isUnavailable);
  });
}

// ------------------------------------------------------------------ fixture DB
if (mode === "fixture") {
  const setMode = async (m: string) => {
    const { query } = await import("../lib/db");
    await query("UPDATE seo002_fixture_mode SET mode = $1", [m]);
  };
  const all = async (opts: { county?: string; trade?: string }, pageSize = 100) => {
    const out: SearchResult[] = [];
    let total = -1;
    for (let offset = 0; offset < 500; offset += pageSize) {
      const r = await listDiscoveryContractors({
        publicStateSlug: OR,
        county: opts.county ? geo(opts.county) : null,
        trade: opts.trade ? trade(opts.trade) : null,
        limit: pageSize,
        offset,
        strict: true,
      });
      if (total === -1) total = r.total;
      assert.equal(r.total, total, "total is stable across pages");
      out.push(...r.results);
      if (r.results.length < pageSize) break;
    }
    return { rows: out, total };
  };

  test("fixture loaded", async () => {
    await setMode("ok");
    const { queryOne } = await import("../lib/db");
    const row = await queryOne<{ n: string }>("SELECT COUNT(*)::text AS n FROM licenses_t WHERE license_number = 'SYNOR1000'");
    assert.equal(Number(row?.n), 4, "load scripts/seo_pattern_002_guard/oregon_dedupe_fixture.sql");
  });

  test("Multnomah: one card per license number; total = distinct licensees, not profiles", async () => {
    await setMode("ok");
    const { rows, total } = await all({ county: "multnomah" });
    assert.equal(total, 10, "10 licensees (13 published profiles)");
    assert.equal(rows.length, 10);
    const numbered = rows.map(numberOf).filter(Boolean);
    assert.equal(new Set(numbered).size, numbered.length, "no license number twice");
    assert.equal(new Set(rows.map((r) => r.id)).size, rows.length, "no profile twice");
  });

  test("negative control: per-profile identity (pre-fix) shows the duplicates", async () => {
    await setMode("ok");
    const d = disc(OR);
    d.dedupeByLicenseNumber = false;
    try {
      const r = await listDiscoveryContractors({ publicStateSlug: OR, county: geo("multnomah"), limit: 100, strict: true });
      assert.equal(r.total, 13);
      const n = r.results.map(numberOf).filter((x) => x === "SYNOR1000");
      assert.equal(n.length, 3, "SYNOR1000 listed 3 times before the fix");
      assert.equal((await countByTrade(OR, geo("multnomah"), { strict: true })).find((f) => f.slug === "commercial-general")?.count, 3);
    } finally {
      d.dedupeByLicenseNumber = true;
    }
  });

  test("multiple endorsements: one card, all other published endorsements kept as evidence", async () => {
    await setMode("ok");
    const { rows } = await all({ county: "multnomah" });
    const card = rows.filter((r) => numberOf(r) === "SYNOR1000");
    assert.equal(card.length, 1);
    const keys = [card[0].primaryLicenseKey, ...(card[0].relatedProfiles || []).map((x) => x.licenseKey)].sort();
    assert.deepEqual(keys, ["OR-CCB:SYNOR1000:CGC2", "OR-CCB:SYNOR1000:LBPR", "OR-CCB:SYNOR1000:RGC"], "thin RSC profile stays unpublished");
    assert.equal(card[0].relatedProfiles?.length, 2);
    for (const rel of card[0].relatedProfiles || []) assert.ok(rel.slug.startsWith("or-ccb-synor1000-"));
    assert.equal(card[0].hasDiscipline, true, "discipline on a non-representative endorsement profile is kept");
    // Deterministic representative: lowest external_key among active profiles.
    assert.equal(card[0].primaryLicenseKey, "OR-CCB:SYNOR1000:CGC2");
  });

  test("identity collision: same name, different license numbers stay separate", async () => {
    await setMode("ok");
    const { rows } = await all({ county: "multnomah" });
    const same = rows.filter((r) => r.displayName === "Synthetic Same Name Builders LLC").map(numberOf).sort();
    assert.deepEqual(same, ["SYNOR1002", "SYNOR1003"]);
    const two = rows.filter((r) => r.displayName === "Synthetic Two Licenses Co").map(numberOf).sort();
    assert.deepEqual(two, ["SYNOR1004", "SYNOR1005"], "legitimate multiple licenses: two entries");
    for (const r of rows.filter((x) => ["SYNOR1002", "SYNOR1003", "SYNOR1004", "SYNOR1005"].includes(numberOf(x)))) {
      assert.equal(r.relatedProfiles, undefined, "no cross-license evidence");
    }
    const blank = rows.filter((r) => r.displayName === "Synthetic No Number LLC");
    assert.equal(blank.length, 2, "rows without a license number are never merged");
  });

  test("pagination: pages of 3 cover every licensee exactly once in a stable order", async () => {
    await setMode("ok");
    const big = await all({ county: "multnomah" }, 100);
    const paged = await all({ county: "multnomah" }, 3);
    assert.equal(paged.total, 10);
    assert.deepEqual(paged.rows.map((r) => r.id), big.rows.map((r) => r.id));
    const beyond = await listDiscoveryContractors({ publicStateSlug: OR, county: geo("multnomah"), limit: 24, offset: 48, strict: true });
    assert.equal(beyond.total, 10, "out-of-range page keeps the real total");
    assert.deepEqual(beyond.results, []);
  });

  test("out of state: deduplicated, attribution kept", async () => {
    await setMode("ok");
    const { rows, total } = await all({ county: "out-of-state" });
    assert.equal(total, 2, "SYNOR0002 + SYNOR2000 (3 profiles)");
    assert.deepEqual(rows.map((r) => r.primaryLicenseKey).sort(), ["OR-CCB:SYNOR2000:RGC", "SYN-OR-2"]);
    const m = rows.find((r) => numberOf(r) === "SYNOR2000");
    assert.ok(m);
    assert.equal(m.state, "WA");
    assert.deepEqual((m.relatedProfiles || []).map((x) => x.occupationCode), ["RSC"]);
  });

  test("county attribution: a license with profiles in two counties appears once in each", async () => {
    await setMode("ok");
    const mult = (await all({ county: "multnomah" })).rows.find((r) => numberOf(r) === "SYNOR3000");
    const wash = (await all({ county: "washington" })).rows.filter((r) => numberOf(r) === "SYNOR3000");
    assert.ok(mult);
    assert.equal(mult.county, "Multnomah");
    assert.equal(wash.length, 1);
    assert.equal(wash[0].county, "Washington");
    assert.equal(wash[0].occupationCode, "CSC2", "the in-view profile represents the license");
  });

  test("trade facets on a county page equal the deduplicated county+trade listing totals", async () => {
    await setMode("ok");
    const facets = await countByTrade(OR, geo("multnomah"), { strict: true });
    const by = Object.fromEntries(facets.map((f) => [f.slug, f.count]));
    assert.deepEqual(by, {
      "residential-general": 5, // SYNOR0001, 1000, 1002, 1003, 3000
      "commercial-general": 2, // SYNOR1000 (CGC2) + SYNOR1001 (CGC1+CGC2 once)
      "residential-specialty": 2, // SYNOR1004, 1005 (SYNOR1000's RSC profile is thin)
      "residential-limited": 2, // the two no-number profiles
      "lead-renovation": 1, // SYNOR1000
    });
    for (const f of facets) {
      const r = await listDiscoveryContractors({ publicStateSlug: OR, county: geo("multnomah"), trade: trade(f.slug), limit: 100, strict: true });
      assert.equal(r.total, f.count, `${f.slug} facet = listing total`);
      assert.equal(r.results.length, f.count);
    }
  });

  test("trade pages: one entry per license; county facets deduplicated", async () => {
    await setMode("ok");
    const rgc = await all({ trade: "residential-general" });
    assert.equal(rgc.total, 6);
    const cg = await all({ trade: "commercial-general" });
    assert.equal(cg.total, 3, "SYNOR1001 holds CGC1+CGC2: counted once");
    const nums = cg.rows.map(numberOf);
    assert.equal(new Set(nums).size, nums.length);
    const counties = Object.fromEntries((await countCountiesForTrade(OR, trade("commercial-general"), { strict: true })).map((f) => [f.slug, f.count]));
    assert.equal(counties["multnomah"], 2);
    assert.equal(counties["out-of-state"], 1);
  });

  test("true zero stays a real empty result", async () => {
    await setMode("ok");
    assert.deepEqual(await listDiscoveryContractors({ publicStateSlug: OR, county: geo("wheeler"), strict: true }), { results: [], total: 0 });
    assert.deepEqual(await countByTrade(OR, geo("wheeler"), { strict: true }), []);
  });

  test("failures on the dedupe queries still reject (partial-list, partial-facets, timeout)", { timeout: 60_000 }, async () => {
    const isUnavailable = (op: string) => (err: unknown) =>
      err instanceof DiscoveryDirectoryUnavailableError && err.op === op;
    try {
      await setMode("partial-list");
      await assert.rejects(() => listDiscoveryContractors({ publicStateSlug: OR, county: geo("multnomah"), strict: true }), isUnavailable("listDiscoveryContractors"));
      await setMode("partial-facets");
      await assert.rejects(() => countByTrade(OR, geo("multnomah"), { strict: true }), isUnavailable("countByTrade"));
      await assert.rejects(() => countCountiesForTrade(OR, trade("residential-general"), { strict: true }), isUnavailable("countCountiesForTrade"));
      await setMode("slow");
      await assert.rejects(() => listDiscoveryContractors({ publicStateSlug: OR, county: geo("out-of-state"), strict: true }), (err: unknown) => {
        assert.ok(isUnavailable("listDiscoveryContractors")(err));
        assert.match(String((err as Error).cause), /statement timeout/);
        return true;
      });
    } finally {
      await setMode("ok");
    }
  });

  test("AZ/WA unchanged: per-profile listings and counts", async () => {
    await setMode("ok");
    const az = await listDiscoveryContractors({ publicStateSlug: "arizona", county: getCounty(disc("arizona"), "maricopa"), strict: true });
    assert.equal(az.total, az.results.length);
    for (const r of az.results) assert.equal(r.relatedProfiles, undefined);
    const wa = await listDiscoveryContractors({ publicStateSlug: "washington", county: getCounty(disc("washington"), "king"), strict: true });
    assert.equal(wa.total, wa.results.length);
  });
}
