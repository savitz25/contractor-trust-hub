import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { dbUserFacingError, isDbQueryTimeout } from "../lib/db";
import {
  FLORIDA_RELATED_ENTITY_SQL,
  isUsableOfficerKey,
  normalizeOfficerKey,
} from "../lib/contractors/entity-lineage";

const parity = JSON.parse(
  readFileSync(new URL("./fixtures/officer-lookup-parity.json", import.meta.url), "utf8")
) as {
  limit: number;
  cases: Array<{ kind: string; normalizedKey: string; entityIds: string[]; count: number }>;
};

test("related-entity SQL uses the officer lookup and does not expand JSON", () => {
  const sql = FLORIDA_RELATED_ENTITY_SQL;
  assert.match(sql, /FROM entity_officer_lookup lookup/);
  assert.match(sql, /JOIN entities e ON e\.id = lookup\.entity_id/);
  assert.match(sql, /JOIN contractor_entities ce ON ce\.entity_id = e\.id/);
  assert.match(sql, /lookup\.officer_name_normalized = ANY\(\$2::text\[\]\)/);
  assert.match(sql, /NOT \(e\.id = ANY\(\$1::uuid\[\]\)\)/);
  assert.match(sql, /ce\.confidence >= 0\.90/);
  assert.match(sql, /LIMIT 40/);
  assert.doesNotMatch(sql, /jsonb_array_elements/);
  assert.doesNotMatch(sql, /regexp_replace/);
  const source = readFileSync(new URL("../lib/contractors/entity-lineage.ts", import.meta.url), "utf8");
  assert.equal(source.split("jsonb_array_elements").length, 1);
});

test("application officer keys keep the existing normalization contract", () => {
  assert.equal(normalizeOfficerKey(null), "");
  assert.equal(normalizeOfficerKey(undefined), "");
  assert.equal(normalizeOfficerKey("   "), "");
  assert.equal(normalizeOfficerKey("  Jane   Q.   Public  "), "JANE Q PUBLIC");
  assert.equal(normalizeOfficerKey("O'Brien"), "O BRIEN");
  assert.equal(normalizeOfficerKey('O"Brien'), "O BRIEN");
  assert.equal(normalizeOfficerKey("Smith-Jones"), "SMITH JONES");
  assert.equal(normalizeOfficerKey("Smith/Jones"), "SMITH JONES");
  assert.equal(normalizeOfficerKey("Smith, Jane"), "SMITH JANE");
  assert.equal(normalizeOfficerKey("Jane Public Jr."), "JANE PUBLIC");
  assert.equal(normalizeOfficerKey("Jane Public III"), "JANE PUBLIC");
  assert.equal(normalizeOfficerKey("Dr Jane Public"), "JANE PUBLIC");
  // Curly apostrophe is outside the supported punctuation class. Do not start stripping it here.
  assert.equal(normalizeOfficerKey("O\u2019Brien"), "O\u2019BRIEN");
  assert.equal(isUsableOfficerKey("J SMITH"), false);
  assert.equal(isUsableOfficerKey("JANE PUBLIC"), true);
  assert.equal(isUsableOfficerKey("ACME SERVICES LLC"), false);
  assert.equal(isUsableOfficerKey("JANE"), false);
});

test("frozen parity pack covers the lookup contract", () => {
  assert.equal(parity.limit, 40);
  assert.ok(parity.cases.length >= 25);
  const kinds = new Set(parity.cases.map((item) => item.kind));
  for (const kind of ["common", "apostrophe", "hyphen", "period", "comma", "slash", "suffix", "initial", "multi_entity"]) {
    assert.equal(kinds.has(kind), true, kind);
  }
  const seen = new Set<string>();
  for (const item of parity.cases) {
    assert.equal(seen.has(item.normalizedKey), false);
    seen.add(item.normalizedKey);
    assert.equal(item.entityIds.length, item.count);
    assert.ok(item.count >= 1 && item.count <= 40);
    assert.equal(new Set(item.entityIds).size, item.entityIds.length);
    for (const id of item.entityIds) {
      assert.match(id, /^[0-9a-f-]{36}$/);
    }
  }
});

test("postgres statement timeout stays a timeout, not a generic database error", () => {
  const error = new Error("canceling statement due to statement timeout");
  assert.equal(isDbQueryTimeout(error), true);
  assert.match(dbUserFacingError(error), /search took too long/);
  assert.doesNotMatch(dbUserFacingError(error), /unavailable/i);
});
