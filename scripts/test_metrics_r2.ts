import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  partitionCredentials,
  classifyCredentialStatus,
  STATUS_BUCKETS,
} from "../lib/metrics/credential-status";
import { count, exactCountHeader } from "../lib/metrics/accepted-contract";
import { HOMEPAGE_EVIDENCE_INVENTORY } from "../lib/home-intel/evidence-inventory";
const read = (p: string) =>
  JSON.parse(readFileSync(new URL("../" + p, import.meta.url), "utf8"));
const m = read("data/home/contractor-network-metrics-v1.json"),
  co = read("lib/colorado-intelligence/accepted-snapshot.json");
test("Historical CO overlay omitted every non-exact-Active credential", () => {
  const rows = ["EC", "PC"].flatMap((c) =>
    Object.entries(co.business_credentials[c].status_counts).map(
      ([normalizedStatus, rows]) => ({
        normalizedStatus,
        rows: rows as number,
      }),
    ),
  );
  const universe = rows.reduce((n, r) => n + r.rows, 0),
    old = rows
      .filter((r) => r.normalizedStatus === "Active")
      .reduce((n, r) => n + r.rows, 0);
  assert.equal(universe, 17910);
  assert.equal(universe - old, 9974);
  const result = partitionCredentials(rows, universe);
  assert.equal(result.expired, 9508);
  assert.equal(result.revoked, 50);
  assert.equal(result.other, 414);
  assert.equal(result.suspended, 2);
  assert.equal(
    Object.values(result).reduce((n, v) => n + v, 0),
    universe,
  );
});
test("Every accepted group belongs to exactly one bucket or explicit cohort exclusion", () => {
  const r = m.statusReconciliation;
  assert.equal(r.sourceUniverse, r.includedUniverse + r.explicitExclusions);
  assert.equal(r.includedUniverse, r.partitionSum);
  assert.equal(r.unexplainedRemainder, 0);
  assert.equal(r.includedUniverse, 662331);
  assert.equal(new Set(STATUS_BUCKETS).size, STATUS_BUCKETS.length);
  for (const g of r.groups) {
    assert.equal(g.bucket, classifyCredentialStatus(g.normalizedStatus));
    assert.equal(STATUS_BUCKETS.filter((s) => s === g.bucket).length, 1);
  }
  assert.deepEqual(
    partitionCredentials(
      r.groups.filter((g: any) => g.included),
      r.includedUniverse,
    ),
    m.licensingStatus.liveCohort,
  );
  assert.throws(
    () => partitionCredentials([{ normalizedStatus: "active", rows: 1 }], 2),
    /remainder/,
  );
});
test("Novel, blank, missing and conditional statuses are evidence-preserving OTHER", () => {
  for (const status of [
    null,
    "",
    "Novel status",
    "Active - With Conditions",
    "Need Master Hire - Cannot Practice",
  ])
    assert.equal(classifyCredentialStatus(status), "other");
});
test("Person, permit and document grains do not enter CO business or live credential totals", () => {
  const coGroups = m.statusReconciliation.groups.filter(
    (g: any) => g.source === "co_dora",
  );
  assert.deepEqual(
    [...new Set(coGroups.map((g: any) => g.credentialClass))].sort(),
    ["EC", "PC"],
  );
  for (const state of ["CO", "VA", "NY", "IL"])
    assert.ok(m.acceptedStateDatasets[state]);
  const rows = m.homepageEvidence;
  assert.equal(
    rows.find((r: any) => r.id === "il-roofing-active-business").count,
    4675,
  );
  assert.equal(
    rows.find(
      (r: any) => r.id === "IL_qualifying_parties_active_distinct_license_ids",
    ).count,
    12042,
  );
  assert.equal(
    rows.find((r: any) => r.id === "new_york_city_dob_dob_now_parsed_rows")
      .count,
    337613,
  );
  assert.equal(
    rows.find((r: any) => r.id === "new_york_city_acris_master_parsed_rows")
      .count,
    581566,
  );
  assert.equal(rows.find((r: any) => r.id === "va-class-abc").count, 53840);
});
test("Homepage values equal generated evidence; source clocks never become generation time", () => {
  assert.deepEqual(HOMEPAGE_EVIDENCE_INVENTORY, m.homepageEvidence);
  const row = m.homepageEvidence.find(
    (r: any) => r.id === "new_york_city_acris_master_parsed_rows",
  );
  assert.equal(row.sourceAsOf, "2026-09-08");
  assert.equal(row.retrievedAt, "2026-09-12T17:05:27Z");
  assert.equal(row.snapshotAsOf, "2026-09-12");
  assert.equal(row.generatedAt, m.generatedAt);
});
test("Unknown counts fail closed; known acquired zero remains valid", () => {
  for (const value of [null, undefined, NaN, -1, "0"])
    assert.throws(() => count(value, "missing"));
  assert.equal(count(0, "acquired"), 0);
  assert.equal(exactCountHeader("*/0"), 0);
  for (const h of [null, "0-0/*", ""]) assert.throws(() => exactCountHeader(h));
});
