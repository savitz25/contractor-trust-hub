/**
 * CON-OSHA-002 publication allow-list. Default remains Florida and New Jersey.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OshaSafetyRecord } from "../components/contractor/OshaSafetyRecord";
import { previewRecord } from "../data/preview/con-osha-001-fixtures";
import {
  isOshaDetailEnabled,
  isOshaProfileEnabled,
  oshaPublishedStates,
  OSHA_DETAIL_FLAG,
  OSHA_PROFILE_FLAG,
  OSHA_PROFILE_STATES_FLAG,
} from "../lib/osha/flag";
import {
  formatCurrentCitedPenalty,
  isOshaPilotState,
  loadPublicOshaMatches,
  oshaStateLicenseLabel,
  toPublicOshaRecord,
} from "../lib/osha/public-record";
import { OSHA_PREVIEW_SAMPLES } from "../data/preview/con-osha-001-fixtures";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const EXPANSION = ["CA", "VA", "LA", "NV", "AZ", "TN"] as const;

function source(overrides: Record<string, unknown> = {}) {
  return { ...OSHA_PREVIEW_SAMPLES[0].source, ...overrides };
}

test("publication allow-list defaults to Florida and New Jersey", () => {
  assert.deepEqual([...oshaPublishedStates({})], ["FL", "NJ"]);
  assert.deepEqual([...oshaPublishedStates({ [OSHA_PROFILE_STATES_FLAG]: "  " })], ["FL", "NJ"]);
  assert.equal(isOshaPilotState("FL", {}), true);
  assert.equal(isOshaPilotState("CA", {}), false);
  assert.equal(isOshaPilotState("TX", {}), false);
});

test("each expansion state can be added and Florida and New Jersey stay published", () => {
  for (const state of EXPANSION) {
    assert.deepEqual(
      [...oshaPublishedStates({ [OSHA_PROFILE_STATES_FLAG]: state })],
      ["FL", "NJ", state],
    );
    assert.equal(isOshaPilotState(state, { [OSHA_PROFILE_STATES_FLAG]: state }), true);
  }
  assert.deepEqual(
    [...oshaPublishedStates({ [OSHA_PROFILE_STATES_FLAG]: "CA,VA,LA,NV,AZ,TN" })],
    ["FL", "NJ", "CA", "VA", "LA", "NV", "AZ", "TN"],
  );
});

test("unknown states fail closed to Florida and New Jersey", () => {
  for (const raw of ["MA", "GA", "OH", "NC", "CA,TX", "CA,MA", "not-a-state"]) {
    assert.deepEqual([...oshaPublishedStates({ [OSHA_PROFILE_STATES_FLAG]: raw })], ["FL", "NJ"]);
    assert.equal(isOshaPilotState("CA", { [OSHA_PROFILE_STATES_FLAG]: raw }), false);
  }
});

test("profile and detail flags stay independent of the state list", () => {
  const env = {
    [OSHA_PROFILE_FLAG]: "1",
    [OSHA_DETAIL_FLAG]: "off",
    [OSHA_PROFILE_STATES_FLAG]: "CA",
  };
  assert.equal(isOshaProfileEnabled(env), true);
  assert.equal(isOshaDetailEnabled(env), false);
  assert.equal(isOshaProfileEnabled({ [OSHA_PROFILE_STATES_FLAG]: "CA" }), false);
  assert.equal(isOshaDetailEnabled({ [OSHA_PROFILE_FLAG]: "1", [OSHA_PROFILE_STATES_FLAG]: "CA" }), false);
});

test("default read path does not query an expansion state", async () => {
  let queries = 0;
  const hidden = await loadPublicOshaMatches(
    { contractorId: "c-1", homeState: "CA", licenseKeys: ["100"] },
    { enabled: true, env: {}, query: async () => { queries += 1; return []; } },
  );
  assert.equal(hidden.queryCount, 0);
  assert.equal(queries, 0);
  assert.equal(toPublicOshaRecord(source({ state: "CA" }), {}), null);
  const closed = await loadPublicOshaMatches(
    { contractorId: "c-1", homeState: "CA", licenseKeys: ["100"] },
    { enabled: true, env: { [OSHA_PROFILE_STATES_FLAG]: "CA,OH" }, query: async () => { queries += 1; return []; } },
  );
  assert.equal(closed.queryCount, 0);
  assert.equal(queries, 0);
});

test("an allowed expansion state reaches the existing aggregate query", async () => {
  let queries = 0;
  const result = await loadPublicOshaMatches(
    { contractorId: "c-1", homeState: "CA", licenseKeys: ["100"] },
    {
      enabled: true,
      env: { [OSHA_PROFILE_STATES_FLAG]: "CA" },
      query: async () => {
        queries += 1;
        return [{
          id: "m-1",
          license_key: "100",
          state: "CA",
          match_tier: "exact",
          n_inspections: 1,
          first_open: "2020-01-01",
          last_open: "2020-01-01",
          n_citation_items: 0,
          n_serious: 0,
          current_penalty_amount: 0,
          n_with_final_order: 0,
          n_contested: 0,
        }];
      },
    },
  );
  assert.equal(queries, 1);
  assert.equal(result.records?.[0]?.state, "CA");
  assert.equal(result.records?.[0]?.licenseKey, "100");
});

test("detail query stays behind the publication allow-list", () => {
  const loader = read("lib/osha/load-inspection-details.ts");
  const gate = loader.indexOf("isOshaPilotState(input.state, env)");
  const firstQuery = loader.indexOf("await run");
  assert.ok(gate > 0 && firstQuery > gate);
  assert.match(loader, /if \(!isOshaDetailEnabled\(\)\)/);
  assert.doesNotMatch(loader, /\["FL", "NJ"\]\.includes\(input\.state\)/);
  assert.equal(isOshaPilotState("CA", {}), false);
  assert.equal(isOshaPilotState("FL", { [OSHA_PROFILE_STATES_FLAG]: "CA" }), true);
  assert.equal(isOshaDetailEnabled({ [OSHA_DETAIL_FLAG]: "off", [OSHA_PROFILE_STATES_FLAG]: "CA" }), false);
});

test("Florida and New Jersey labels stay the same and other states are named", () => {
  const florida = previewRecord("fl-exact-multi");
  const jersey = previewRecord("nj-exact-multi");
  assert.ok(florida && jersey);
  const floridaHtml = renderToStaticMarkup(React.createElement(OshaSafetyRecord, {
    records: [florida],
    correctionHref: "/corrections",
  }));
  const jerseyHtml = renderToStaticMarkup(React.createElement(OshaSafetyRecord, {
    records: [jersey],
    correctionHref: "/corrections",
  }));
  assert.match(floridaHtml, /Florida license CGC011008/);
  assert.match(jerseyHtml, /New Jersey license 13VH05973500/);
  assert.equal(oshaStateLicenseLabel("CA", "100"), "California license 100");
  assert.equal(oshaStateLicenseLabel("VA", "2705"), "Virginia license 2705");
  assert.equal(oshaStateLicenseLabel("LA", "123"), "Louisiana license 123");
  assert.equal(oshaStateLicenseLabel("NV", "123"), "Nevada license 123");
  assert.equal(oshaStateLicenseLabel("AZ", "123"), "Arizona license 123");
  assert.equal(oshaStateLicenseLabel("TN", "123"), "Tennessee license 123");
  assert.equal(oshaStateLicenseLabel("OH", "123"), "");
  const california = toPublicOshaRecord(source({ state: "CA", licenseKey: "100" }), { [OSHA_PROFILE_STATES_FLAG]: "CA" });
  assert.ok(california);
  const html = renderToStaticMarkup(React.createElement(OshaSafetyRecord, {
    records: [california],
    correctionHref: "/corrections",
  }));
  assert.match(html, /California license 100/);
  assert.doesNotMatch(html, /New Jersey license 100/);
});

test("null and explicit zero penalties stay distinct", () => {
  assert.equal(formatCurrentCitedPenalty(null), "—");
  assert.equal(formatCurrentCitedPenalty(0), "$0");
});

test("schema 020 is additive and the certified migrations stay FL and NJ", () => {
  const migration = read("schema/migrations/020_con_osha_002_state_expansion.sql");
  const earlier = read("schema/migrations/019_con_osha_001b_inspection_details.sql");
  const rollback = read("schema/rollback/020_con_osha_002_state_expansion.rollback.sql");
  assert.match(migration, /DRAFT ONLY: do not execute/);
  assert.match(migration, /state IN \('FL', 'NJ', 'CA', 'VA', 'LA', 'NV', 'AZ', 'TN'\)/);
  assert.match(earlier, /state IN \('FL', 'NJ'\)/);
  assert.doesNotMatch(earlier, /'CA'/);
  assert.match(rollback, /refuse to shrink OSHA state checks/);
  assert.match(rollback, /expansion_receipt_id IS NOT NULL/);
  assert.doesNotMatch(rollback, /^DELETE FROM contractors/m);
});
