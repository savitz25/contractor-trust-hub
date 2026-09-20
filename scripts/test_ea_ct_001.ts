/**
 * EA-CT-001: pure-function coverage for the public-contact activation. Deterministic, no DB.
 * Identity-safety (exact license join, fail-closed, no cross-contractor leakage) is proven by the
 * SQL join structure itself (public_contact_observations.attributed_license_id -> licenses.id ->
 * licenses.contractor_id = $1) and re-verified live in scripts/verify_ea_ct_001.mjs against a real
 * database -- this file covers the deduplication/grouping/privacy logic that runs after the query.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTIVATED_CONTACT_KINDS,
  CONTACT_KIND_LABEL,
  dedupeContactsForDisplay,
  groupContactsByKind,
} from "../lib/contractors/public-contacts.ts";
import type { PublicContactDetail } from "../lib/contractors/types.ts";

function contact(over: Partial<PublicContactDetail>): PublicContactDetail {
  return {
    id: over.id ?? "obs-1",
    licenseId: over.licenseId ?? "lic-1",
    kind: over.kind ?? "phone",
    value: over.value ?? "(305) 555-0100",
    valueNormalized: over.valueNormalized ?? "3055550100",
    sourceSystem: over.sourceSystem ?? "mdc_opendata_issued",
    sourceUrl: "sourceUrl" in over ? (over.sourceUrl ?? null) : null,
    retrievedAt: "retrievedAt" in over ? (over.retrievedAt ?? null) : "2026-08-27T00:00:00.000Z",
    currentness: "currentness" in over ? (over.currentness ?? null) : null,
  };
}

// -------------------------------------------------------------- privacy / allowlist
test("1. only public, business-safe kinds are ever activated -- contact_name/contact_title are excluded", () => {
  assert.deepEqual(
    [...ACTIVATED_CONTACT_KINDS].sort(),
    ["additional_location", "email", "mailing_address", "phone", "phone_extension", "physical_address", "website"].sort()
  );
  assert.ok(!ACTIVATED_CONTACT_KINDS.includes("contact_name" as never));
  assert.ok(!ACTIVATED_CONTACT_KINDS.includes("contact_title" as never));
  for (const kind of ACTIVATED_CONTACT_KINDS) assert.ok(CONTACT_KIND_LABEL[kind], kind);
});

// -------------------------------------------------------------- dedup: same source+value never doubles
test("2. an exact duplicate observation (same license, kind, value) collapses to one displayed row", () => {
  const rows = [
    contact({ id: "a", retrievedAt: "2026-01-01T00:00:00.000Z" }),
    contact({ id: "b", retrievedAt: "2026-06-01T00:00:00.000Z" }),
  ];
  const deduped = dedupeContactsForDisplay(rows);
  assert.equal(deduped.length, 1, "the same (license, kind, value) observed twice must render once");
  assert.equal(deduped[0].id, "b", "the freshest retrievedAt wins, never an arbitrary pick");
});

// -------------------------------------------------------------- dedup: different sources confirming the SAME value still collapse
test("3. two different sources confirming the identical value still collapse to one row (corroboration, not two facts)", () => {
  const rows = [
    contact({ id: "a", sourceSystem: "mdc_opendata_issued", retrievedAt: "2026-01-01T00:00:00.000Z" }),
    contact({ id: "b", sourceSystem: "fl_dbpr_extract", retrievedAt: "2026-02-01T00:00:00.000Z" }),
  ];
  assert.equal(dedupeContactsForDisplay(rows).length, 1);
});

// -------------------------------------------------------------- distinct values are NEVER merged or overwritten
test("4. two DIFFERENT phone numbers for the same license are both preserved -- never overwritten", () => {
  const rows = [
    contact({ id: "a", value: "(305) 555-0100", valueNormalized: "3055550100" }),
    contact({ id: "b", value: "(305) 555-0199", valueNormalized: "3055550199" }),
  ];
  const deduped = dedupeContactsForDisplay(rows);
  assert.equal(deduped.length, 2, "distinct observed values are both history, never arbitrarily overwritten");
});

// -------------------------------------------------------------- different licenses never merge, even with an identical value
test("5. the same value observed on two DIFFERENT licenses is never merged into one row", () => {
  const rows = [
    contact({ id: "a", licenseId: "lic-1" }),
    contact({ id: "b", licenseId: "lic-2" }),
  ];
  assert.equal(dedupeContactsForDisplay(rows).length, 2, "a shared phone/address never implies shared identity between licenses");
});

// -------------------------------------------------------------- absent evidence produces no group at all (never a false "none found")
test("6. zero contacts produce zero groups -- never a synthesized empty-state claim", () => {
  assert.deepEqual(groupContactsByKind([]), []);
});

// -------------------------------------------------------------- grouping preserves every kind independently, fixed order
test("7. grouping buckets by kind in the fixed activation order and keeps every item", () => {
  const rows = [
    contact({ id: "a", kind: "email", value: "info@example.com", valueNormalized: "info@example.com" }),
    contact({ id: "b", kind: "phone", value: "(305) 555-0100", valueNormalized: "3055550100" }),
    contact({ id: "c", kind: "phone", value: "(305) 555-0199", valueNormalized: "3055550199" }),
  ];
  const groups = groupContactsByKind(rows);
  assert.deepEqual(groups.map((g) => g.kind), ["phone", "email"], "fixed ACTIVATED_CONTACT_KINDS order, not insertion order");
  assert.equal(groups.find((g) => g.kind === "phone")?.items.length, 2);
  assert.equal(groups.find((g) => g.kind === "email")?.items.length, 1);
});

// -------------------------------------------------------------- provenance/source clock survive unchanged
test("8. source system and retrieval date pass through unchanged for rendering", () => {
  const rows = [contact({ sourceSystem: "mdc_opendata_issued", retrievedAt: "2026-08-27T00:25:49.228Z" })];
  const [c] = dedupeContactsForDisplay(rows);
  assert.equal(c.sourceSystem, "mdc_opendata_issued");
  assert.equal(c.retrievedAt, "2026-08-27T00:25:49.228Z");
});

// -------------------------------------------------------------- a null retrievedAt never crashes ordering, never claims false freshness
test("9. a missing retrievedAt is handled without throwing and never treated as 'freshest'", () => {
  const rows = [
    contact({ id: "a", retrievedAt: null }),
    contact({ id: "b", retrievedAt: "2026-01-01T00:00:00.000Z" }),
  ];
  const deduped = dedupeContactsForDisplay(rows);
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].id, "b", "a real timestamp always outranks a missing one");
});
