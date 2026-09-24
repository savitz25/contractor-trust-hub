import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { interpretTennessee } from "../ask/tennessee";
import { interpretAskQuery } from "../ask/interpret";
import { normalizeAskText } from "../ask/ontology";
import { researchRoute } from "../ask/request";
import { normalizedPublishedStatePath } from "../seo/published-state-path";
import summary from "./summary.json";
import events from "./events.json";
import { assertTennesseeSnapshot } from "./snapshot";

const s = assertTennesseeSnapshot();
const ask = (q: string) => interpretTennessee(q, normalizeAskText(q));

test("TN-CON-001 credential classes stay separate and only Contractor licenses are counted", () => {
  assert.deepEqual(
    s.credential_rules.map((r) => r.id),
    ["contractor", "home-improvement", "lle", "llp"],
  );
  assert.equal(s.net_new.HIC_ROWS, 0);
  assert.equal(s.net_new.LLE_ROWS, 0);
  assert.equal(s.net_new.LLP_ROWS, 0);
  const hic = s.credential_rules.find((r) => r.id === "home-improvement")!;
  assert.match(hic.rule, /\$3,000 to \$24,999/);
  assert.equal((hic as { counties?: string[] }).counties?.length, 9);
  const c = s.contractor_licenses;
  assert.equal(
    Object.values(c.statusCounts).reduce((a, b) => a + b, 0),
    c.distinctLicenseNumbers,
  );
  assert.equal(c.licenseByQualifyingAgentRows + c.applicationRowsWithoutLicense, c.exportRows);
});

test("TN-CON-001 license shards hold every license once, with no contact data or agent names", () => {
  const dir = "lib/tennessee-intelligence/licenses";
  let total = 0;
  const seen = new Set<string>();
  for (const f of readdirSync(dir)) {
    const rows = JSON.parse(readFileSync(`${dir}/${f}`, "utf8")) as Array<Record<string, unknown>>;
    for (const r of rows) {
      assert.equal(seen.has(String(r.license)), false);
      seen.add(String(r.license));
      assert.equal(String(r.license).slice(-2).padStart(2, "0"), f.replace(".json", ""));
      for (const k of Object.keys(r)) assert.ok(!/email|phone|street|agentName/i.test(k), k);
    }
    total += rows.length;
    const text = readFileSync(`${dir}/${f}`, "utf8");
    assert.doesNotMatch(text, /[\w.+-]+@[\w-]+\.[a-z]{2,}|\(\d{3}\)\s?\d{3}-\d{4}|\b\d{3}-\d{3}-\d{4}\b/);
  }
  assert.equal(total, s.contractor_licenses.distinctLicenseNumbers);
  assert.equal(s.qualifying_agents.namesPublished, false);
});

test("TN-CON-001 discipline rows are standalone evidence events", () => {
  assert.equal(events.length, s.discipline.rows);
  assert.ok(events.every((e) => e.attribution === "standalone_event_no_profile_join" && e.licenseNumberPrinted === null));
  const outside = events.filter((e) => e.actionDate < "2023-01-01" || e.actionDate > "2026-09-24");
  assert.ok(outside.every((e) => e.actionDateOutsideReportPeriod), "odd dates are flagged, not rewritten");
  assert.equal(outside.length, s.discipline.rowsWithActionDateOutsideReportPeriod);
  assert.equal(events.filter((e) => e.unlicensedActivity).length, s.discipline.unlicensedActivityRows);
});

test("TN-CON-001 search acceptance", () => {
  const cases: Array<[string, (r: NonNullable<ReturnType<typeof ask>>) => void]> = [
    ["contractors Tennessee", (r) => assert.match(r.failMessage ?? "", /29,096 Contractor license numbers/)],
    ["licensed contractor Tennessee", (r) => assert.match(r.failMessage ?? "", /not a count of all Tennessee contractors/)],
    ["contractor license Tennessee", (r) => assert.match(r.failMessage ?? "", /\$25,000 or more/)],
    ["Tennessee contractor license 60001", (r) => assert.equal(r.definition?.href, "/tennessee?license=60001#license-lookup")],
    ["home improvement contractor Tennessee", (r) => assert.match(r.failMessage ?? "", /Bradley, Davidson, Hamilton, Haywood, Knox, Marion, Robertson, Rutherford, and Shelby/)],
    ["home improvement license Tennessee", (r) => assert.match(r.failMessage ?? "", /\$3,000 to \$24,999/)],
    ["HIC Nashville", (r) => assert.match(r.failMessage ?? "", /Nashville is in Davidson County/)],
    ["home improvement contractor Memphis", (r) => assert.match(r.failMessage ?? "", /Memphis is in Shelby County/)],
    ["electrician Tennessee", (r) => assert.match(r.failMessage ?? "", /Limited Licensed Electrician/)],
    ["LLE Tennessee", (r) => assert.match(r.failMessage ?? "", /No LLE list was acquired/)],
    ["limited licensed plumber Tennessee", (r) => assert.match(r.failMessage ?? "", /under \$500 is exempt/)],
    ["LLP Tennessee", (r) => assert.match(r.failMessage ?? "", /No LLP list was acquired/)],
    ["Tennessee qualifying agent", (r) => assert.match(r.failMessage ?? "", /32,941 license-to-agent links/)],
    ["contractor qualifying agent Tennessee", (r) => assert.match(r.failMessage ?? "", /not counted as contractors/)],
    ["contractor discipline Tennessee", (r) => assert.match(r.definition?.body ?? "", new RegExp(`${summary.disciplineRows.toLocaleString("en-US")} rows`))],
    ["unlicensed contractor Tennessee", (r) => assert.match(r.definition?.title ?? "", /discipline/)],
    ["contractor civil penalty Tennessee", (r) => assert.match(r.definition?.body ?? "", /No row prints a license number/)],
    ["contractor complaints Tennessee", (r) => assert.match(r.failMessage ?? "", /A complaint is not discipline/)],
    ["contractor Nashville", (r) => assert.match(r.failMessage ?? "", /1,626 Contractor licensees list a Nashville address/)],
    ["contractor Memphis", (r) => assert.match(r.failMessage ?? "", /Memphis address/)],
    ["contractor Knoxville", (r) => assert.match(r.failMessage ?? "", /Knoxville address/)],
    ["contractor Chattanooga", (r) => assert.match(r.failMessage ?? "", /Chattanooga address/)],
  ];
  for (const [q, check] of cases) {
    const r = ask(q);
    assert.ok(r, `${q} must route to Tennessee`);
    check(r!);
    assert.equal(r!.count, null, `${q} must not publish a single contractor count`);
    assert.equal(r!.aggregate, null, `${q} must not use the credential-row aggregate table`);
  }
});

test("TN-CON-001 routing: no other state stolen, MA still works, ranking refused, /ask keeps Tennessee", () => {
  assert.equal(ask("roofer in Ohio"), null);
  assert.equal(ask("HIC Massachusetts"), null);
  assert.match(interpretAskQuery("HIC Massachusetts", {} as never).interpretation.notes.join(" "), /ma-con-001/);
  assert.match(interpretAskQuery("HIC Nashville", {} as never).interpretation.notes.join(" "), /tn-con-001/);
  assert.notEqual(interpretAskQuery("best contractor Tennessee", {} as never).interpretation.notes.join(" "), "tn-con-001-state-intelligence");
  const discovery = { mode: "discovery", request: { state: "TN" } } as never;
  for (const q of ["contractor Nashville", "HIC Nashville", "Tennessee qualifying agent"]) assert.equal(researchRoute(q, discovery), "/ask", q);
});

test("TN-CON-001 route, sitemap, and no local pages", () => {
  assert.equal(normalizedPublishedStatePath("/Tennessee"), "/tennessee");
  assert.equal(normalizedPublishedStatePath("/tennessee/nashville"), null);
  for (const c of ["nashville", "memphis", "knoxville", "chattanooga"]) assert.equal(existsSync(`app/tennessee/${c}`), false);
  const sitemap = readFileSync("lib/seo/sitemap-data.ts", "utf8");
  assert.equal(sitemap.match(/"\/tennessee"/g)?.length, 1);
  const page = readFileSync("app/tennessee/page.tsx", "utf8");
  assert.doesNotMatch(page, /Tennessee has [\d,]+ contractors|best contractor|safest|vetted|Trust Score is/i);
  assert.match(page, /The \$25,000 Contractor threshold is not the whole system/);
  assert.ok(JSON.stringify(s).length < 40000, "accepted snapshot stays aggregate-sized for network metrics");
});
