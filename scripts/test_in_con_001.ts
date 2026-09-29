import assert from "node:assert/strict";
import test from "node:test";
import { IN_DISCIPLINE, IN_SNAPSHOT } from "../lib/indiana-intelligence/snapshot";
import { indianaDisciplineRows, interpretIndiana } from "../lib/ask/indiana";
import { interpretAskQuery } from "../lib/ask/interpret";
import { normalizedPublishedStatePath } from "../lib/seo/published-state-path";

const ask = (q: string) => interpretAskQuery(q, {} as Parameters<typeof interpretAskQuery>[1]);

test("plumbing class totals keep business, person and program grain apart", () => {
  const grain = (g: string) => IN_SNAPSHOT.classes.filter((row) => row.grain === g).map((row) => row.label);
  assert.deepEqual(grain("business"), ["Plumbing Corporation"]);
  assert.deepEqual(grain("person"), ["Plumbing Contractor", "Temporary Plumbing Contractor", "Journeyman Plumber", "Plumbing Apprentice"]);
  assert.deepEqual(grain("program"), ["Plumbing Apprenticeship Program"]);
  const shown = IN_SNAPSHOT.classes.filter((row) => row.indiana !== null);
  assert.equal(shown.reduce((n, row) => n + (row.indiana ?? 0), 0), IN_SNAPSHOT.professionTotal.indiana);
  assert.equal(shown.reduce((n, row) => n + (row.outOfState ?? 0), 0), IN_SNAPSHOT.professionTotal.outOfState);
  assert.equal(IN_SNAPSHOT.classes[0].indiana, null, "Plumbing Contractor count is NOT_ACQUIRED, not zero");
  assert.equal(IN_SNAPSHOT.roster.credentialRows, 0);
  assert.equal(IN_SNAPSHOT.publicWorks.rows, 0);
  assert.equal(IN_SNAPSHOT.localLicensing, "EXISTS / OUT_OF_SCOPE");
  assert.equal(IN_SNAPSHOT.newCanonicalCompanies + IN_SNAPSHOT.graphWrites + IN_SNAPSHOT.claimEligibilityChanges, 0);
});

test("Indiana routing: statewide, plumbing, discipline, public works and city context", () => {
  const cases: Array<[string, RegExp]> = [
    ["contractor Indiana", /^\/indiana#plumbing/], ["Indiana contractor license", /^\/indiana#plumbing/],
    ["plumbing contractor Indiana", /^\/indiana#plumbing/], ["licensed plumber Indiana", /^\/indiana#plumbing/],
    ["corporate plumbing contractor Indiana", /^\/indiana#plumbing/], ["Indiana Plumbing Commission", /^\/indiana#plumbing/],
    ["Indiana contractor discipline", /^\/indiana#discipline/], ["public works contractor Indiana", /^\/indiana#public-works/],
    ["contractor complaints Indiana", /^\/indiana#complaints/],
    ["contractor Indianapolis", /^\/indiana/], ["contractor Fort Wayne", /^\/indiana/], ["contractor Evansville", /^\/indiana/], ["contractor South Bend", /^\/indiana/],
  ];
  for (const [q, href] of cases) assert.match(ask(q).href ?? "", href, q);
  assert.equal(normalizedPublishedStatePath("/Indiana"), "/indiana");
  assert.equal(normalizedPublishedStatePath("/indiana/indianapolis"), null);
});

test("general, electrical and HVAC searches explain the local boundary instead of a statewide roster", () => {
  for (const q of ["electrical contractor Indiana", "HVAC contractor Indiana", "general contractor Indiana", "electrician Indianapolis", "roofing contractor Indiana"]) {
    const result = ask(q);
    assert.match(result.href ?? "", /#local-licensing$/, q);
    assert.match(result.definition?.body ?? "", /does not license electrical, HVAC or general contractors statewide/, q);
    assert.equal(result.count, null);
  }
});

test("exact labeled identifiers match by hash; bare digits stay ambiguous", () => {
  const business = IN_DISCIPLINE.rows.find((row) => row.grain === "business")!;
  const exact = interpretIndiana(`Indiana plumbing license ${business.licenseNumber}`);
  assert.equal(exact?.interpretation.identifier, business.licenseNumber);
  assert.match(exact?.href ?? "", /\/indiana\?license=CO\d{8}#lookup/);
  assert.ok(indianaDisciplineRows(business.licenseNumber!).length >= 1);
  assert.match(exact?.definition?.body ?? "", /carry exactly/);
  const none = interpretIndiana("Indiana plumbing license PC00000000");
  assert.match(none?.definition?.body ?? "", /not a clearance/);
  const bare = interpretIndiana("81061411 Indiana plumber");
  assert.equal(bare?.interpretation.identifier, null);
  assert.match(bare?.definition?.body ?? "", /bare number is ambiguous/i);
  assert.equal(interpretIndiana("81061411"), null);
  assert.equal(interpretIndiana("PC81061411"), null, "no Indiana context: not claimed by Indiana");
  assert.equal(ask("1234").mode, "fail_closed");
});

test("ranking requests fail closed before Indiana routing", () => {
  for (const q of ["best Indiana contractor", "safest Indiana plumber", "recommended Indiana contractor", "most trustworthy Indiana contractor", "top-rated Indiana plumber", "highest-rated Indiana contractor", "#1 Indiana plumber", "Trust Score Indiana contractor", "AggregateRating Indiana contractor", "ratingValue Indiana contractor", "paid ranking Indiana contractor", "sponsored ranking Indiana contractor"]) {
    assert.equal(ask(q).mode, "fail_closed", q);
  }
});

test("prior-state routing is preserved", () => {
  assert.match(ask("contractor Wisconsin").href ?? "", /^\/wisconsin/);
  assert.match(ask("contractor Maryland").href ?? "", /^\/maryland/);
  assert.match(ask("contractor Connecticut").href ?? "", /^\/connecticut/);
  assert.match(ask("contractor Michigan").href ?? "", /^\/michigan/);
});
