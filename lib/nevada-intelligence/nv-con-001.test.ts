import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { interpretNevada } from "../ask/nevada";
import { interpretAskQuery } from "../ask/interpret";
import { normalizeAskText } from "../ask/ontology";
import { researchRoute } from "../ask/request";
import { normalizedPublishedStatePath } from "../seo/published-state-path";
import summary from "./summary.json";
import events from "./events.json";
import labels from "./classification-labels.json";
import { assertNevadaSnapshot } from "./snapshot";

const s = assertNevadaSnapshot();
const ask = (q: string) => interpretNevada(q, normalizeAskText(q));
type Row = { license: string; name: string; status: string; classifications: number[]; monetaryLimit: string | null; disciplineEvents: number } & Record<string, unknown>;

function allLicenses(): Row[] {
  const dir = "lib/nevada-intelligence/licenses";
  return readdirSync(dir).flatMap((f) => JSON.parse(readFileSync(`${dir}/${f}`, "utf8")) as Row[]);
}

test("NV-CON-001 grains stay separate: license != classification link != qualified individual != discipline", () => {
  const c = s.contractor_licenses;
  assert.deepEqual(s.license_model.classes.map((r) => r.id), ["A", "B", "AB", "C", "E"]);
  assert.equal(Object.values(c.statusCounts).reduce((a, b) => a + b, 0), c.distinctLicenseNumbers);
  assert.ok(s.classifications.relationships > c.distinctLicenseNumbers, "classification links outnumber licenses");
  assert.equal(
    Object.entries(s.classifications.licensesByClassificationCount).reduce((a, [k, v]) => a + Number(k) * v, 0),
    s.classifications.relationships,
  );
  assert.equal(s.qualified_individuals.acquired, "NOT_ACQUIRED");
  assert.equal(s.net_new.QUALIFIED_INDIVIDUAL_ROWS, 0);
  assert.equal(s.net_new.DATABASE_WRITES, 0);
  assert.match(s.license_model.monetaryLimit, /not revenue, company size, a quality signal, or a recommended budget/);
  assert.match(s.license_model.qualifiedIndividual, /the license belongs to the business, not the person/);
  assert.equal((labels as string[]).length, s.classifications.distinctClassificationLabels);
  assert.ok((labels as string[]).includes("B-7 Residential Remodeling") && (labels as string[]).includes("B-7 Restricted Residential Remodeling"), "source descriptions are kept exactly, not normalized");
  assert.equal(s.existing_coverage.databaseModified, false);
  const r = s.existing_coverage.reconciliation;
  assert.equal(r.listingLicensesAlsoInDatabase + r.listingLicensesNotInDatabase, c.distinctLicenseNumbers);
  assert.equal(r.listingLicensesAlsoInDatabase + r.databaseLicensesNotInListing, s.existing_coverage.database.licenseRows);
});

test("NV-CON-001 license shards hold every license exactly once, status as published, no phones or street addresses", () => {
  const dir = "lib/nevada-intelligence/licenses";
  const seen = new Set<string>();
  for (const f of readdirSync(dir)) {
    const rows = JSON.parse(readFileSync(`${dir}/${f}`, "utf8")) as Row[];
    for (const r of rows) {
      assert.match(r.license, /^\d{7}[A-Z]?$/);
      assert.equal(seen.has(r.license), false);
      seen.add(r.license);
      assert.equal(r.license.replace(/[A-Z]$/, "").slice(-2), f.replace(".json", ""));
      for (const k of Object.keys(r)) assert.ok(!/email|phone|street|qualifier|principal/i.test(k), k);
      assert.ok(["Active", "Active Probation"].includes(r.status));
    }
    assert.doesNotMatch(readFileSync(`${dir}/${f}`, "utf8"), /[\w.+-]+@[\w-]+\.[a-z]{2,}|\(\d{3}\)\s?\d{3}-\d{4}|\b\d{3}-\d{3}-\d{4}\b/);
  }
  assert.equal(seen.size, s.contractor_licenses.distinctLicenseNumbers);
  const stage = readFileSync("data/nevada/nv-con-001/nscb-contractor-licenses.json", "utf8");
  assert.doesNotMatch(stage, /\(\d{3}\)\s?\d{3}-\d{4}/);
});

test("NV-CON-001 discipline attaches only by the exact license number the Board printed", () => {
  const byLicense = new Map(allLicenses().map((r) => [r.license, r]));
  assert.equal(events.length, s.discipline.rows);
  let attached = 0;
  for (const e of events) {
    if (e.attribution === "exact_license_number_in_active_directory") {
      attached += 1;
      assert.ok(e.licenseNumberPrinted && byLicense.has(e.licenseNumberPrinted));
    } else if (e.attribution === "exact_license_number_not_in_active_directory") {
      assert.ok(e.licenseNumberPrinted && !byLicense.has(e.licenseNumberPrinted));
    } else {
      assert.equal(e.attribution, "standalone_event_no_license_number");
      assert.equal(e.licenseNumberPrinted, null);
    }
    assert.ok(e.actionDate >= "2023-01-01" && e.actionDate <= "2026-09-25", e.actionDate);
  }
  assert.equal(attached, s.discipline.rowsAttachedByExactLicenseNumber);
  const perLicense = [...byLicense.values()].reduce((a, r) => a + r.disciplineEvents, 0);
  assert.equal(perLicense, attached, "shard discipline counts equal exact attachments");
  // a same-name licensee under a different number is never attached
  const e = events.find((x) => x.attribution === "exact_license_number_in_active_directory")!;
  const sameName = [...byLicense.values()].filter((r) => r.name === byLicense.get(e.licenseNumberPrinted!)!.name && r.license !== e.licenseNumberPrinted);
  for (const r of sameName) assert.equal(events.some((x) => x.licenseNumberPrinted === r.license && x.id === e.id), false);
  assert.equal(s.discipline.nameOnlyAttachment, false);
  assert.equal(s.unlicensed_activity.coverage, "NOT_ACQUIRED");
});

test("NV-CON-001 search acceptance matrix", () => {
  const cases: Array<[string, (r: NonNullable<ReturnType<typeof ask>>) => void]> = [
    ["contractors Nevada", (r) => assert.match(r.failMessage ?? "", /19,213 active license numbers/)],
    ["licensed contractors Nevada", (r) => assert.match(r.failMessage ?? "", /not a count of Nevada contractors/)],
    ["Nevada contractor license", (r) => assert.match(r.failMessage ?? "", /licensed statewide by the Nevada State Contractors Board/)],
    ["Nevada contractor license 0095506", (r) => assert.equal(r.definition?.href, "/nevada?license=0095506#license-lookup")],
    ["Nevada contractor license 95506", (r) => assert.equal(r.interpretation.identifier, "NV-NSCB:0095506")],
    ["Nevada contractor license #0016038A", (r) => assert.equal(r.interpretation.identifier, "NV-NSCB:0016038A")],
    ["general building contractor Nevada", (r) => assert.match(r.failMessage ?? "", /Class B — General Building/)],
    ["general engineering contractor Nevada", (r) => assert.match(r.failMessage ?? "", /Class A — General Engineering/)],
    ["roofing contractor Nevada", (r) => assert.match(r.failMessage ?? "", /C-15 Roofing and Siding/)],
    ["electrical contractor Nevada", (r) => assert.match(r.failMessage ?? "", /C-2 specialty/)],
    ["plumbing contractor Nevada", (r) => assert.match(r.failMessage ?? "", /C-1 specialty/)],
    ["Nevada contractor qualifying party", (r) => assert.match(r.failMessage ?? "", /license belongs to the business/)],
    ["qualified individual contractor Nevada", (r) => assert.match(r.failMessage ?? "", /none is counted as a contractor/)],
    ["contractor monetary limit Nevada", (r) => assert.match(r.failMessage ?? "", /not revenue, company size, quality/)],
    ["contractor discipline Nevada", (r) => assert.match(r.definition?.body ?? "", /609 rows/)],
    ["revoked contractor Nevada", (r) => assert.match(r.definition?.body ?? "", /Revoked and suspended licenses are not in the active directory/)],
    ["unlicensed contractor Nevada", (r) => assert.match(r.failMessage ?? "", /Unlicensed respondents are not licensed contractor records/)],
    ["contractor complaint Nevada", (r) => assert.match(r.failMessage ?? "", /A complaint is not discipline/)],
    ["contractor Las Vegas", (r) => assert.match(r.failMessage ?? "", /6,013 active licenses list a Las Vegas address/)],
    ["contractor Reno", (r) => assert.match(r.failMessage ?? "", /Reno address .*Washoe County/)],
    ["contractor Henderson", (r) => assert.match(r.failMessage ?? "", /Henderson address .*Clark County/)],
  ];
  for (const [q, check] of cases) {
    const r = ask(q);
    assert.ok(r, `${q} must route to Nevada`);
    check(r!);
    assert.equal(r!.count, null, `${q} must not publish a single contractor count`);
    assert.equal(r!.aggregate, null, `${q} must not use the credential-row aggregate table`);
    assert.match(interpretAskQuery(q, {} as never).interpretation.notes.join(" "), /nv-con-001/, `${q} reaches Nevada through the main interpreter`);
  }
});

test("NV-CON-001 routing: bare numbers are not guessed, other states are not stolen, ranking refused, /ask keeps Nevada", () => {
  assert.equal(ask("Nevada contractor 0095506")?.interpretation.identifier ?? null, null, "a bare number without a license keyword is not an identifier");
  assert.equal(ask("contractor license 0095506"), null, "no Nevada intent, no Nevada routing");
  assert.equal(ask("roofer in Ohio"), null);
  assert.equal(ask("contractor Las Vegas NM"), null);
  assert.equal(ask("contractor Henderson Kentucky"), null);
  assert.equal(ask("contractor Reno Texas"), null);
  assert.match(interpretAskQuery("HIC Nashville", {} as never).interpretation.notes.join(" "), /tn-con-001/);
  assert.match(interpretAskQuery("HIC Massachusetts", {} as never).interpretation.notes.join(" "), /ma-con-001/);
  assert.doesNotMatch(interpretAskQuery("best contractor Nevada", {} as never).interpretation.notes.join(" "), /nv-con-001/);
  const discovery = { mode: "discovery", request: { state: "NV" } } as never;
  for (const q of ["contractor Las Vegas", "Nevada contractor qualifying party", "contractor Reno"]) assert.equal(researchRoute(q, discovery), "/ask", q);
});

test("NV-CON-001 route, sitemap, nav, metrics, and no local pages", () => {
  assert.equal(normalizedPublishedStatePath("/Nevada"), "/nevada");
  assert.equal(normalizedPublishedStatePath("/NEVADA"), "/nevada");
  assert.equal(normalizedPublishedStatePath("/nevada/las-vegas"), null);
  for (const c of ["las-vegas", "reno", "henderson"]) assert.equal(existsSync(`app/nevada/${c}`), false);
  assert.equal(readFileSync("lib/seo/sitemap-data.ts", "utf8").match(/"\/nevada"/g)?.length, 1);
  assert.match(readFileSync("lib/nav/header-nav.ts", "utf8"), /href: "\/nevada"/);
  assert.match(readFileSync("scripts/build_network_metrics_v1.mjs", "utf8"), /nevada: "NV"/);
  const page = readFileSync("app/nevada/page.tsx", "utf8");
  assert.doesNotMatch(page, /Nevada has [\d,]+ contractors|best contractor|safest|vetted|Trust Score is|aggregateRating|ratingValue/i);
  assert.match(page, /This page does not count Nevada contractors/);
  assert.ok(JSON.stringify(s).length < 40000, "accepted snapshot stays aggregate-sized for network metrics");
  assert.equal(summary.fingerprint, s.fingerprint);
});
