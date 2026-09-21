/**
 * EA-CT-002 deterministic coverage. Pure function tests -- no database, no network.
 *   npx tsx scripts/test_permit_evidence.ts
 */
import assert from "node:assert/strict";
import {
  selectConfirmedPermitEvidence,
  getConfirmedDbprPermitEvidence,
} from "../lib/contractors/permit-evidence.ts";

let pass = 0;
let fail = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    pass += 1;
    console.log("PASS", name);
  } catch (e) {
    fail += 1;
    console.error("FAIL", name, String(e instanceof Error ? e.message : e));
  }
}
async function checkAsync(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    pass += 1;
    console.log("PASS", name);
  } catch (e) {
    fail += 1;
    console.error("FAIL", name, String(e instanceof Error ? e.message : e));
  }
}

const CONTRACTOR_A = "11111111-1111-4111-8111-111111111111";
const CONTRACTOR_B = "22222222-2222-4222-8222-222222222222";
// A different profile that happens to share a display name with A in the app layer (this fixture
// only carries ids -- the point is that name never enters this module's logic at all).
const CONTRACTOR_SAME_NAME = "33333333-3333-4333-8333-333333333333";
const LICENSE_A = "44444444-4444-4444-8444-444444444444";

/** A fully valid CONFIRMED/FULL_DBPR_LICENSE row for CONTRACTOR_A. Override fields per test. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function confirmedRow(overrides: Record<string, any> = {}) {
  return {
    attribution_id: "attr-1",
    identity_state: "CONFIRMED",
    identity_method: "FULL_DBPR_LICENSE",
    matched_contractor_id: CONTRACTOR_A,
    matched_license_id: LICENSE_A,
    license_contractor_id: CONTRACTOR_A,
    license_external_key: "CCC1332215",
    source_record_id: "permit-1",
    permit_number: "2025041429",
    source_system: "mdc_opendata_issued",
    county_slug: "miami-dade",
    permit_type_normalized: "bldg",
    work_description: "RE-ROOF",
    status_normalized: "issued",
    application_date: "2025-04-21",
    issue_date: "2025-04-29",
    final_date: null,
    property_address: "1985 SW 70 AVE",
    source_url: "https://opendata.miamidade.gov/datasets/example",
    retrieved_at: "2026-08-27T00:25:49.228Z",
    ...overrides,
  };
}

async function main() {
  // 1 -----------------------------------------------------------------------------------------------
  check("1. exact dual-linked contractor gets permit evidence", () => {
    const rows = selectConfirmedPermitEvidence([confirmedRow()], CONTRACTOR_A);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, "permit-1");
    assert.equal(rows[0].licenseExternalKey, "CCC1332215");
  });

  // 2 -----------------------------------------------------------------------------------------------
  check("2. wrong contractor gets nothing", () => {
    const rows = selectConfirmedPermitEvidence([confirmedRow()], CONTRACTOR_B);
    assert.deepEqual(rows, []);
  });

  // 3 -----------------------------------------------------------------------------------------------
  check("3. same-name contractor gets nothing without exact ID", () => {
    // The row is genuinely linked to CONTRACTOR_A's id. A different profile id -- even one meant to
    // represent "the same business name" at the app layer -- must get nothing: this module never
    // sees or reasons about names, only ids the Evidence Activation batch already confirmed.
    const rows = selectConfirmedPermitEvidence([confirmedRow()], CONTRACTOR_SAME_NAME);
    assert.deepEqual(rows, []);
  });

  // 4 -----------------------------------------------------------------------------------------------
  check("4. missing license bridge fails closed", () => {
    // (a) attribution claims CONFIRMED for this contractor, but the license side of the bridge is
    //     absent (e.g. the matched license row was deleted -- ON DELETE SET NULL left it null).
    const danglingLicense = confirmedRow({
      matched_license_id: null,
      license_contractor_id: null,
      license_external_key: null,
    });
    assert.deepEqual(selectConfirmedPermitEvidence([danglingLicense], CONTRACTOR_A), []);
    // (b) the license itself resolves, but to a DIFFERENT contractor than matched_contractor_id claims
    //     -- an inconsistent attribution row. Fails closed rather than trusting one FK alone.
    const inconsistent = confirmedRow({ license_contractor_id: CONTRACTOR_B });
    assert.deepEqual(selectConfirmedPermitEvidence([inconsistent], CONTRACTOR_A), []);
    // (c) no source_record_id at all -- never render an unresolved reference.
    const noPermitId = confirmedRow({ source_record_id: null });
    assert.deepEqual(selectConfirmedPermitEvidence([noPermitId], CONTRACTOR_A), []);
    // (d) identity_state is anything other than CONFIRMED (HIGH_CONFIDENCE, REVIEW_REQUIRED, UNRESOLVED).
    for (const state of ["HIGH_CONFIDENCE", "REVIEW_REQUIRED", "UNRESOLVED"]) {
      const notConfirmed = confirmedRow({ identity_state: state });
      assert.deepEqual(selectConfirmedPermitEvidence([notConfirmed], CONTRACTOR_A), [], state);
    }
    // (e) identity_method is CONFIRMED but not the exact-license method (defense against future methods).
    const otherMethod = confirmedRow({ identity_method: "LOCAL_CREDENTIAL_CANDIDATE" });
    assert.deepEqual(selectConfirmedPermitEvidence([otherMethod], CONTRACTOR_A), []);
  });

  // 5 -----------------------------------------------------------------------------------------------
  check("5. duplicate permit/lifecycle events do not inflate displayed permit count", () => {
    const older = confirmedRow({
      attribution_id: "attr-old",
      retrieved_at: "2026-08-01T00:00:00.000Z",
      status_normalized: "applied",
    });
    const newer = confirmedRow({
      attribution_id: "attr-new",
      retrieved_at: "2026-08-27T00:25:49.228Z",
      status_normalized: "issued",
    });
    const rows = selectConfirmedPermitEvidence([older, newer], CONTRACTOR_A);
    assert.equal(rows.length, 1, "same source_record_id must collapse to one displayed permit");
    assert.equal(rows[0].status, "issued", "keeps the most recently retrieved version, not the first seen");

    // A second, genuinely different permit (different source_record_id) must still count separately.
    const otherPermit = confirmedRow({
      source_record_id: "permit-2",
      permit_number: "2025041430",
      issue_date: "2025-05-01",
    });
    const rows2 = selectConfirmedPermitEvidence([older, newer, otherPermit], CONTRACTOR_A);
    assert.equal(rows2.length, 2);
  });

  // 6 -----------------------------------------------------------------------------------------------
  check("6. status/history preserved correctly", () => {
    const applied = confirmedRow({
      source_record_id: "permit-applied",
      status_normalized: "applied",
      application_date: "2025-01-01",
      issue_date: null,
      final_date: null,
    });
    const issued = confirmedRow({
      source_record_id: "permit-issued",
      status_normalized: "issued",
      application_date: "2025-02-01",
      issue_date: "2025-02-15",
      final_date: null,
    });
    const finaled = confirmedRow({
      source_record_id: "permit-final",
      status_normalized: "final",
      application_date: "2024-01-01",
      issue_date: "2024-01-10",
      final_date: "2024-06-01",
    });
    const rows = selectConfirmedPermitEvidence([applied, issued, finaled], CONTRACTOR_A);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    assert.equal(byId["permit-applied"].statusLabel, "Applied");
    assert.deepEqual(
      [byId["permit-applied"].applicationDate, byId["permit-applied"].issueDate, byId["permit-applied"].finalDate],
      ["2025-01-01", null, null]
    );
    assert.equal(byId["permit-issued"].statusLabel, "Issued");
    assert.equal(byId["permit-final"].statusLabel, "Final");
    assert.equal(byId["permit-final"].finalDate, "2024-06-01");
    // An unrecognized/unknown normalized status never becomes blank or crashes.
    const weird = confirmedRow({ source_record_id: "permit-weird", status_normalized: "unknown" });
    assert.equal(selectConfirmedPermitEvidence([weird], CONTRACTOR_A)[0].statusLabel, "Status not recorded");
  });

  // 7 -----------------------------------------------------------------------------------------------
  await checkAsync(
    '7. no permit evidence does not become "0 permits" unless the source denominator supports it',
    async () => {
      const empty = await getConfirmedDbprPermitEvidence(CONTRACTOR_A, {
        fetchCandidates: async () => [],
        fetchTotal: async () => 0,
      });
      assert.equal(empty.status, "unavailable");
      assert.ok(!("totalCount" in empty), "unavailable state must carry no numeric permit count at all");

      // Same outcome when candidates exist but none survive the identity filter (e.g. all REVIEW_REQUIRED).
      const onlyUnresolved = await getConfirmedDbprPermitEvidence(CONTRACTOR_A, {
        fetchCandidates: async () => [confirmedRow({ identity_state: "REVIEW_REQUIRED" })],
        fetchTotal: async () => 0,
      });
      assert.equal(onlyUnresolved.status, "unavailable");

      // A genuine source failure must ALSO stay "unavailable", never a false "0".
      const sourceError = await getConfirmedDbprPermitEvidence(CONTRACTOR_A, {
        fetchCandidates: async () => {
          throw new Error("connection reset");
        },
      });
      assert.equal(sourceError.status, "unavailable");
    }
  );

  // 8 -----------------------------------------------------------------------------------------------
  await checkAsync("8. source clocks/provenance render", async () => {
    const older = confirmedRow({ source_record_id: "permit-a", retrieved_at: "2026-08-01T00:00:00.000Z" });
    const newer = confirmedRow({
      source_record_id: "permit-b",
      permit_number: "999",
      retrieved_at: "2026-08-27T00:25:49.228Z",
    });
    const state = await getConfirmedDbprPermitEvidence(CONTRACTOR_A, {
      fetchCandidates: async () => [older, newer],
      fetchTotal: async () => 2,
    });
    assert.equal(state.status, "available");
    if (state.status !== "available") return;
    assert.equal(state.sourceLabel, "Miami-Dade County Open Data — Building Permits");
    assert.equal(state.retrievedAt, "2026-08-27T00:25:49.228Z", "aggregate retrievedAt is the MAX across rows");
    for (const row of state.rows) {
      assert.ok(row.retrievedAt);
      assert.ok(row.sourceLabel);
    }
    assert.equal(
      state.rows.find((r) => r.id === "permit-a")?.sourceUrl,
      "https://opendata.miamidade.gov/datasets/example"
    );
  });

  // 9 -----------------------------------------------------------------------------------------------
  check("9. no cross-jurisdiction identity leakage", () => {
    const miamiDadeForA = confirmedRow({ source_record_id: "permit-md", county_slug: "miami-dade" });
    // Same-shaped row, but genuinely confirmed to a DIFFERENT contractor in a different county.
    const browardForB = confirmedRow({
      source_record_id: "permit-broward",
      county_slug: "broward",
      matched_contractor_id: CONTRACTOR_B,
      license_contractor_id: CONTRACTOR_B,
      license_external_key: "CBC7777777",
    });
    const rowsForA = selectConfirmedPermitEvidence([miamiDadeForA, browardForB], CONTRACTOR_A);
    assert.equal(rowsForA.length, 1);
    assert.equal(rowsForA[0].jurisdictionLabel, "Miami-Dade County, FL");
    const rowsForB = selectConfirmedPermitEvidence([miamiDadeForA, browardForB], CONTRACTOR_B);
    assert.equal(rowsForB.length, 1);
    assert.equal(rowsForB[0].id, "permit-broward");
  });

  // 10 ----------------------------------------------------------------------------------------------
  check("10. deterministic ordering (no regression to arbitrary order)", () => {
    const many = Array.from({ length: 15 }, (_, i) =>
      confirmedRow({
        source_record_id: `permit-${i}`,
        permit_number: String(1000 + i),
        issue_date: `2025-01-${String(i + 1).padStart(2, "0")}`,
      })
    );
    const rows = selectConfirmedPermitEvidence(many, CONTRACTOR_A);
    assert.equal(rows.length, 15, "the pure filter itself returns every confirmed permit, unbounded");
    assert.equal(rows[0].issueDate, "2025-01-15", "most recent issue_date first");
    assert.equal(rows[rows.length - 1].issueDate, "2025-01-01");
  });
  await checkAsync(
    "10b. getConfirmedDbprPermitEvidence applies the display limit and reports hasMore truthfully",
    async () => {
      const many = Array.from({ length: 15 }, (_, i) =>
        confirmedRow({
          source_record_id: `permit-${i}`,
          permit_number: String(1000 + i),
          issue_date: `2025-01-${String(i + 1).padStart(2, "0")}`,
        })
      );
      const state = await getConfirmedDbprPermitEvidence(CONTRACTOR_A, {
        fetchCandidates: async () => many,
        fetchTotal: async () => many.length,
        limit: 10,
      });
      assert.equal(state.status, "available");
      if (state.status !== "available") return;
      assert.equal(state.totalCount, 15);
      assert.equal(state.rows.length, 10);
      assert.equal(state.hasMore, true);
    }
  );

  // 11 ----------------------------------------------------------------------------------------------
  await checkAsync(
    "11. a high-volume contractor's totalCount reflects the TRUE count, never the bounded candidate-scan length",
    async () => {
      // Regression test for a real defect found in preview verification: a candidate-row fetch is
      // capped (fetchPermitEvidenceCandidates' CANDIDATE_SCAN_LIMIT) for a very high-volume contractor
      // (observed in production: a major homebuilder with 2,043 confirmed permits). totalCount must
      // come from a real count, never from the length of that bounded fetch, or it silently understates
      // the true total for exactly the contractors with the most evidence.
      const cappedCandidateScan = Array.from({ length: 500 }, (_, i) =>
        confirmedRow({ source_record_id: `permit-${i}`, permit_number: String(2000 + i) })
      );
      const state = await getConfirmedDbprPermitEvidence(CONTRACTOR_A, {
        fetchCandidates: async () => cappedCandidateScan,
        fetchTotal: async () => 2043,
        limit: 10,
      });
      assert.equal(state.status, "available");
      if (state.status !== "available") return;
      assert.equal(state.totalCount, 2043, "must be the true total, not 500 (the capped candidate-scan length)");
      assert.equal(state.rows.length, 10);
      assert.equal(state.hasMore, true);
    }
  );

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
}

main();
