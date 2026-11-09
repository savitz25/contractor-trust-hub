import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadFloridaEntityLineage } from "../lib/contractors/entity-lineage";
import type { EntityDetail } from "../lib/contractors/types";

const primary: EntityDetail = {
  id: "11111111-1111-4111-8111-111111111111",
  externalKey: "P12345678",
  legalName: "Example Contractor LLC",
  status: "ACTIVE",
  entityType: "Florida Limited Liability Company",
  formationDate: "2020-01-01",
  principalAddress: null,
  city: "Miami",
  state: "FL",
  postalCode: null,
  registeredAgentName: null,
  officers: [{ name: "Jane Example", title: "Manager" }],
  matchMethod: "document_number",
  matchConfidence: 0.99,
  lastVerifiedAt: "2026-11-01T00:00:00Z",
  sourceSystem: "fl_sunbiz",
};

test("SSR keeps the primary Sunbiz entity and officers without global expansion", async () => {
  const lineage = await loadFloridaEntityLineage([primary], { includeGlobalRelated: false });
  assert.ok(lineage);
  assert.equal(lineage.primary.documentNumber, primary.externalKey);
  assert.equal(lineage.primary.matchConfidence, primary.matchConfidence);
  assert.deepEqual(lineage.primary.officers.map((officer) => officer.name), ["Jane Example"]);
  assert.deepEqual(lineage.related, []);
  assert.match(lineage.evidenceNote, /Cross-entity officer-name expansion is not included/);
});

test("other entities already linked to the same contractor remain available", async () => {
  const linked = { ...primary, id: "22222222-2222-4222-8222-222222222222", externalKey: "P87654321" };
  const lineage = await loadFloridaEntityLineage([primary, linked], { includeGlobalRelated: false });
  assert.ok(lineage);
  assert.equal(lineage.related.length, 1);
  assert.equal(lineage.related[0].documentNumber, linked.externalKey);
  assert.deepEqual(lineage.related[0].matchedOfficerNames, []);
  assert.match(lineage.evidenceNote, /high-confidence linked to this same contractor/);
});

test("profile SSR explicitly disables the global officer scan", () => {
  const page = readFileSync(new URL("../app/contractors/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(page, /loadFloridaEntityLineage\(contractor\.entities, \{ includeGlobalRelated: false \}\)/);
});
