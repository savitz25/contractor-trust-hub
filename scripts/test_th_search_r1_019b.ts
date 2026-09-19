/**
 * TH-SEARCH-R1-019B gate: contractor NAME-CANDIDATE operation.
 *
 * The engine's REAL SQL (shared name core) runs against an in-process Postgres (PGlite).
 * Fixtures are hypothetical and exist only in that in-memory database -- nothing is ever
 * written to a production source. There is no duplicate matcher in this file.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test, { after, before } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { searchContractors } from "../lib/contractors/queries";
import { queryContractorNameCandidates } from "../lib/contractors/name-candidates-query";
import { buildNameMatchSql, buildUnprefilteredNameMatchSql, deriveNameMatchEvidence, prepareNameTerms } from "../lib/contractors/name-search-core";
import {
  CONTRACTOR_CONTRACT_FINGERPRINT,
  CONTRACTOR_SCHEMA_FINGERPRINT,
  CONTRACT_VERSION,
  normalizeContractorExecutionRequest,
} from "../lib/specialist-execution/contractor-v2";
import {
  NAME_CANDIDATES_CONTRACT,
  NAME_SOURCE_CAP,
  executeContractorNameCandidates,
  nameCandidatesCapability,
  nameSearchableScopes,
  normalizeNameCandidatesRequest,
} from "../lib/specialist-execution/contractor-name-candidates";

type Row = Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

let pg: PGlite;
const calls: Array<{ sql: string; params: unknown[] }> = [];
const db = {
  query: (async (sql: string, params?: unknown[]) => {
    calls.push({ sql, params: params ?? [] });
    return (await pg.query(sql, params as Any[])).rows;
  }) as Any,
};

let seq = 0;
async function addContractor(c: { name: string; legal?: string | null; dba?: string | null; home?: string | null; thin?: boolean; slug?: string | null; city?: string | null },
  licenses: Array<{ source: string; key: string; number?: string | null; state?: string | null; status?: string | null; occ?: string; raw?: string | null; dbaRaw?: string | null }>) {
  seq += 1;
  const id = `c${String(seq).padStart(4, "0")}`;
  const slug = c.slug === undefined ? `${licenses[0].key.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : c.slug;
  await pg.query(`INSERT INTO contractors VALUES ($1,$2,$3,$4,$5,$6,NULL,$7,$8)`, [id, slug, c.name, c.legal ?? null, c.dba ?? null, c.city ?? null, c.home ?? null, c.thin ?? false]);
  for (const [i, l] of licenses.entries()) {
    await pg.query(`INSERT INTO licenses VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NULL,$10,NULL,$11,$12,$13,$14)`,
      [`${id}-l${i}`, id, l.source, l.key, l.number ?? null, l.occ ?? "GEN", "General", l.status === undefined ? "active" : l.status, l.status ? l.status.toUpperCase() : null, l.state ?? null, "2026-09-01T00:00:00Z", "2026-09-02T00:00:00Z", l.raw ?? null, l.dbaRaw ?? null]);
  }
  return { id, slug };
}

before(async () => {
  pg = new PGlite({ extensions: { pg_trgm } });
  await pg.exec(`
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    CREATE TABLE contractors (id text PRIMARY KEY, slug text, display_name text, legal_name text, dba_name text, primary_city text, primary_county text, home_state text, is_thin_profile boolean);
    CREATE TABLE licenses (id text PRIMARY KEY, contractor_id text, source_system text, external_key text, license_number text, occupation_code text, occupation_description text, status_normalized text, primary_status text, secondary_status text, state text, city text, last_verified_at timestamptz, updated_at timestamptz, licensee_name_raw text, dba_name_raw text);
    CREATE TABLE discipline_actions (contractor_id text, source_system text);
    CREATE TABLE entities (id text, status text, legal_name text, source_system text);
    CREATE TABLE contractor_entities (contractor_id text, entity_id text, role text, confidence numeric);
  `);
  await addContractor({ name: "ALLIED ELECTRICAL LLC", home: "FL", city: "TAMPA" }, [{ source: "fl_dbpr", key: "EC0001001", number: "0001001", state: "FL" }]);
  await addContractor({ name: "ALLIED ROOFING OF TAMPA, INC.", home: "FL" }, [{ source: "fl_dbpr", key: "CCC0002002", state: "FL" }]);
  await addContractor({ name: "ELECTRICAL SERVICES INC", home: "FL" }, [{ source: "fl_dbpr", key: "EC0003003", state: "FL" }]);
  await addContractor({ name: "LONE STAR ALLIED MECHANICAL", home: "TX" }, [{ source: "tx_tdlr", key: "TX-TDLR:TACLA1", state: "TX" }]);
  await addContractor({ name: "ORLANDO 1ST CHOICE ROOFING LLC", home: "FL" }, [{ source: "fl_dbpr", key: "CCC0004004", state: "FL" }]);
  await addContractor({ name: "ACE 2000 ROOFING INC", home: "FL" }, [{ source: "fl_dbpr", key: "CCC0005005", state: "FL" }]);
  await addContractor({ name: "SUNCOAST BUILDERS INC", home: "FL" }, [{ source: "fl_dbpr", key: "CBC0006006", state: "FL" }]);
  await addContractor({ name: "SUNCOAST BUILDERS INC", home: "FL" }, [{ source: "fl_dbpr", key: "CGC0007007", state: "FL" }]);
  await addContractor({ name: "DORMANT DECKS LLC", home: "FL" }, [{ source: "fl_dbpr", key: "CBC0008008", state: "FL", status: "expired" }]);
  await addContractor({ name: "UNKNOWN STATUS DECKS LLC", home: "FL" }, [{ source: "fl_dbpr", key: "CBC0008018", state: "FL", status: null }]);
  await addContractor({ name: "HELD ALLIED HOLDINGS LLC", home: "FL", thin: true }, [{ source: "fl_dbpr", key: "CBC0009009", state: "FL" }]);
  await addContractor({ name: "SLUGLESS ALLIED LLC", home: "FL", slug: null }, [{ source: "fl_dbpr", key: "CBC0009019", state: "FL" }]);
  await addContractor({ name: "BRIGHT HOME SERVICES", dba: "SUNNY SIDE SOLAR", home: "FL" }, [{ source: "fl_dbpr", key: "CVC0010010", state: "FL" }]);
  await addContractor({ name: "GULF COAST", legal: "PEREZ, MARIA", home: "FL" }, [{ source: "fl_dbpr", key: "CBC0011011", state: "FL" }]);
  await addContractor({ name: "HARBOR VIEW", home: "FL" }, [{ source: "fl_dbpr", key: "CBC0011021", state: "FL", raw: "NGUYEN, THANH" }]);
  await addContractor({ name: "KESTREL RIDGE", home: "FL" }, [{ source: "fl_dbpr", key: "CBC0011031", state: "FL", raw: "KESTREL RIDGE OKAFOR", dbaRaw: null }]);
  await addContractor({ name: "O'BRIEN & SONS PLUMBING CO.", home: "FL" }, [{ source: "fl_dbpr", key: "CFC0012012", state: "FL" }]);
  // Reviewer counterexamples + punctuation / initials / long-name / numeric-leading matrix.
  await addContractor({ name: "R & T", home: "FL" }, [{ source: "fl_dbpr", key: "CBC0013001", state: "FL" }]);
  await addContractor({ name: "A.B", home: "FL" }, [{ source: "fl_dbpr", key: "CBC0013002", state: "FL" }]);
  await addContractor({ name: "R & T GENERAL CONSTRUCTION, INC", home: "FL" }, [{ source: "fl_dbpr", key: "CBC0013003", state: "FL" }]);
  await addContractor({ name: "GENERAL CONSTRUCTION LLC", home: "FL" }, [{ source: "fl_dbpr", key: "CBC0013004", state: "FL" }]);
  await addContractor({ name: "ART GENERAL CONSTRUCTION", home: "FL" }, [{ source: "fl_dbpr", key: "CBC0013005", state: "FL" }]);
  await addContractor({ name: "NORTH HARBOR VIEW ESTATE ALPHA", home: "FL" }, [{ source: "fl_dbpr", key: "CBC0013006", state: "FL" }]);
  await addContractor({ name: "NORTH HARBOR VIEW ESTATE BETA", home: "FL" }, [{ source: "fl_dbpr", key: "CBC0013007", state: "FL" }]);
  await addContractor({ name: "MCDONALD'S PLUMBING", home: "FL" }, [{ source: "fl_dbpr", key: "CFC0013008", state: "FL" }]);
  await addContractor({ name: "D'ANGELO TILE L.L.C.", home: "FL" }, [{ source: "fl_dbpr", key: "CBC0013009", state: "FL" }]);
  await addContractor({ name: "84 LUMBER SUPPLY", home: "FL" }, [{ source: "fl_dbpr", key: "CBC0013010", state: "FL" }]);
  await addContractor({ name: "BROWN & ROOT INDUSTRIAL SERVICES, LLC", home: "FL" }, [{ source: "fl_dbpr", key: "CBC0013011", state: "FL" }]);
  // Exact target that sorts AFTER 210 siblings which merely start with the same name.
  for (let i = 1; i <= 210; i += 1) await addContractor({ name: `YARROW WORKS ${String(i).padStart(3, "0")}`, home: "FL" }, [{ source: "fl_dbpr", key: `CBC07${String(i).padStart(5, "0")}`, state: "FL" }]);
  await addContractor({ name: "YARROW WORKS, INC.", home: "FL" }, [{ source: "fl_dbpr", key: "CBC0799999", state: "FL" }]);
  // Representative credential: BOTH rows match. The exact source-name row is expired; the active row only contains the name.
  await addContractor({ name: "UMBRELLA HOLDINGS", home: "FL" }, [
    { source: "fl_dbpr", key: "CBC0014001", state: "FL", status: "active", raw: "LANTERN CREEK BUILDERS OF TAMPA" },
    { source: "fl_dbpr", key: "CBC0014002", state: "FL", status: "expired", raw: "LANTERN CREEK BUILDERS" },
  ]);
  await addContractor({ name: "OUT OF SCOPE ALLIED LLC", home: "GA" }, [{ source: "ga_unpermitted_source", key: "GA-1", state: "GA" }]);
  for (let i = 1; i <= 30; i += 1) await addContractor({ name: `ZEPHYR BUILDERS ${String(i).padStart(2, "0")}`, home: "FL" }, [{ source: "fl_dbpr", key: `CBC09${String(i).padStart(5, "0")}`, state: "FL" }]);
  await addContractor({ name: "ZEPHYR ZZ TARGET LLC", home: "FL" }, [{ source: "fl_dbpr", key: "CBC0999999", state: "FL" }]);
  for (let i = 1; i <= NAME_SOURCE_CAP + 5; i += 1) await addContractor({ name: `QUARTZ HOMES ${String(i).padStart(3, "0")}`, home: "FL" }, [{ source: "fl_dbpr", key: `CRC08${String(i).padStart(5, "0")}`, state: "FL" }]);
});
after(async () => { await pg.close(); });

const run = (body: Row) => executeContractorNameCandidates({ operation: "name_candidates", ...body }, db) as Promise<Any>;
const names = (r: Any): string[] => r.candidates.map((c: Any) => c.displayName);

// 1 ---------------------------------------------------------------------------------------
test("1. name-only structured request reaches name execution and keeps the whole name", async () => {
  calls.length = 0;
  const r = await run({ name: "Allied   Roofing of Tampa" });
  assert.equal(r.contract, NAME_CANDIDATES_CONTRACT);
  assert.equal(r.resultState, "COMPLETED_WITH_CANDIDATES");
  assert.equal(r.name.supplied, "Allied Roofing of Tampa");
  assert.equal(r.name.predicateApplied, true);
  assert.deepEqual(names(r), ["ALLIED ROOFING OF TAMPA, INC."]);
  assert.equal(calls.length, 1, "exactly one statement, no count query, no enrichment");
  assert.match(calls[0].sql, /ILIKE/);
  assert.deepEqual(r.name.requiredWords, ["ALLIED", "ROOFING", "OF", "TAMPA"], "every word of the supplied name is required");
  for (const word of r.name.requiredWords) assert.ok((calls[0].params as string[]).includes(word), `${word} is a predicate parameter`);
  assert.doesNotMatch(calls[0].sql, /status_normalized IN/, "no cohort status default leaks into the name operation");
});

// 2 ---------------------------------------------------------------------------------------
test("2. case, punctuation, legal-suffix and short distinctive variants retrieve the record", async () => {
  for (const variant of ["allied electrical", "ALLIED ELECTRICAL, LLC", "Allied Electrical L.L.C.", "Allied-Electrical", "allied elec"]) {
    const r = await run({ name: variant });
    assert.ok(names(r).includes("ALLIED ELECTRICAL LLC"), `variant "${variant}" must find the record`);
  }
  for (const variant of ["OBrien Sons Plumbing", "O'Brien & Sons Plumbing", "o\u2019brien and sons plumbing co", "Obrien Sons"]) {
    assert.deepEqual(names(await run({ name: variant })), ["O'BRIEN & SONS PLUMBING CO."], `apostrophe/punctuation variant "${variant}"`);
  }
  assert.equal((await run({ name: "OBrien Sons Plumbing" })).candidates[0].match.method, "NORMALIZED_NAME", "labelled as normalized, never as the exact source name");
  assert.deepEqual(names(await run({ name: "McDonalds Plumbing" })), ["MCDONALD'S PLUMBING"]);
  assert.deepEqual(names(await run({ name: "DAngelo Tile" })), ["D'ANGELO TILE L.L.C."]);
  assert.deepEqual(names(await run({ name: "Brown and Root Industrial Services" })), ["BROWN & ROOT INDUSTRIAL SERVICES, LLC"]);
  assert.equal((await run({ name: "D'Angelo Tile LLC" })).candidates[0].match.method, "NORMALIZED_NAME", "dotted L.L.C. is a suffix, not three initials");
});

// 3 ---------------------------------------------------------------------------------------
test("3. Allied finds every Allied-named public record; generic-word overlap alone admits nothing", async () => {
  const r = await run({ name: "Allied" });
  assert.deepEqual(names(r).sort(), ["ALLIED ELECTRICAL LLC", "ALLIED ROOFING OF TAMPA, INC.", "LONE STAR ALLIED MECHANICAL"]);
  assert.ok(!names(r).includes("ELECTRICAL SERVICES INC"));
  const electrical = await run({ name: "Allied Electrical" });
  assert.deepEqual(names(electrical), ["ALLIED ELECTRICAL LLC"], "ELECTRICAL SERVICES INC shares only a generic word and must not appear");
});

// 4 ---------------------------------------------------------------------------------------
test("4. names containing a city or meaningful digits stay names in the explicit name operation", async () => {
  const city = await run({ name: "Orlando 1st Choice Roofing" });
  assert.deepEqual(names(city), ["ORLANDO 1ST CHOICE ROOFING LLC"]);
  assert.equal(city.scope.mode, "all_name_searchable_jurisdictions", "a city word inside the name never becomes a geography filter");
  calls.length = 0;
  const digits = await run({ name: "ACE 2000" });
  assert.deepEqual(names(digits), ["ACE 2000 ROOFING INC"]);
  assert.doesNotMatch(calls[0].sql, /license_number, ''\), ' ', ''\)\) =/, "never routed to the exact/approximate license branch");
  const native = await searchContractors("ACE 2000", { stateSlug: "fl" }, db);
  assert.equal(native.mode, "license", "native Verify guesses a license key from the digits; the explicit name operation must not");
});

// 5 ---------------------------------------------------------------------------------------
test("5. explicit jurisdiction is applied; absent jurisdiction never claims nationwide coverage from FL alone", async () => {
  const tx = await run({ name: "Allied", jurisdiction: "TX" });
  assert.deepEqual(names(tx), ["LONE STAR ALLIED MECHANICAL"]);
  assert.deepEqual(tx.scope.searched.map((s: Any) => s.code), ["TX"]);
  const fl = await run({ name: "Allied", jurisdiction: "florida" });
  assert.ok(!names(fl).includes("LONE STAR ALLIED MECHANICAL"));
  assert.equal(fl.scope.requestedJurisdiction, "FL");
  const all = await run({ name: "Allied" });
  const searched = all.scope.searched.map((s: Any) => s.code);
  assert.deepEqual(searched, nameSearchableScopes().map((s) => s.code));
  assert.ok(searched.length > 1 && searched.includes("TX") && searched.includes("FL"));
  assert.ok(all.scope.searched.every((s: Any) => s.state === "COMPLETED"));
  assert.match(all.scope.meaning, /not nationwide coverage/i);
  assert.ok(all.scope.notSearchableByName.some((s: Any) => s.code === "VA"), "a configured state page is not name coverage");
  assert.ok(!names(all).includes("OUT OF SCOPE ALLIED LLC"), "sources outside the permitted scopes are never searched");
  const oh = await run({ name: "Allied", jurisdiction: "OH" });
  assert.equal(oh.resultState, "UNSUPPORTED_SCOPE");
  assert.deepEqual(oh.candidates, []);
  assert.deepEqual(oh.scope.searched, [], "the constraint is kept; no other state is substituted");
  assert.equal(oh.name.predicateApplied, false);
  assert.equal(tx.candidates[0].credentialJurisdiction.code, "TX");
  assert.match(tx.candidates[0].recordedLocation.meaning, /Separate from the credential jurisdiction/);
});

// 6 ---------------------------------------------------------------------------------------
test("6. inactive/unknown-status public profiles stay discoverable; publication restrictions stay enforced", async () => {
  const dormant = await run({ name: "Dormant Decks" });
  assert.deepEqual(names(dormant), ["DORMANT DECKS LLC"]);
  assert.equal(dormant.candidates[0].credential.status, "expired");
  const unknown = await run({ name: "Unknown Status Decks" });
  assert.equal(unknown.candidates[0].credential.status, null, "unknown status stays unknown");
  const held = await run({ name: "Held Allied Holdings" });
  assert.equal(held.resultState, "COMPLETED_NO_CANDIDATES", "thin/held profiles are never promoted");
  const slugless = await run({ name: "Slugless Allied" });
  assert.equal(slugless.resultState, "COMPLETED_NO_CANDIDATES", "no public destination means not a public candidate");
  // The legacy cohort default is untouched.
  assert.equal(normalizeContractorExecutionRequest({ state: "FL", trade: "roofing" }).credentialStatus, "active_current");
});

// 7 ---------------------------------------------------------------------------------------
test("7. same-name identities stay separate and an exact string match is never an identity finding", async () => {
  const r = await run({ name: "SUNCOAST BUILDERS INC" });
  assert.equal(r.candidates.length, 2);
  assert.equal(new Set(r.candidates.map((c: Any) => c.stableKey)).size, 2);
  assert.ok(r.candidates.every((c: Any) => c.match.method === "EXACT_SOURCE_NAME"));
  assert.notEqual(r.resultState, "EXACT_IDENTITY");
  const single = await run({ name: "Orlando 1st Choice Roofing LLC" });
  assert.equal(single.candidates.length, 1);
  assert.equal(single.resultState, "COMPLETED_WITH_CANDIDATES", "a single row is still only a candidate");
  assert.ok(!JSON.stringify(single).includes("EXACT_IDENTITY"));
  assert.match(single.limitations.join(" "), /not a confirmed identity/);
  assert.equal(single.candidates[0].entityType, null, "entity type is never inferred from the name");
});

// 8 ---------------------------------------------------------------------------------------
test("8. match field/value/method agree with the returned source record", async () => {
  const alias = await run({ name: "Sunny Side Solar" });
  assert.deepEqual(names(alias), ["BRIGHT HOME SERVICES"]);
  assert.deepEqual([alias.candidates[0].match.field, alias.candidates[0].match.value, alias.candidates[0].match.method], ["dba_name", "SUNNY SIDE SOLAR", "DOCUMENTED_ALIAS"]);
  const credentialRow = await run({ name: "Kestrel Okafor" });
  assert.deepEqual(names(credentialRow), ["KESTREL RIDGE"], "all words on one credential row's source name match");
  assert.equal(credentialRow.candidates[0].match.field, "licensee_name_raw");
  // Declared boundary: words must co-occur in ONE name field. A business-name word plus a word from a
  // different field (e.g. the qualifying individual) is not a name match -- on either surface.
  for (const split of ["Perez Gulf", "Nguyen Harbor"]) {
    assert.equal((await run({ name: split })).resultState, "COMPLETED_NO_CANDIDATES", split);
    assert.deepEqual((await searchContractors(split, { stateSlug: "fl" }, db)).results, [], `${split}: native Verify shares the boundary -- one engine`);
  }
  const person = await run({ name: "Perez Maria" });
  assert.deepEqual(names(person), ["GULF COAST"], "all words in the legal/licensee field still match");
  assert.equal(person.candidates[0].match.field, "legal_name");
  const prefix = await run({ name: "Zephyr ZZ" });
  assert.equal(prefix.candidates[0].match.method, "PREFIX_OR_TOKEN");
  const all = await run({ name: "Allied", limit: 25 });
  for (const c of all.candidates) assert.ok(c.match.value.toLowerCase().includes("allied"), `${c.displayName}: matched value must contain the supplied name`);
  // A source that returns a row whose own names do not explain the match is a failure, not a candidate.
  const lying = { query: (async () => [{ id: "x", slug: "x-unrelated", display_name: "UNRELATED PAVING", legal_name: null, dba_name: null, licensee_name_raw: null, dba_name_raw: null, scope_code: "FL", rank_score: 6 }]) as Any };
  const bad = await executeContractorNameCandidates({ operation: "name_candidates", name: "Allied" }, lying) as Any;
  assert.equal(bad.resultState, "SOURCE_FAILURE");
  assert.equal(bad.failureKind, "invalid_response");
  assert.deepEqual(bad.candidates, []);
  assert.equal(deriveNameMatchEvidence("Allied", { display_name: "UNRELATED PAVING" }), null);
});

// 9 ---------------------------------------------------------------------------------------
test("9. a true target beyond the first page is reachable; capped results carry a working continuation", async () => {
  const seen: string[] = [];
  let page = 1;
  let r = await run({ name: "Zephyr", limit: 10, page });
  assert.ok(!names(r).includes("ZEPHYR ZZ TARGET LLC"), "target is beyond the first page");
  while (true) {
    seen.push(...r.candidates.map((c: Any) => c.stableKey));
    if (!r.pagination.hasMore) break;
    assert.equal(r.continuation.type, "NEXT_PAGE");
    assert.equal(r.continuation.request.name, "Zephyr", "continuation preserves the name");
    page = r.continuation.request.page;
    r = await executeContractorNameCandidates(r.continuation.request, db) as Any;
  }
  assert.equal(seen.length, 31);
  assert.equal(new Set(seen).size, 31, "no page repeats a record");
  assert.ok(names(r).includes("ZEPHYR ZZ TARGET LLC"));
  assert.equal(page, 4);
  assert.equal(r.pagination.total, null, "no guessed exact total");

  const capped = await run({ name: "Quartz Homes", jurisdiction: "FL", limit: 25, page: 8 });
  assert.equal(capped.resultState, "PARTIAL_TRUNCATED");
  assert.equal(capped.pagination.hasMore, false, "hasMore is never advertised without a usable next page");
  assert.equal(capped.pagination.truncated, true);
  assert.equal(capped.continuation.type, "REFINE_SEARCH", "the cap action is a refinement, not a cursor");
  assert.equal(capped.continuation.reachesRowsBeyondCap, false);
  assert.match(capped.continuation.meaning, /does NOT continue past/);
  assert.equal(capped.continuation.scoped.length, 1);
  assert.match(capped.continuation.scoped[0].href, /\/verify\?q=Quartz%20Homes$/, "refinement link preserves name and scope");
  // Non-divisor limits can never return rows beyond the advertised cap.
  for (const limit of [7, 10, 20, 24, 25]) {
    const keys: string[] = [];
    let request: Row | null = { name: "Quartz Homes", jurisdiction: "FL", limit };
    let last: Any = null;
    while (request) {
      last = await executeContractorNameCandidates({ operation: "name_candidates", ...request }, db) as Any;
      keys.push(...last.candidates.map((c: Any) => c.stableKey));
      request = last.pagination.hasMore ? last.continuation.request : null;
    }
    assert.equal(keys.length, NAME_SOURCE_CAP, `limit ${limit}: exactly the cap is reachable`);
    assert.equal(new Set(keys).size, NAME_SOURCE_CAP, `limit ${limit}: no row repeats`);
    assert.equal(last.resultState, "PARTIAL_TRUNCATED");
    assert.equal(last.pagination.hasMore, false);
  }
  const lastWindow = await run({ name: "Quartz Homes", jurisdiction: "FL", limit: 24, page: 9 });
  assert.equal(lastWindow.pagination.returned, 8, "page 9 x 24 starts at row 192: only 8 rows remain under the cap");
  assert.throws(() => normalizeNameCandidatesRequest({ operation: "name_candidates", name: "Quartz Homes", limit: 24, page: 10 }), /invalid_page/);
  assert.throws(() => normalizeNameCandidatesRequest({ operation: "name_candidates", name: "Quartz Homes", limit: 25, page: 9 }), /invalid_page/);
  const past = await run({ name: "Zephyr", limit: 10, page: 9 });
  assert.equal(past.resultState, "COMPLETED_NO_CANDIDATES");
  assert.match(past.pagination.totalMeaning, /past the last matching row/);
});

// 10 --------------------------------------------------------------------------------------
test("10. a failed source is never a searched-and-missed result", async () => {
  const timeout = { query: (async () => { throw new Error("canceling statement due to statement timeout"); }) as Any };
  const t = await executeContractorNameCandidates({ operation: "name_candidates", name: "Allied" }, timeout) as Any;
  assert.equal(t.resultState, "SOURCE_FAILURE");
  assert.equal(t.failureKind, "timeout");
  assert.notEqual(t.resultState, "COMPLETED_NO_CANDIDATES");
  assert.ok(t.scope.searched.every((s: Any) => s.state === "FAILED"));
  assert.equal(t.name.predicateApplied, false);
  assert.ok(t.continuation.scoped.length > 1, "the customer still gets a working native path");
  const down = { query: (async () => { throw new Error("DATABASE_URL is not set."); }) as Any };
  const d = await executeContractorNameCandidates({ operation: "name_candidates", name: "Allied" }, down) as Any;
  assert.equal(d.resultState, "SOURCE_FAILURE");
  assert.equal(d.failureKind, "unavailable");
  assert.deepEqual(d.candidates, []);
});

// 11 --------------------------------------------------------------------------------------
test("11. empty, invalid and wildcard-like input never becomes an unrestricted cohort or unsafe SQL", async () => {
  for (const name of ["", "   ", "%", "%%%", "___", "...", "&&", "a", "x".repeat(121), "bad name", "<script>alert(1)</script>", 42, null, ["Allied"]]) {
    assert.throws(() => normalizeNameCandidatesRequest({ operation: "name_candidates", name }), /invalid_name/, `name ${JSON.stringify(name)} must be rejected`);
  }
  assert.throws(() => normalizeNameCandidatesRequest({ name: "Allied" }), /invalid_operation/, "the operation is explicit, never inferred");
  assert.throws(() => normalizeNameCandidatesRequest({ operation: "name_candidates", name: "Allied", trade: "roofing" }), /unsupported_field/);
  assert.throws(() => normalizeNameCandidatesRequest({ operation: "name_candidates", name: "Allied", identifier: "CBC015082" }), /unsupported_field/);
  assert.throws(() => normalizeNameCandidatesRequest({ operation: "name_candidates", name: "Allied", contract: "trusthub-specialist-execution-v2" }), /invalid_contract/);
  assert.throws(() => normalizeNameCandidatesRequest({ operation: "name_candidates", name: "Allied", jurisdiction: "Narnia" }), /invalid_jurisdiction/);
  for (const limit of [0, 26, 1.5, "10"]) assert.throws(() => normalizeNameCandidatesRequest({ operation: "name_candidates", name: "Allied", limit }), /invalid_limit/);
  for (const page of [0, -1, 2.5]) assert.throws(() => normalizeNameCandidatesRequest({ operation: "name_candidates", name: "Allied", page }), /invalid_page/);
  const long = "A".repeat(120);
  assert.equal(normalizeNameCandidatesRequest({ operation: "name_candidates", name: long }).name.length, 120, "valid long names are never truncated");

  assert.throws(() => normalizeNameCandidatesRequest({ operation: "name_candidates", name: "\u65e5\u672c\u5efa\u8a2d" }), /invalid_name/, "no ASCII word to match on");
  const wildcard = await run({ name: "%a%" });
  assert.equal(wildcard.resultState, "COMPLETED_NO_CANDIDATES", "LIKE metacharacters are literals, not match-all");
  const underscore = await run({ name: "A_lied" });
  assert.deepEqual(names(underscore), []);
  const injection = await run({ name: "Allied'; DROP TABLE contractors;--" });
  assert.equal(injection.resultState, "COMPLETED_NO_CANDIDATES");
  assert.equal(Number((await pg.query<{ n: number }>("SELECT COUNT(*)::int AS n FROM contractors")).rows[0].n) > 200, true, "tables intact");
  const miss = await run({ name: "Nonexistent Qzxv Builders" });
  assert.equal(miss.resultState, "COMPLETED_NO_CANDIDATES");
  assert.deepEqual(miss.candidates, [], "a valid miss is an honest miss, never a cohort");
  assert.equal(miss.name.predicateApplied, true);
});

// 12 --------------------------------------------------------------------------------------
test("12. legacy v2 exact-credential, cohort and contract locks are unchanged", () => {
  assert.equal(CONTRACT_VERSION, "2.1.0");
  const pins = JSON.parse(fs.readFileSync("docs/qa/th-search-r1-019b/v2-contract-pins.json", "utf8"));
  assert.equal(CONTRACTOR_SCHEMA_FINGERPRINT, pins.schemaFingerprint, "consumers pin this fail-closed; it must not move");
  assert.equal(CONTRACTOR_CONTRACT_FINGERPRINT, pins.contractFingerprint);
  for (const field of ["identityName", "name", "operation"]) {
    assert.throws(() => normalizeContractorExecutionRequest({ [field]: "Stilwell Solar" }), /unsupported_field/, "v2 stays name-free; the name operation is a separate opt-in contract");
  }
  const legacy = normalizeContractorExecutionRequest({ identifier: "CBC015082" });
  assert.deepEqual([legacy.state, legacy.queryType, legacy.credentialStatus, legacy.identifier], ["FL", "identifier", "active_current", "CBC015082"]);
  const v2Source = fs.readFileSync("lib/specialist-execution/contractor-v2.ts", "utf8");
  assert.doesNotMatch(v2Source, /name-search-core|name-candidates/, "the hardened exact-identifier route does not share the approximate name helpers");
  assert.notEqual(nameCandidatesCapability().schemaFingerprint, CONTRACTOR_SCHEMA_FINGERPRINT);
});

// 13 --------------------------------------------------------------------------------------
test("13. native Verify name search and the operation return the same identities under the same scope", async () => {
  for (const [name, slug, code] of [["Allied", "fl", "FL"], ["Allied", "tx", "TX"], ["R & T", "fl", "FL"], ["OBrien Sons", "fl", "FL"], ["North Harbor View Estate Alpha", "fl", "FL"], ["Suncoast Builders", "fl", "FL"], ["sunny side solar", "fl", "FL"], ["Perez Maria", "fl", "FL"], ["Kestrel Okafor", "fl", "FL"], ["Zephyr", "fl", "FL"]] as const) {
    const native = await searchContractors(name, { stateSlug: slug, limit: 50 }, db);
    assert.equal(native.mode, "name");
    const op = await run({ name, jurisdiction: code, limit: 25 });
    const opSlugs: string[] = op.candidates.map((c: Any) => c.stableKey.replace("contractor:profile:", ""));
    let next = op;
    while (next.pagination.hasMore) { next = await executeContractorNameCandidates(next.continuation.request, db) as Any; opSlugs.push(...next.candidates.map((c: Any) => c.stableKey.replace("contractor:profile:", ""))); }
    // Declared difference: the operation applies the v2 publication gate (non-thin AND a public slug).
    // Native Verify can list a non-thin profile that has no slug; without a destination it is not a candidate.
    const nativePublic = native.results.filter((r) => Boolean(r.slug)).map((r) => r.slug);
    assert.deepEqual([...opSlugs].sort(), [...nativePublic].sort(), `${name}@${code}`);
  }
  const nativeAllied = await searchContractors("Allied", { stateSlug: "fl", limit: 50 }, db);
  assert.ok(nativeAllied.results.some((r) => r.displayName === "SLUGLESS ALLIED LLC" && !r.slug), "fixture proves the declared difference is real");
  const core = fs.readFileSync("lib/contractors/name-search-core.ts", "utf8");
  const nativeSource = fs.readFileSync("lib/contractors/queries.ts", "utf8");
  const opQuery = fs.readFileSync("lib/contractors/name-candidates-query.ts", "utf8");
  const opModule = fs.readFileSync("lib/specialist-execution/contractor-name-candidates.ts", "utf8");
  assert.match(core, /export function buildNameMatchSql/);
  assert.match(nativeSource, /buildNameMatchSql\(/);
  assert.match(opQuery, /buildNameMatchSql/);
  for (const source of [nativeSource, opQuery]) { assert.match(source, /\.predicateSql/); assert.match(source, /\.rankSql/); assert.match(source, /\.fromSql/); }
  assert.doesNotMatch(opQuery, /ILIKE/, "the operation has no matching SQL of its own");
  assert.doesNotMatch(opModule, /ILIKE|SELECT /, "the boundary module has no SQL at all");
});

// 14 --------------------------------------------------------------------------------------
test("14. no private fields or claim lookups enter the public path", async () => {
  for (const file of ["lib/contractors/name-search-core.ts", "lib/contractors/name-candidates-query.ts", "lib/specialist-execution/contractor-name-candidates.ts", "app/api/specialist-execution/name-candidates/v1/route.ts"]) {
    const source = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(source, /\b(claims?|claim_|accounts?|customer_|users?\b|email|phone|address_line|postal_code|auth\.)/i, `${file} must not touch private/claim data`);
  }
  const r = await run({ name: "Allied", limit: 25 });
  assert.doesNotMatch(JSON.stringify(r), /email|phone|address_line|postal|claim/i);
  for (const c of r.candidates) {
    assert.match(c.action.href, /\/contractors\/[a-z0-9-]+$/);
    assert.ok(c.action.href.endsWith(`/contractors/${c.stableKey.replace("contractor:profile:", "")}`), "profile URL comes from the stored slug, never from the user's text");
    assert.ok(c.source.clock.label.includes("not an official board effective date"));
  }
});

// 15 --------------------------------------------------------------------------------------
const MATRIX: Array<[string, string[]]> = [
  ["R & T", ["R & T", "R & T GENERAL CONSTRUCTION, INC"]],
  ["A.B", ["A.B"]],
  ["R & T GENERAL CONSTRUCTION", ["R & T GENERAL CONSTRUCTION, INC"]],
  ["r & t general construction, inc", ["R & T GENERAL CONSTRUCTION, INC"]],
  ["General Construction", ["ART GENERAL CONSTRUCTION", "GENERAL CONSTRUCTION LLC", "R & T GENERAL CONSTRUCTION, INC"]],
  ["North Harbor View Estate Alpha", ["NORTH HARBOR VIEW ESTATE ALPHA"]],
  ["North Harbor View Estate", ["NORTH HARBOR VIEW ESTATE ALPHA", "NORTH HARBOR VIEW ESTATE BETA"]],
  ["OBrien Sons Plumbing", ["O'BRIEN & SONS PLUMBING CO."]],
  ["McDonald's Plumbing", ["MCDONALD'S PLUMBING"]],
  ["84 Lumber", ["84 LUMBER SUPPLY"]],
  ["Sunny Side Solar", ["BRIGHT HOME SERVICES"]],
  ["Kestrel Okafor", ["KESTREL RIDGE"]],
  ["Allied Electrical", ["ALLIED ELECTRICAL LLC"]],
  ["Lantern Creek Builders", ["UMBRELLA HOLDINGS"]],
  ["Perez Gulf", []],
  ["T General Construction", ["R & T GENERAL CONSTRUCTION, INC"]],
];
test("15. the index prefilter never drops a match: optimized == complete unprefiltered predicate == expected", async () => {
  const scopes = nameSearchableScopes().map(({ code, sources }) => ({ code, sources }));
  for (const [name, expected] of MATRIX) {
    const optimized = await queryContractorNameCandidates({ name, scopes, limit: 100, offset: 0 }, db, buildNameMatchSql);
    const complete = await queryContractorNameCandidates({ name, scopes, limit: 100, offset: 0 }, db, buildUnprefilteredNameMatchSql);
    const sort = (rows: Any[]) => rows.map((r) => r.display_name).sort();
    assert.deepEqual(sort(optimized.rows), sort(complete.rows), `"${name}": prefilter changed the match set`);
    assert.deepEqual(sort(optimized.rows), [...expected].sort(), `"${name}": independent expectation`);
  }
  const noIndex = buildNameMatchSql(prepareNameTerms("R & T"), 1);
  assert.equal(noIndex.usesNameIndexes, false);
  assert.deepEqual(prepareNameTerms("R & T").terms, ["R", "T"], "initials are terms, never a fused \"R T\" pseudo-word");
  assert.ok(noIndex.params.includes("%R & T%"), "with no indexable word the index rule is the raw supplied text, which the predicate also requires");
  const sql = buildNameMatchSql(prepareNameTerms("Worsham Construction"), 1);
  assert.match(sql.fromSql, /\(display_name ILIKE \$3 AND display_name ILIKE \$4\)/, "all index fragments sit on the SAME column");
  assert.deepEqual(prepareNameTerms("OBrien").indexFragments, ["BRIE"], "fragment survives O'BRIEN and OBRIEN'S");
  assert.deepEqual(prepareNameTerms("O'Neil").indexFragments, ["NEIL"], "a typed apostrophe tells us the safe piece");
  assert.deepEqual(prepareNameTerms("stilw").indexFragments, ["STILW"], "a short word is never reduced to an unselective 3-letter interior");
  assert.deepEqual(prepareNameTerms("Allied Electrical L.L.C.").terms, ["ALLIED", "ELECTRICAL"]);
  assert.deepEqual(prepareNameTerms("The Company").terms, ["THE", "COMPANY"], "a name of only optional words is never emptied");
});

// 16 --------------------------------------------------------------------------------------
test("16. initials and later words stay required; evidence never claims words it did not match", async () => {
  const rt = await run({ name: "R & T GENERAL CONSTRUCTION" });
  assert.deepEqual(names(rt), ["R & T GENERAL CONSTRUCTION, INC"], "GENERAL CONSTRUCTION LLC and ART GENERAL CONSTRUCTION are not this name");
  assert.deepEqual(rt.name.requiredWords, ["R", "T", "GENERAL", "CONSTRUCTION"]);
  assert.equal(deriveNameMatchEvidence("R & T GENERAL CONSTRUCTION", { display_name: "GENERAL CONSTRUCTION LLC" }), null);
  assert.equal(deriveNameMatchEvidence("R & T GENERAL CONSTRUCTION", { display_name: "ART GENERAL CONSTRUCTION" }), null, "an initial never matches a letter inside a word");
  assert.equal(deriveNameMatchEvidence("North Harbor View Estate Alpha", { display_name: "NORTH HARBOR VIEW ESTATE BETA" }), null, "the fifth word is enforced");
  const alpha = await run({ name: "North Harbor View Estate Alpha" });
  assert.deepEqual(names(alpha), ["NORTH HARBOR VIEW ESTATE ALPHA"]);
  assert.deepEqual(alpha.candidates[0].match.matchedWords.map((w: Any) => w.supplied), ["NORTH", "HARBOR", "VIEW", "ESTATE", "ALPHA"]);
  const ev = deriveNameMatchEvidence("R & T General", { display_name: "R & T GENERAL CONSTRUCTION, INC" });
  assert.equal(ev?.method, "PREFIX_OR_TOKEN");
  assert.match(ev?.explanation ?? "", /R, T, GENERAL/);
  // A typed prefix ranks a display name that starts with it above a match on another field.
  const prefixRank = await run({ name: "zeph", jurisdiction: "FL", limit: 3 });
  assert.ok(prefixRank.candidates.every((c: Any) => c.displayName.startsWith("ZEPHYR")));
  const numeric = await run({ name: "84 Lumber" });
  assert.deepEqual(names(numeric), ["84 LUMBER SUPPLY"]);
  // Source field meaning stays visible; a display name alone creates no person/ownership claim.
  const person = await run({ name: "Perez Maria" });
  assert.equal(person.candidates[0].displayName, "GULF COAST");
  assert.equal(person.candidates[0].match.field, "legal_name");
  assert.match(person.candidates[0].match.explanation, /qualifying individual, not the business/);
});

// 17 --------------------------------------------------------------------------------------
test("17. an exact/normalized target is never buried behind 200+ names that merely start the same", async () => {
  const r = await run({ name: "Yarrow Works", jurisdiction: "FL", limit: 10 });
  assert.equal(r.candidates[0].displayName, "YARROW WORKS, INC.", "equality outranks prefix even though it sorts last alphabetically");
  assert.equal(r.candidates[0].match.method, "NORMALIZED_NAME");
  assert.equal(r.pagination.hasMore, true);
  const sorted = [...Array(210)].map((_, i) => `yarrow works ${String(i + 1).padStart(3, "0")}`).concat("yarrow works, inc.").sort();
  assert.ok(sorted.indexOf("yarrow works, inc.") >= 200, "fixture proves the target would fall beyond the cap on name order alone");
  // Representative credential row: the exact source-name row wins over a merely-active unrelated row.
  const rep = await run({ name: "Lantern Creek Builders" });
  assert.deepEqual(names(rep), ["UMBRELLA HOLDINGS"]);
  assert.equal(rep.candidates[0].match.field, "licensee_name_raw");
  assert.equal(rep.candidates[0].match.value, "LANTERN CREEK BUILDERS", "the exact source row, not the active row that merely contains the name");
  assert.equal(rep.candidates[0].match.method, "NORMALIZED_NAME");
  assert.equal(rep.candidates[0].identifiers[0].value, "CBC0014002");
  assert.equal(rep.candidates[0].credential.status, "expired", "status is reported, never used to hide or swap the matched row");
});
