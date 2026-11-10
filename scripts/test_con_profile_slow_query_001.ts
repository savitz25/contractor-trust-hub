import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PoolClient } from "pg";
import { EntityLineageSection } from "../components/contractor/EntityLineageSection";
import { loadFloridaEntityLineage } from "../lib/contractors/entity-lineage";
import type { EntityDetail } from "../lib/contractors/types";
import { withDbClient } from "../lib/db";

// The standalone tsx test runner compiles this Next JSX component in classic mode.
(globalThis as typeof globalThis & { React: typeof React }).React = React;

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
  const linked = { ...primary, id: "22222222-2222-4222-8222-222222222222", externalKey: "P87654321", legalName: "Linked Entity One LLC" };
  const linkedTwo = { ...primary, id: "33333333-3333-4333-8333-333333333333", externalKey: "P45678912", legalName: "Linked Entity Two LLC" };
  const lineage = await loadFloridaEntityLineage([primary, linked, linkedTwo], { includeGlobalRelated: false });
  assert.ok(lineage);
  assert.deepEqual(lineage.related.map((entity) => entity.documentNumber), [linked.externalKey, linkedTwo.externalKey]);
  assert.ok(lineage.related.every((entity) => entity.matchedOfficerNames.length === 0));
  assert.match(lineage.evidenceNote, /high-confidence linked to this same contractor/);
  assert.match(lineage.evidenceNote, /Cross-entity officer-name expansion is not included/);
  assert.doesNotMatch(lineage.evidenceNote, /same officer|exact.name association|shared those principal names/i);
  const markup = renderToStaticMarkup(React.createElement(EntityLineageSection, { lineage }));
  assert.match(markup, /Linked Entity One LLC/);
  assert.match(markup, /Linked Entity Two LLC/);
  assert.match(markup, /Other entities linked to this contractor/);
  assert.match(markup, /already high-confidence linked to this same contractor/);
  assert.match(markup, /Cross-entity officer-name expansion is not included/);
  assert.doesNotMatch(markup, /cross-entity associations shown use exact normalized/i);
});

test("no usable principals keeps directly linked entities without implying a global search", async () => {
  const linked = { ...primary, id: "22222222-2222-4222-8222-222222222222", externalKey: "P87654321", officers: [] };
  const noUsablePrincipals = { ...primary, officers: [{ name: "Jane", title: "Manager" }] };
  const lineage = await loadFloridaEntityLineage([noUsablePrincipals, linked], { includeGlobalRelated: false });
  assert.ok(lineage);
  assert.deepEqual(lineage.related.map((entity) => entity.documentNumber), [linked.externalKey]);
  assert.match(lineage.evidenceNote, /published officer information shown comes from the high-confidence Sunbiz link/i);
  assert.match(lineage.evidenceNote, /high-confidence linked to this same contractor/);
  assert.match(lineage.evidenceNote, /Cross-entity officer-name expansion is not included/);
  assert.doesNotMatch(lineage.evidenceNote, /No additional entities shared those principal names/i);
});

test("opt-in global matches retain exact principal wording without overstating identity", async () => {
  let globalQueries = 0;
  const matchedRow = {
    id: "44444444-4444-4444-8444-444444444444",
    external_key: "P44444444",
    legal_name: "Officer Match LLC",
    status: "ACTIVE",
    entity_type: "Florida Limited Liability Company",
    formation_date: null,
    officers: [],
    last_verified_at: null,
    matched_key: "JANE EXAMPLE",
  };
  const fakeClient = {
    query: async (sql: string) => {
      if (sql.includes("SELECT DISTINCT ON (e.id, matched_key)")) {
        globalQueries += 1;
        return { rows: [matchedRow] };
      }
      return { rows: [] };
    },
  } as unknown as PoolClient;
  const lineage = await withDbClient(fakeClient, () =>
    loadFloridaEntityLineage([primary], { includeGlobalRelated: true }),
  );
  assert.ok(lineage);
  assert.equal(globalQueries, 1);
  assert.deepEqual(lineage.related[0].matchedOfficerNames, ["Jane Example"]);
  const markup = renderToStaticMarkup(React.createElement(EntityLineageSection, { lineage }));
  assert.match(markup, /cross-entity associations shown use exact normalized officer\/principal names/);
  assert.match(markup, /not proof of shared ownership or misconduct/);
  assert.doesNotMatch(markup, /Cross-entity officer-name expansion is not included/);
});

test("profile SSR explicitly disables the global officer scan", () => {
  const page = readFileSync(new URL("../app/contractors/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(page, /loadFloridaEntityLineage\(contractor\.entities, \{ includeGlobalRelated: false \}\)/);
});
