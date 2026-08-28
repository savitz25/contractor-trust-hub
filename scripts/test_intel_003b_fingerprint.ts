import assert from "node:assert/strict";
import { test } from "node:test";
import { intelligenceFingerprint } from "../lib/intelligence/fingerprint.ts";
import { buildCompareRows } from "../lib/intelligence/os-layer.ts";

test("generatedAt does not change canonical fingerprint", () => {
  const a = { version: "contractor-state-intel-v1", generatedAt: "2026-08-28T00:00:00.000Z", metrics: [{ id: "x", value: 1 }] };
  const b = { version: "contractor-state-intel-v1", generatedAt: "2026-08-28T12:00:00.000Z", metrics: [{ id: "x", value: 1 }] };
  assert.equal(intelligenceFingerprint(a), intelligenceFingerprint(b));
  assert.equal(intelligenceFingerprint(a).length, 64);
});

test("timedOut and fingerprint fields are excluded", () => {
  const a = { n: 1, timedOut: true, canonicalFingerprint: "aaa", generatedAt: "t1" };
  const b = { n: 1, timedOut: false, canonicalFingerprint: "bbb", generatedAt: "t2" };
  assert.equal(intelligenceFingerprint(a), intelligenceFingerprint(b));
});

test("compare rows fill roofing and general shares from same universe", () => {
  const rows = buildCompareRows({
    floridaTracked: 143516,
    floridaActive: 104444,
    floridaRoofing: 11794,
    floridaGeneral: 39346,
    counties: [
      {
        id: "broward",
        label: "Broward County",
        href: "/florida/broward",
        tracked: 11568,
        active: 8414,
        roofing: 900,
        general: 3000,
        researchDepth: "statewide",
      },
    ],
  });
  for (const r of rows) {
    assert.notEqual(r.tracked, null);
    assert.notEqual(r.activeShare, null);
    assert.notEqual(r.roofingShare, null);
    assert.notEqual(r.generalShare, null);
  }
});
