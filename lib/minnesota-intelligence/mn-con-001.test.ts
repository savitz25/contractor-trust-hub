import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { interpretMinnesota } from "../ask/minnesota";
import { interpretAskQuery } from "../ask/interpret";
import { normalizeAskText } from "../ask/ontology";
import { researchRoute } from "../ask/request";
import { normalizedPublishedStatePath } from "../seo/published-state-path";
import summary from "./summary.json";
import events from "./events.json";
import labels from "./credential-labels.json";
import { assertMinnesotaSnapshot } from "./snapshot";

const s = assertMinnesotaSnapshot();
const ask = (q: string) => interpretMinnesota(q, normalizeAskText(q));
type Row = { n: string; k: number; g: "B" | "P"; s: string; ea: number } & Record<string, unknown>;
const DIR = "lib/minnesota-intelligence/credentials";

function allRows(): Row[] {
  return readdirSync(DIR).flatMap((f) => JSON.parse(readFileSync(`${DIR}/${f}`, "utf8")) as Row[]);
}

test("MN-CON-001 grains: business != person != bond != certification != registration; residential classes separate", () => {
  const x = s.statewide_export;
  assert.equal(x.busPers.Business + x.busPers.Personal, x.rows);
  assert.equal(Object.values(x.statusAsPrinted).reduce((a, b) => a + b, 0), x.rows);
  assert.equal(Object.values(x.statusGroupedCaseInsensitive).reduce((a, b) => a + b, 0), x.rows);
  assert.ok("Issued" in x.statusAsPrinted && "ISSUED" in x.statusAsPrinted, "status kept exactly as printed, mixed case");
  for (const l of labels) assert.ok(["business", "person"].includes(l.grain) && ["license", "registration", "bond", "certification", "exemption", "sponsor_approval"].includes(l.kind), l.subtype);
  assert.equal(labels.reduce((a, l) => a + l.rows, 0), x.rows);
  const sub = (name: string) => labels.find((l) => l.subtype === name)!;
  assert.equal(sub("Residential Building Contractor").grain, "business");
  assert.equal(sub("Residential Remodeler Contractor").grain, "business");
  assert.equal(sub("Residential Roofer Contractor").grain, "business");
  assert.equal(sub("Qualifying Builder").grain, "person");
  assert.equal(sub("Class A Electrical Contractor").grain, "business");
  assert.equal(sub("Class A Master Electrician").grain, "person");
  assert.equal(sub("Plumbing Contractor").grain, "business");
  assert.equal(sub("Master Plumber").grain, "person");
  assert.equal(sub("Mechanical Contractor Bond").kind, "bond");
  assert.equal(sub("Certificate of Exemption").kind, "exemption");
  assert.equal(sub("Backflow Prevention Tester").kind, "certification");
  assert.equal(sub("Business Entity").kind, "registration");
  assert.equal(s.existing_coverage.databaseModified, false);
  const r = s.existing_coverage.reconciliation;
  assert.equal(r.exportCredentialsAlsoInDatabase + r.exportCredentialsNotInDatabase, x.rows);
  assert.equal(r.exportCredentialsAlsoInDatabase + r.databaseCredentialsNotInExport, s.existing_coverage.database.licenseRows);
  assert.equal(s.statewide_export.asOfPrintedByDli, null);
});

test("MN-CON-001 shards: every credential once, person rows number-only, no phones, emails, or street addresses", () => {
  const seen = new Set<string>();
  for (const f of readdirSync(DIR)) {
    const text = readFileSync(`${DIR}/${f}`, "utf8");
    for (const r of JSON.parse(text) as Row[]) {
      assert.equal(seen.has(r.n), false, r.n);
      seen.add(r.n);
      assert.equal(r.n.replace(/\D/g, "").slice(-2).padStart(2, "0"), f.replace(".json", ""));
      for (const k of Object.keys(r)) assert.ok(!/email|phone|addr|street/i.test(k), k);
      if (r.g === "P") for (const k of ["name", "dba", "city", "zip"]) assert.equal(k in r, false, `${r.n} person row carries ${k}`);
      assert.equal(labels[r.k].grain, r.g === "B" ? "business" : "person");
    }
    assert.doesNotMatch(text, /[\w.+-]+@[\w-]+\.[a-z]{2,}|\(\d{3}\)\s?\d{3}-\d{4}|\b\d{3}-\d{3}-\d{4}\b/);
  }
  assert.equal(seen.size, s.statewide_export.rows);
  const manifest = readFileSync("data/minnesota/mn-con-001/export-manifest.json", "utf8");
  assert.doesNotMatch(manifest, /\(\d{3}\)\s?\d{3}-\d{4}|@/);
});

test("MN-CON-001 enforcement attaches only by an exact credential number DLI printed", () => {
  const byNumber = new Map(allRows().map((r) => [r.n, r]));
  assert.equal(events.length, s.enforcement.rows);
  let attached = 0;
  for (const e of events) {
    assert.ok(e.actionDate >= "2024-01-01" && e.actionDate <= "2026-09-26", e.actionDate);
    for (const n of e.credentialNumbersInExport) assert.ok(byNumber.has(n) && e.credentialNumbersPrinted.includes(n));
    for (const n of e.credentialNumbersNotInExport) assert.ok(!byNumber.has(n) && e.credentialNumbersPrinted.includes(n));
    if (e.attribution === "exact_credential_number_in_export") attached += 1;
    else if (e.attribution === "standalone_event_no_credential_number") assert.equal(e.credentialNumbersPrinted.length, 0);
    else assert.equal(e.attribution, "exact_credential_number_not_in_export");
  }
  assert.equal(attached, s.enforcement.rowsAttachedByExactCredentialNumber);
  const xl = events.filter((e) => e.credentialNumbersInExport.includes("BC800029"));
  assert.ok(xl.length >= 1 && xl.every((e) => /XL Outdoor Living/i.test(e.respondent)));
  // Respondents without a printed number are never attached, even when a same-name business exists in the export.
  const standalone = events.filter((e) => e.attribution === "standalone_event_no_credential_number");
  assert.ok(standalone.length > 0 && standalone.every((e) => e.credentialNumbersInExport.length === 0));
  assert.equal(s.enforcement.nameOnlyAttachment, false);
});

test("MN-CON-001 search acceptance matrix", () => {
  const cases: Array<[string, (r: NonNullable<ReturnType<typeof ask>>) => void]> = [
    ["contractor Minnesota", (r) => assert.match(r.failMessage ?? "", /not a count of Minnesota contractors/)],
    ["licensed contractor Minnesota", (r) => assert.match(r.failMessage ?? "", /280,548 credential numbers/)],
    ["residential building contractor Minnesota", (r) => assert.match(r.failMessage ?? "", /15,291 rows .* 10,923 with status Issued/)],
    ["residential remodeler Minnesota", (r) => assert.match(r.failMessage ?? "", /Residential Remodeler Contractor license/)],
    ["residential roofer Minnesota", (r) => assert.match(r.failMessage ?? "", /Residential Roofer Contractor license/)],
    ["Minnesota contractor license BC800029", (r) => assert.equal(r.definition?.href, "/minnesota?credential=BC800029#credential-lookup")],
    ["DLI license BC800029", (r) => assert.equal(r.interpretation.identifier, "MN-DLI:BC800029")],
    ["Minnesota roofer license RR123456", (r) => assert.equal(r.interpretation.identifier, "MN-DLI:RR123456")],
    ["electrical contractor Minnesota", (r) => assert.match(r.failMessage ?? "", /Class A Electrical Contractor licenses are held by businesses/)],
    ["electrician Minnesota", (r) => assert.match(r.failMessage ?? "", /licensed as individuals/)],
    ["plumbing contractor Minnesota", (r) => assert.match(r.failMessage ?? "", /Plumbing Contractor licenses are held by businesses/)],
    ["plumber Minnesota", (r) => assert.match(r.failMessage ?? "", /Plumbers are licensed as individuals/)],
    ["contractor enforcement Minnesota", (r) => assert.match(r.definition?.body ?? "", /511 actions/)],
    ["contractor complaint Minnesota", (r) => assert.match(r.failMessage ?? "", /A complaint is not a finding/)],
    ["contractor license status Minnesota", (r) => assert.match(r.failMessage ?? "", /only "Issued" is current/)],
    ["contractor Minneapolis", (r) => assert.match(r.failMessage ?? "", /Minneapolis address of record \(Hennepin County\)/)],
    ["contractor St Paul", (r) => assert.match(r.failMessage ?? "", /St\. Paul address of record \(Ramsey County\)/)],
    ["contractor Rochester Minnesota", (r) => assert.match(r.failMessage ?? "", /Rochester address of record \(Olmsted County\)/)],
    ["contractor Duluth", (r) => assert.match(r.failMessage ?? "", /Duluth address of record \(St\. Louis County\)/)],
    ["mechanical contractor bond Minnesota", (r) => assert.match(r.failMessage ?? "", /not an identity, a contractor count, a quality score, or insurance/)],
    ["qualifying builder Minnesota", (r) => assert.match(r.failMessage ?? "", /are not contractors/)],
  ];
  for (const [q, check] of cases) {
    const r = ask(q);
    assert.ok(r, `${q} must route to Minnesota`);
    check(r!);
    assert.equal(r!.count, null, `${q} must not publish a single contractor count`);
    assert.equal(r!.aggregate, null);
    assert.match(interpretAskQuery(q, {} as never).interpretation.notes.join(" "), /mn-con-001/, `${q} reaches Minnesota through the main interpreter`);
  }
});

test("MN-CON-001 routing: bare numbers fail closed, other states kept, ranking refused", () => {
  assert.equal(ask("Minnesota contractor license 800029")?.interpretation.identifier ?? null, null);
  assert.match(ask("Minnesota contractor license 800029")?.failMessage ?? "", /not guessed/);
  assert.equal(ask("contractor Rochester"), null, "Rochester alone is not Minnesota");
  assert.equal(ask("contractor Rochester NY"), null);
  assert.equal(ask("contractor Duluth GA"), null);
  assert.equal(ask("contractor Duluth Georgia"), null);
  assert.equal(ask("roofer in Ohio"), null);
  assert.equal(ask("DLI contractor Pennsylvania"), null);
  assert.equal(ask("contractor license BC800029"), null, "no Minnesota intent, no Minnesota routing");
  assert.notEqual(interpretAskQuery("RR123456", {} as never).interpretation.identifier, "MN-DLI:RR123456", "Florida identifiers keep Florida without Minnesota intent");
  assert.match(interpretAskQuery("contractor Las Vegas", {} as never).interpretation.notes.join(" "), /nv-con-001/);
  assert.match(interpretAskQuery("HIC Nashville", {} as never).interpretation.notes.join(" "), /tn-con-001/);
  assert.doesNotMatch(interpretAskQuery("best contractor Minnesota", {} as never).interpretation.notes.join(" "), /mn-con-001/);
  const discovery = { mode: "discovery", request: { state: "MN" } } as never;
  for (const q of ["contractor Minneapolis", "contractor St. Paul", "electrician Minnesota"]) assert.equal(researchRoute(q, discovery), "/ask", q);
});

test("MN-CON-001 route, sitemap, nav, metrics, page wording, and no city pages", () => {
  assert.equal(normalizedPublishedStatePath("/Minnesota"), "/minnesota");
  assert.equal(normalizedPublishedStatePath("/MINNESOTA"), "/minnesota");
  assert.equal(normalizedPublishedStatePath("/minnesota/minneapolis"), null);
  for (const c of ["minneapolis", "st-paul", "saint-paul", "rochester", "duluth"]) assert.equal(existsSync(`app/minnesota/${c}`), false);
  assert.equal(readFileSync("lib/seo/sitemap-data.ts", "utf8").match(/"\/minnesota"/g)?.length, 1);
  assert.match(readFileSync("lib/nav/header-nav.ts", "utf8"), /href: "\/minnesota"/);
  assert.match(readFileSync("scripts/build_network_metrics_v1.mjs", "utf8"), /minnesota: "MN"/);
  const page = readFileSync("app/minnesota/page.tsx", "utf8");
  assert.doesNotMatch(page, /Minnesota has [\d,]+ contractors|construction professionals =|best contractor|safest|vetted|aggregateRating|ratingValue/i);
  assert.match(page, /does\s+not count Minnesota contractors/);
  assert.ok(JSON.stringify(s).length < 40000, "accepted snapshot stays aggregate-sized for network metrics");
  assert.equal(summary.fingerprint, s.fingerprint);
});
