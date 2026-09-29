import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const data = JSON.parse(read("lib/indiana-intelligence/discipline.json"));
const snapshot = read("lib/indiana-intelligence/snapshot.ts");
const page = read("app/indiana/page.tsx");
const ask = read("lib/ask/indiana.ts");
const sitemap = read("lib/seo/sitemap-data.ts");
const paths = read("lib/seo/published-state-path.ts");

// Discipline corpus: bounded window, exact identifiers, categories kept apart.
assert.deepEqual(data.source.window[0], "2022-01-01");
assert.equal(data.summary.documentRows, data.rows.length);
assert.equal(data.rows.length, 159);
assert.equal(data.summary.distinctLicenses, new Set(data.rows.map((row) => row.licenseSha256)).size);
assert.deepEqual(Object.keys(data.summary.rowsByCategory).sort(), ["administrative_charging_complaint", "board_probation_on_application", "final_order", "procedural"]);
const classes = { "Plumbing Contractor": "person", "Journeyman Plumber": "person", "Plumbing Apprentice": "person", "Plumbing Corporation": "business" };
for (const row of data.rows) {
  assert.match(row.date, /^20(2[2-6])-\d\d-\d\d$/);
  assert.equal(classes[row.credentialClass], row.grain, row.credentialClass);
  assert.match(row.licenseSha256, /^[0-9a-f]{64}$/);
  if (row.grain === "person") {
    // Person grain: no license number, no document id, no name fields in the public repo.
    assert.equal(row.licenseNumber, null);
    assert.equal(row.documentId, null);
  } else {
    assert.match(row.licenseNumber, /^CO\d{8}$/);
    assert.match(row.documentId, /^\d+$/);
  }
  assert.deepEqual(Object.keys(row).sort(), ["category", "credentialClass", "date", "documentId", "documentType", "grain", "licenseNumber", "licenseSha256"]);
}
assert.deepEqual(data.limits, { exactProfileAttachments: 0, nameOnlyAdverseJoins: 0, newCanonicalCompanies: 0, graphWrites: 0, claimEligibilityChanges: 0, personNamesPublished: 0 });

// When the gitignored raw file is present, prove no person respondent name or person license leaks anywhere public.
const rawUrl = new URL("../data/raw/indiana/private/in-plumbing-discipline-raw.json", import.meta.url);
if (existsSync(rawUrl)) {
  const raw = JSON.parse(readFileSync(rawUrl, "utf8"));
  const publicText = [read("lib/indiana-intelligence/discipline.json"), snapshot, page, ask, read("docs/IN_CON_001.md")].join("\n").toLowerCase();
  // Generic words that also appear as code identifiers or copy; not identifying on their own.
  const GENERIC = new Set(["query"]);
  let checked = 0;
  for (const row of raw.rows) {
    if (row.license.startsWith("CO")) continue;
    assert.ok(!publicText.includes(row.license.toLowerCase()), "person license number published");
    for (const token of [row.col1, row.col2].map((v) => v.trim().toLowerCase()).filter((v) => v.length >= 4 && !GENERIC.has(v))) {
      assert.ok(!new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(publicText), "person respondent name published");
      checked++;
    }
  }
  console.log(`privacy: ${checked} person name tokens checked against public files`);
}

// Publication and boundary copy.
assert.match(page, /Indiana does not license most construction contractors statewide\./);
assert.match(snapshot, /The only construction contractors licensed by the State of Indiana are plumbers\./);
assert.match(page, /A Plumbing Contractor license is held by an individual\./);
assert.match(page, /LOCAL_CONTRACTOR_LICENSING = EXISTS \/ OUT_OF_SCOPE/);
assert.match(page, /not a contractor license/);
assert.match(page, /An administrative complaint is a charging document, not a finding/);
assert.match(page, /A complaint is not a disciplinary finding/);
assert.match(page, /NOT_ACQUIRED/);
assert.match(snapshot, /indiana: 500, outOfState: 69/);
assert.match(snapshot, /professionTotal: \{ indiana: 7652, outOfState: 669 \}/);
assert.equal((sitemap.match(/path: "\/indiana"/g) ?? []).length, 1);
assert.match(paths, /"indiana"/);
assert.doesNotMatch(page + ask + snapshot, /AggregateRating|ratingValue|Trust Score|best contractors|top-rated|recommended contractors/i);
console.log("Indiana publication, plumbing grain, discipline categories, privacy, local boundary and ranking safety: PASS");
