/**
 * CONTRACTOR-NAME-PARITY-001: direct ContractorTrustHub /ask company-name search parity.
 *
 * Production defect: AskTrustHub returned ContractorTrustHub name candidates for "vantage
 * construct" (through this hub's own name-candidate operation), while this hub's /ask surface
 * answered "We could not map that question ..." for "vantage", "vantage construction" and
 * "vantage construct" -- its only name path was gated behind a case-sensitive proper-noun regex
 * and, when it did run, used a Florida-only Verify search.
 *
 * Execution runs the REAL name-candidate operation (shared name core SQL) against an in-process
 * PGlite database with hypothetical fixtures. Nothing touches a production source.
 */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { detectCompanyNameLikeQuery, interpretAskQuery, trailingJurisdiction } from "./interpret";
import { buildContractorResearchQuery } from "./plan";
import { NAME_CANDIDATE_PAGE_SIZE, NAME_MATCH_DISCLAIMER, executeContractorResearchQuery } from "./execute";
import { planContractorSearch } from "../search/contractor-discovery";
import { researchRoute } from "./request";
import { loadContractorHubIntel } from "@/lib/home/load-intel-v2";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const intel = loadContractorHubIntel();

let pg: PGlite;
const db = { query: (async (sql: string, params?: unknown[]) => (await pg.query(sql, params as Any[])).rows) as Any };
let seq = 0;
async function addContractor(c: { name: string; legal?: string | null; dba?: string | null; home?: string | null; thin?: boolean; slug?: string | null; city?: string | null; county?: string | null },
  licenses: Array<{ source: string; key: string; number?: string | null; state?: string | null; status?: string | null; occ?: string; desc?: string; raw?: string | null }>) {
  seq += 1;
  const id = `c${String(seq).padStart(4, "0")}`;
  const slug = c.slug === undefined ? `${licenses[0].key.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : c.slug;
  await pg.query(`INSERT INTO contractors VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [id, slug, c.name, c.legal ?? null, c.dba ?? null, c.city ?? null, c.county ?? null, c.home ?? null, c.thin ?? false]);
  for (const [i, l] of licenses.entries()) {
    await pg.query(`INSERT INTO licenses VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NULL,$10,NULL,$11,$12,$13,NULL)`,
      [`${id}-l${i}`, id, l.source, l.key, l.number ?? null, l.occ ?? "CGC", l.desc ?? "Certified General Contractor", l.status === undefined ? "active" : l.status, l.status === undefined ? "ACTIVE" : l.status?.toUpperCase() ?? null, l.state ?? null, "2026-09-01T00:00:00Z", "2026-09-02T00:00:00Z", l.raw ?? null]);
  }
  return { id, slug };
}

before(async () => {
  pg = new PGlite({ extensions: { pg_trgm } });
  await pg.exec(`
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    CREATE TABLE contractors (id text PRIMARY KEY, slug text, display_name text, legal_name text, dba_name text, primary_city text, primary_county text, home_state text, is_thin_profile boolean);
    CREATE TABLE licenses (id text PRIMARY KEY, contractor_id text, source_system text, external_key text, license_number text, occupation_code text, occupation_description text, status_normalized text, primary_status text, secondary_status text, state text, city text, last_verified_at timestamptz, updated_at timestamptz, licensee_name_raw text, dba_name_raw text);
  `);
  // Hypothetical rows shaped like the Production forensics (names only; keys are fixtures).
  await addContractor({ name: "VANTAGE CONSTRUCTION GROUP", home: "FL", city: "MIAMI", county: "Miami-Dade" }, [{ source: "fl_dbpr", key: "CGC1509456", number: "1509456", state: "FL" }]);
  await addContractor({ name: "VANTAGE CONSTRUCTION SERVICES, LLC", home: "FL", county: "Broward" }, [{ source: "fl_dbpr", key: "CGC1529288", number: "1529288", state: "FL" }]);
  await addContractor({ name: "ARC VANTAGE CONSTRUCTION INC", home: "FL", county: "Broward" }, [{ source: "fl_dbpr", key: "CGC1267986", number: "1267986", state: "FL" }]);
  await addContractor({ name: "VANTAGE CONSTRUCTION", home: "WA" }, [{ source: "wa_lni", key: "WA-LNI:VANTAC*780MR", number: "VANTAC*780MR", state: "WA", occ: "GEN", desc: "General Contractor" }]);
  await addContractor({ name: "VANTAGE CONTRACTING & DEVELOPMENT CO. LLC", legal: "VANTAGE CONTRACTING & DEVELOPMENT CO. LLC", home: "NJ", city: "Watchung", county: "Somerset" }, [{ source: "nj_dca", key: "NJ-HIC:13VH11723500", number: "13VH11723500", state: "NJ", occ: "HIC", desc: "Home Improvement Contractor", raw: "VANTAGE CONTRACTING & DEVELOPMENT CO. LLC" }]);
  await addContractor({ name: "VANTAGE ROOFING LLC", home: "FL" }, [{ source: "fl_dbpr", key: "CCC1335983", number: "1335983", state: "FL", occ: "CCC", desc: "Certified Roofing Contractor" }]);
  await addContractor({ name: "WORSHAM CONSTRUCTION COMPANY INC", legal: "WORSHAM CONSTRUCTION COMPANY INC", home: "FL", county: "Duval" }, [{ source: "fl_dbpr", key: "CBC015082", number: "015082", state: "FL", occ: "CBC", desc: "Certified Building Contractor", raw: "WORSHAM CONSTRUCTION COMPANY INC" }]);
  await addContractor({ name: "O'BRIEN & SONS PLUMBING CO.", home: "FL" }, [{ source: "fl_dbpr", key: "CFC0012012", number: "0012012", state: "FL", occ: "CFC", desc: "Certified Plumbing Contractor" }]);
  await addContractor({ name: "123 ROOFING INC", home: "FL" }, [{ source: "fl_dbpr", key: "CCC0099001", number: "0099001", state: "FL", occ: "CCC", desc: "Certified Roofing Contractor" }]);
  await addContractor({ name: "THIN VANTAGE LLC", home: "FL", thin: true }, [{ source: "fl_dbpr", key: "CGC0099002", state: "FL" }]);
  for (let i = 1; i <= 12; i += 1) await addContractor({ name: `ALLIED BUILDERS ${String(i).padStart(2, "0")}`, home: "FL" }, [{ source: "fl_dbpr", key: `CBC08${String(i).padStart(5, "0")}`, state: "FL" }]);
});
after(async () => { await pg.close(); });

function plan(q: string) {
  const interpreted = interpretAskQuery(q, intel);
  return { interpreted, plan: buildContractorResearchQuery(interpreted) };
}
async function run(q: string, page = 1) {
  const interpreted = interpretAskQuery(q, intel);
  const p = buildContractorResearchQuery(interpreted, { page: String(page) });
  const execution = await executeContractorResearchQuery(p, { nameDb: db });
  return { interpreted, plan: p, execution };
}
const names = (r: Awaited<ReturnType<typeof run>>) => r.execution.results.map((c) => c.displayName);

// --- routing / precedence -------------------------------------------------------------------

test("1. 'vantage' is a company-name search (not the could-not-map dead end) and stays on /ask", async () => {
  const r = await run("vantage");
  assert.equal(r.interpreted.mode, "entity");
  assert.equal(r.interpreted.supported, true);
  assert.equal(r.interpreted.failMessage, null);
  assert.equal(r.plan.identity.entityQuery, "vantage");
  assert.equal(r.plan.identity.identifier, null);
  assert.equal(r.plan.executable, true);
  assert.equal(researchRoute("vantage", planContractorSearch("vantage")), "/ask");
  assert.equal(r.execution.ok, true);
  assert.equal(r.execution.nameSearch?.resultState, "COMPLETED_WITH_CANDIDATES");
  assert.ok(names(r).includes("VANTAGE CONSTRUCTION GROUP"));
  assert.ok(names(r).includes("VANTAGE CONTRACTING & DEVELOPMENT CO. LLC"), "the NJ HIC record is a name candidate for the bare name");
  assert.ok(!names(r).includes("THIN VANTAGE LLC"), "publishability rules are the operation's: thin profiles never appear");
  assert.equal(r.execution.pageSize, NAME_CANDIDATE_PAGE_SIZE);
});

test("2. 'vantage construction' (lower case) reaches name search with every word required", async () => {
  const r = await run("vantage construction");
  assert.equal(r.interpreted.mode, "entity");
  assert.equal(r.plan.identity.entityQuery, "vantage construction");
  assert.deepEqual(r.execution.nameSearch?.requiredWords, ["VANTAGE", "CONSTRUCTION"]);
  assert.ok(names(r).includes("VANTAGE CONSTRUCTION"));
  assert.ok(names(r).includes("ARC VANTAGE CONSTRUCTION INC"), "contains-every-word matches are included after prefix matches");
  assert.ok(!names(r).includes("VANTAGE CONTRACTING & DEVELOPMENT CO. LLC"), "CONTRACTING does not satisfy the required word CONSTRUCTION -- same semantics Ask sees");
  assert.ok(!names(r).includes("VANTAGE ROOFING LLC"));
  const first = r.execution.results[0];
  assert.equal(first.displayName, "VANTAGE CONSTRUCTION", "normalized exact name sorts first");
  assert.equal(first.matchedOn?.method, "NORMALIZED_NAME");
});

test("3. 'vantage construct' (Ask's exact Production input) yields the same candidate set semantics", async () => {
  const r = await run("vantage construct");
  assert.equal(r.interpreted.mode, "entity");
  assert.ok(names(r).includes("VANTAGE CONSTRUCTION GROUP"));
  assert.ok(names(r).includes("ARC VANTAGE CONSTRUCTION INC"));
  assert.ok(!names(r).includes("VANTAGE CONTRACTING & DEVELOPMENT CO. LLC"));
});

test("4. known NJ Vantage forms: a trailing state is the operation's jurisdiction constraint, never part of the name", async () => {
  assert.deepEqual(trailingJurisdiction("vantage construction nj"), { name: "vantage construction", jurisdiction: "NJ" });
  assert.deepEqual(trailingJurisdiction("vantage construction new jersey"), { name: "vantage construction", jurisdiction: "NJ" });
  assert.deepEqual(trailingJurisdiction("vantage or"), { name: "vantage or", jurisdiction: null }, "lower-case 'or' is a word, not Oregon");
  assert.deepEqual(trailingJurisdiction("vantage OR"), { name: "vantage", jurisdiction: "OR" });
  const nj = await run("vantage nj");
  assert.equal(nj.plan.identity.nameJurisdiction, "NJ");
  assert.equal(nj.execution.nameSearch?.jurisdiction, "NJ");
  assert.deepEqual(names(nj), ["VANTAGE CONTRACTING & DEVELOPMENT CO. LLC"]);
  assert.match(nj.execution.nameSearch?.scopeMeaning ?? "", /Only New Jersey credential sources were searched/);
  const njConstruction = await run("vantage construction nj");
  assert.equal(njConstruction.execution.ok, true);
  assert.equal(njConstruction.execution.nameSearch?.resultState, "COMPLETED_NO_CANDIDATES");
  assert.deepEqual(names(njConstruction), [], "no NJ record has CONSTRUCTION in a source name: an honest miss, nothing substituted");
  const njLong = await run("vantage construction new jersey");
  assert.equal(njLong.plan.identity.entityQuery, "vantage construction");
  assert.equal(njLong.execution.nameSearch?.resultState, "COMPLETED_NO_CANDIDATES");
});

test("5. 'Worsham Construction' resolves the exact company through name search (legal suffix optional)", async () => {
  const r = await run("Worsham Construction");
  assert.equal(r.interpreted.mode, "entity");
  assert.deepEqual(names(r), ["WORSHAM CONSTRUCTION COMPANY INC"]);
  assert.equal(r.execution.results[0].credentialKey, "015082");
  assert.equal(r.execution.results[0].profileHref, "/contractors/cbc015082-worsham-construction-company-inc");
  assert.match(r.execution.results[0].whyMatched, new RegExp(NAME_MATCH_DISCLAIMER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(r.execution.results[0].credentialJurisdictionLabel?.startsWith("Florida"), true);
});

test("6. apostrophe / punctuation company name: \"o'brien & sons\" and \"obrien sons co\" both match the same record", async () => {
  const r = await run("o'brien & sons");
  assert.equal(r.interpreted.mode, "entity");
  assert.deepEqual(names(r), ["O'BRIEN & SONS PLUMBING CO."]);
  const r2 = await run("obrien sons co");
  assert.deepEqual(names(r2), ["O'BRIEN & SONS PLUMBING CO."]);
});

test("7. numeric-leading company name with a legal suffix and a trade word: '123 roofing inc' is a name, not a roofing cohort", async () => {
  const r = await run("123 roofing inc");
  assert.equal(r.interpreted.mode, "entity");
  assert.equal(r.plan.identity.entityQuery, "123 roofing inc");
  assert.equal(r.plan.trade.familyId, null, "no trade cohort was substituted");
  assert.deepEqual(names(r), ["123 ROOFING INC"]);
});

test("8. exact credential keeps precedence over name search", () => {
  const { interpreted, plan: p } = plan("verify contractor license CBC015082");
  assert.equal(interpreted.mode, "entity");
  assert.equal(p.identity.identifier, "CBC015082");
  assert.equal(p.identity.entityQuery, null);
  assert.equal(interpreted.href, "/verify?q=CBC015082");
  const bare = plan("CBC015082");
  assert.equal(bare.plan.identity.identifier, "CBC015082");
});

test("9. 'roofers in broward' remains structured research (trade + county), never name search", () => {
  const { interpreted, plan: p } = plan("roofers in broward");
  assert.equal(p.identity.entityQuery, null);
  assert.equal(p.trade.familyId, "roofing");
  assert.equal(p.geography.countySlug, "broward");
  assert.equal(p.executable, true);
  assert.equal(interpreted.failMessage, null);
  assert.equal(detectCompanyNameLikeQuery("roofers in broward"), null);
});

test("10. 'plumber in miami' remains structured research; other structured controls stay structured", () => {
  const miami = plan("plumber in miami");
  assert.equal(miami.plan.identity.entityQuery, null);
  assert.equal(miami.plan.trade.familyId, "plumbing");
  assert.equal(miami.plan.geography.state, "FL");
  for (const q of ["general contractor in miami", "active contractors in florida", "HVAC contractors in Palm Beach County", "licensed electrician in boca raton", "home improvement contractors in Newark New Jersey"]) {
    const { interpreted, plan: p } = plan(q);
    assert.equal(p.identity.entityQuery, null, `${q}: must not become a name search`);
    assert.notEqual(interpreted.mode, "fail_closed", `${q}: must not dead-end`);
  }
  const generic = plan("contractors");
  assert.equal(generic.plan.identity.entityQuery, null, "a generic contractor mention is discovery/clarification, not a name");
});

test("11. no-result company name is an honest empty candidate list -- no fallback cohort, no error", async () => {
  const r = await run("zzyzx quantum builders");
  assert.equal(r.interpreted.mode, "entity");
  assert.equal(r.execution.ok, true);
  assert.equal(r.execution.blocked, false);
  assert.equal(r.execution.nameSearch?.resultState, "COMPLETED_NO_CANDIDATES");
  assert.deepEqual(names(r), []);
  assert.equal(r.execution.contractorCount, null, "no cohort count is asserted for a name search");
});

test("12. bounded results: page size equals the operation's default; a later page continues, the cap is never exceeded", async () => {
  const p1 = await run("allied builders");
  assert.equal(p1.execution.results.length, NAME_CANDIDATE_PAGE_SIZE);
  assert.equal(p1.execution.nameSearch?.hasMore, true);
  assert.equal(p1.execution.nameSearch?.nextPage, 2);
  const p2 = await run("allied builders", 2);
  assert.equal(p2.execution.results.length, 2);
  assert.equal(p2.execution.nameSearch?.hasMore, false);
  assert.equal(new Set([...names(p1), ...names(p2)]).size, 12, "pages do not overlap");
  const past = await run("allied builders", 40);
  assert.equal(past.execution.blocked, true, "a page past the operation's row cap is refused, not silently emptied");
});

test("13. questions and structured wording never become a name search", () => {
  for (const q of ["what is a certified roofing contractor", "how many active roofing credentials are indexed?", "contractors near me", "who serves my neighborhood", "show me vantage", "is vantage licensed", "best roofer"]) {
    const { interpreted, plan: p } = plan(q);
    assert.equal(p.identity.entityQuery, null, `${q}: must not be a name search (mode ${interpreted.mode})`);
  }
});

test("14. TH-DISCOVERY-PARITY-001A brand rule still holds, now case-insensitively", () => {
  for (const q of ["Roto-Rooter Colorado Springs", "roto-rooter colorado springs"]) {
    const { interpreted, plan: p } = plan(q);
    assert.equal(interpreted.mode, "entity", q);
    assert.ok(p.identity.entityQuery, q);
  }
  const co = plan("roto-rooter colorado");
  assert.equal(co.plan.identity.nameJurisdiction, "CO");
  assert.equal(co.plan.identity.entityQuery, "roto-rooter");
});
