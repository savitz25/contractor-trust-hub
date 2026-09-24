import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { interpretAskQuery } from "../ask/interpret";
import { interpretMassachusetts } from "../ask/massachusetts";
import { normalizeAskText } from "../ask/ontology";
import { normalizedPublishedStatePath } from "../seo/published-state-path";
import { researchRoute } from "../ask/request";
import summary from "./summary.json";
import { assertMassachusettsSnapshot, findMaDolEvents, MASSACHUSETTS_SNAPSHOT } from "./snapshot";

const ask = (q: string) => interpretMassachusetts(q, normalizeAskText(q));
const s = assertMassachusettsSnapshot();

test("MA-CON-001 credential systems stay separate and uncounted", () => {
  const ids = s.credential_systems.map((c) => c.id);
  assert.deepEqual(ids, ["hic", "csl", "electrician", "plumber-gas", "dcamm"]);
  assert.ok(s.credential_systems.every((c) => c.rowsAcquired === null && c.bulk === "NOT_ACQUIRED"));
  assert.equal(s.net_new.HIC_ROWS, 0);
  assert.equal(s.net_new.CSL_ROWS, 0);
});

test("MA-CON-001 evidence families keep their own grain and are never summed", () => {
  const d = s.dol_discipline;
  assert.equal(d.rows, d.events.length);
  assert.equal(d.rowsByBoard.EL + d.rowsByBoard.PL + d.rowsByBoard.GF + d.rowsByBoard.SM, d.rows);
  assert.equal(d.rowsWithLicenseNumber + d.rowsWithoutLicenseNumber, d.rows);
  assert.ok(d.distinctComplaints < d.rows, "rows are complaint x license, not complaints");
  const combined = String(d.rows + s.dcamm_debarment.rows + s.ag_fair_labor_debarment.rows);
  const page = readFileSync("app/massachusetts/page.tsx", "utf8");
  assert.doesNotMatch(JSON.stringify(s) + page, new RegExp(`\\b${combined}\\b`));
  assert.doesNotMatch(page, /Massachusetts licensed contractors|best contractor|safest|vetted|top contractor|Trust Score is/i);
  assert.equal(summary.fingerprint, s.fingerprint);
  assert.equal(summary.dolRows, d.rows);
});

test("MA-CON-001 adverse evidence is standalone and exact-identifier only", () => {
  for (const family of [s.dol_discipline, s.dcamm_debarment, s.ag_fair_labor_debarment]) {
    assert.equal(family.profileAttachments, 0);
  }
  const withLicense = s.dol_discipline.events.find((e) => e.licenseNumber);
  assert.ok(withLicense);
  const found = findMaDolEvents(withLicense!.licenseNumber!, [withLicense!.boardCode]);
  assert.ok(found.every((e) => e.licenseNumber === withLicense!.licenseNumber && e.boardCode === withLicense!.boardCode));
  assert.equal(findMaDolEvents(withLicense!.respondent).length, 0, "names are not identifiers");
  assert.ok(s.ag_fair_labor_debarment.events.every((e) => !("status" in e)), "no invented ACTIVE status");
});

test("MA-CON-001 search acceptance", () => {
  const cases: Array<[string, (r: NonNullable<ReturnType<typeof ask>>) => void]> = [
    ["home improvement contractor Massachusetts", (r) => assert.match(r.failMessage ?? "", /no count of Massachusetts contractors/)],
    ["HIC Massachusetts", (r) => assert.match(r.failMessage ?? "", /HIC/)],
    ["registered contractor Massachusetts", (r) => assert.equal(r.count, null)],
    ["HIC registration Massachusetts", (r) => assert.equal(r.href, "/massachusetts")],
    ["HIC registration 187654", (r) => assert.equal(r.interpretation.identifier, "MA-HIC:187654")],
    ["construction supervisor Massachusetts", (r) => assert.match(r.failMessage ?? "", /not an HIC registration/)],
    ["CSL Massachusetts", (r) => assert.match(r.failMessage ?? "", /Construction Supervisor License/)],
    ["Massachusetts construction supervisor license", (r) => assert.match(r.failMessage ?? "", /no CSL count/)],
    ["CSL 104512", (r) => assert.equal(r.interpretation.identifier, "MA-CSL:104512")],
    ["electrician Massachusetts", (r) => assert.match(r.failMessage ?? "", /no licensee count/)],
    ["plumber Massachusetts", (r) => assert.match(r.failMessage ?? "", /plumber and gas fitter/)],
    ["gas fitter Massachusetts", (r) => assert.match(r.failMessage ?? "", /DOL licenses/)],
    ["contractor discipline Massachusetts", (r) => assert.equal((r.definition?.body.match(/: \d+/g) ?? []).length, 5)],
    [
      "contractor debarred Massachusetts",
      (r) => {
        assert.match(r.definition?.body ?? "", new RegExp(`\\(public contracting\\): ${summary.dcammRows} · `));
        assert.match(r.definition?.body ?? "", new RegExp(`all years: ${summary.agRows} `));
      },
    ],
    ["Massachusetts contractor enforcement", (r) => assert.match(r.definition?.title ?? "", /never summed/)],
    ["HIC complaint Massachusetts", (r) => assert.match(r.failMessage ?? "", /complaint is not a finding/)],
    ["electrician discipline Massachusetts", (r) => assert.match(r.definition?.body ?? "", new RegExp(`electrician discipline rows, 2021 to 2025 Q1: ${summary.dolRowsByBoard.EL}\\.`))],
    [
      "plumber discipline Massachusetts",
      (r) => assert.match(r.definition?.body ?? "", new RegExp(`gas fitter discipline rows, 2021 to 2025 Q1: ${summary.dolRowsByBoard.PL + summary.dolRowsByBoard.GF}\\.`)),
    ],
    ["contractor Boston", (r) => assert.match(r.failMessage ?? "", /statewide/)],
    ["contractor Worcester", (r) => assert.match(r.failMessage ?? "", /not a license system/)],
    ["contractor Springfield Massachusetts", (r) => assert.match(r.failMessage ?? "", /Springfield do not have separate pages/)],
    ["electrician license 52972 Massachusetts", (r) => assert.equal(r.href, "/massachusetts?license=52972&board=EL#dol-lookup")],
  ];
  for (const [q, check] of cases) {
    const r = ask(q);
    assert.ok(r, `${q} must route to Massachusetts`);
    check(r!);
    assert.equal(r!.count, null, `${q} must not publish a single contractor count`);
    assert.equal(r!.aggregate, null, `${q} must not use the credential-row aggregate table`);
  }
});

test("MA-CON-001 routing does not steal other states or rank", () => {
  assert.equal(ask("roofer in Ohio"), null);
  assert.equal(ask("contractor Springfield Illinois"), null);
  assert.match(interpretAskQuery("HIC PA123456 Pennsylvania", {} as never).interpretation.notes.join(" "), /pa-hic/);
  assert.equal(interpretAskQuery("best contractor Massachusetts", {} as never).mode, "fail_closed");
  assert.notEqual(interpretAskQuery("best contractor Massachusetts", {} as never).interpretation.notes.join(" "), "ma-con-001-state-intelligence");
});

test("MA-CON-001 Massachusetts questions stay in /ask instead of provider discovery", () => {
  const discovery = { mode: "discovery", request: { state: "MA" } } as never;
  for (const q of ["contractor Boston", "contractor Worcester", "HIC Massachusetts", "CSL 104512", "contractor debarred Massachusetts"]) {
    assert.equal(researchRoute(q, discovery), "/ask", q);
  }
  const license = ask("electrician license 52972 Massachusetts");
  assert.equal(license?.mode, "guidance", "not entity: entity would run the provider catalog query");
  assert.equal(license?.definition?.href, "/massachusetts?license=52972&board=EL#dol-lookup");
});

test("MA-CON-001 route, sitemap, and no local pages", () => {
  assert.equal(normalizedPublishedStatePath("/Massachusetts"), "/massachusetts");
  assert.equal(existsSync("app/massachusetts/boston"), false);
  assert.equal(existsSync("app/massachusetts/[city]"), false);
  const sitemap = readFileSync("lib/seo/sitemap-data.ts", "utf8");
  assert.equal(sitemap.match(/"\/massachusetts"/g)?.length, 1);
  assert.equal(MASSACHUSETTS_SNAPSHOT.path, "/massachusetts");
});
