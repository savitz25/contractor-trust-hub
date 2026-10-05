import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { interpretAlabama } from "../lib/ask/alabama";
import { interpretAskQuery } from "../lib/ask/interpret";
import { researchRoute } from "../lib/ask/request";
import { lookupAlabamaLicense } from "../lib/alabama-intelligence/lookup";
import { AL_SNAPSHOT, assertAlabamaSnapshot } from "../lib/alabama-intelligence/snapshot";
import frequency from "../lib/alabama-intelligence/specialty-frequency.json";
import { normalizedPublishedStatePath } from "../lib/seo/published-state-path";

const ask = (q: string) => interpretAskQuery(q, {} as Parameters<typeof interpretAskQuery>[1]);
const discovery = { mode: "discovery", request: { state: "AL" } } as Parameters<typeof researchRoute>[1];

test("ALBGC snapshot keeps source grains and does not invent a prime class", () => {
  assertAlabamaSnapshot();
  const specialtyRows = (frequency as Array<{ count: number }>).reduce((sum, row) => sum + row.count, 0);
  assert.equal(specialtyRows, AL_SNAPSHOT.rows);
  assert.equal((frequency as unknown[]).length, AL_SNAPSHOT.specialtyDistinctStrings);
  assert.equal(AL_SNAPSHOT.explicitSubcontractorSpecialtyRows + AL_SNAPSHOT.unclassifiedRows, 8848);
  assert.equal(AL_SNAPSHOT.netNewCanonicalEntities, 0);
  assert.equal(AL_SNAPSHOT.graphWrites, 0);
});

test("exact license lookup uses the printed number and not the company name", () => {
  const sub = lookupAlabamaLicense("S-22725");
  assert.ok(sub);
  assert.match(sub!.specialty, /SUBCONTRACTOR/);
  assert.equal(lookupAlabamaLicense("alabama traffic systems"), null);
  const named = lookupAlabamaLicense("11104");
  assert.equal(named?.name, "ALL-SOUTH SUBCONTRACTORS INC");
  assert.doesNotMatch(named!.specialty, /SUBCONTRACTOR/i);
  assert.equal(lookupAlabamaLicense("IA-10400")?.specialty, "INACTIVE");
  assert.equal(lookupAlabamaLicense("NO-SUCH-1"), null);
});

test("Alabama Ask stays on the ALBGC roster and does not count other boards as zero", () => {
  const cases: Array<[string, RegExp]> = [
    ["Alabama contractor", /^\/alabama$/],
    ["Alabama general contractor license", /^\/alabama$/],
    ["ALBGC roster", /^\/alabama$/],
    ["contractor Birmingham", /^\/alabama$/],
    ["contractor Montgomery", /^\/alabama$/],
    ["contractor Huntsville", /^\/alabama$/],
    ["contractor Tuscaloosa", /^\/alabama$/],
    ["subcontractor Alabama", /#specialty$/],
    ["Alabama bid limit", /#bid-limit$/],
    ["Alabama electrical contractor", /#other-boards$/],
    ["Alabama HVAC contractor", /#other-boards$/],
    ["Alabama plumber", /#other-boards$/],
    ["Alabama home builder license", /#other-boards$/],
  ];
  for (const [q, href] of cases) {
    const result = ask(q);
    assert.match(result.href ?? "", href, q);
    assert.equal(result.count, null, q);
    assert.equal(result.mode, "guidance", q);
    assert.equal(researchRoute(q, discovery), "/ask", q);
  }
  const exact = interpretAlabama("Alabama license S-22725");
  assert.equal(exact?.interpretation.identifier, "S-22725");
  assert.match(exact?.definition?.body ?? "", /labels this row as a subcontractor/);
  const prime = ask("prime contractors in Alabama");
  assert.match(prime.definition?.body ?? "", /does not label a prime-contractor class/);
  assert.equal(prime.count, null);
  const electrical = ask("Alabama electrical contractor");
  assert.match(electrical.definition?.body ?? "", /not acquired/);
  assert.match(electrical.definition?.body ?? "", /not zero/);
  assert.equal(interpretAlabama("1234"), null);
  assert.equal(normalizedPublishedStatePath("/Alabama"), "/alabama");
  assert.equal(normalizedPublishedStatePath("/ALABAMA"), "/alabama");
  assert.equal(normalizedPublishedStatePath("/alabama"), null);
  assert.equal(normalizedPublishedStatePath("/alabama/birmingham"), null);
  assert.equal(normalizedPublishedStatePath("/alabama/mobile"), null);
  for (const city of ["birmingham", "montgomery", "huntsville", "mobile", "tuscaloosa"]) {
    assert.equal(existsSync(`app/alabama/${city}`), false, city);
  }
  const sitemap = readFileSync("lib/seo/sitemap-data.ts", "utf8");
  assert.equal(sitemap.match(/"\/alabama"/g)?.length, 1);
});

test("ranking requests fail closed before Alabama routing", () => {
  for (const q of ["best Alabama contractor", "safest Alabama contractor", "Trust Score Alabama contractor", "AggregateRating Alabama contractor"]) {
    assert.equal(ask(q).mode, "fail_closed", q);
  }
});

test("prior-state routing is preserved", () => {
  assert.match(ask("contractor Indiana").href ?? "", /^\/indiana/);
  assert.match(ask("contractor Wisconsin").href ?? "", /^\/wisconsin/);
  const tennessee = ask("contractor Tennessee");
  assert.notEqual(tennessee.interpretation.location, "Alabama");
  assert.match(tennessee.href ?? "", /tennessee|commerce\.tn\.gov/);
});
