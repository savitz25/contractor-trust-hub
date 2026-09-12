import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeEvidenceInventory } from "../components/home/HomeEvidenceInventory";
import m from "../data/home/contractor-network-metrics-v1.json";
Object.assign(globalThis, { React });
test("Rendered inventory contains every generated label, count and explicit unknown clock", () => {
  const html = renderToStaticMarkup(<HomeEvidenceInventory />);
  for (const row of m.homepageEvidence) {
    assert.ok(html.includes(row.count.toLocaleString("en-US")), row.id);
  }
  assert.ok(html.includes("Official date unknown"));
  assert.ok(html.includes("337,613"));
  assert.ok(html.includes("829,724"));
});
