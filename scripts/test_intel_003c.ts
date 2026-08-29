import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { buildContractorHomeIntel } from "../lib/home-intel/build";
import { intelligenceFingerprint } from "../lib/intelligence/fingerprint";
import { floridaRoofingAskSentence, INTELLIGENCE_TRADE_BUCKETS } from "../lib/intelligence/occupations";
import { buildAskItems } from "../lib/intelligence/os-layer";

test("C003C payload fingerprint is deterministic and ignores generatedAt", () => {
  const a = buildContractorHomeIntel("2026-08-28T00:00:00.000Z");
  const b = buildContractorHomeIntel("2099-01-01T00:00:00.000Z");
  assert.equal(a.payloadFingerprint, b.payloadFingerprint);
  assert.equal(a.payloadFingerprint, intelligenceFingerprint(a));
  assert.equal(a.payloadFingerprint.length, 64);
  assert.equal(a.contractVersion, "contractor-home-intel-v1");
});

test("C003C exactly 3 source-backed findings and no fake census", () => {
  const intel = buildContractorHomeIntel();
  assert.equal(intel.findings.length, 3);
  assert.equal(intel.findings.map((f) => f.storyType).join(","), "MARKET_FINDING,MARKET_FINDING,GAP");
  assert.ok(intel.findings.filter((f) => f.storyType === "MARKET_FINDING").length >= 2);
  assert.ok(intel.findings.filter((f) => f.storyType === "GAP").length <= 1);
  assert.match(intel.findings[0]?.summary ?? "", /not that Florida contractors are worse/);
  assert.doesNotMatch(intel.findings.map((f) => f.title).join(" "), /florida contractors are worse/i);
  assert.equal(intel.stateOfRecord[0]?.value, 10);
  assert.equal(intel.geography.length, 10);
  const blob = JSON.stringify(intel);
  assert.equal(/national contractor total|national licensed-contractor/i.test(blob), true);
  assert.doesNotMatch(intel.findings.map((f) => f.title).join(" "), /best|safer|top contractor/i);
  assert.equal(intel.score, null);
  assert.equal(intel.ranking, null);
  assert.equal(intel.changeCapability.status, "UNSUPPORTED");
});

test("C003C specialty-only states have no statewide GC class", () => {
  const intel = buildContractorHomeIntel();
  const specialty = intel.geography.filter((s) => !s.statewideGc);
  assert.deepEqual(
    specialty.map((s) => s.code).sort(),
    ["KY", "NJ", "TX"]
  );
  assert.equal(intel.geography.find((s) => s.code === "FL")?.href, "/florida");
  assert.ok(intel.geography.filter((s) => s.code !== "FL").every((s) => s.href.startsWith("/verify")));
});

test("C003C Ask uses the same live-state grain and roofing helper", () => {
  const intel = buildContractorHomeIntel();
  assert.ok(intel.ask.length >= 4 && intel.ask.length <= 7);
  const why = intel.ask.find((q) => q.id === "why-differ")?.answer ?? "";
  assert.match(why, /10 live states/);
  assert.match(why, /TX/);
  assert.deepEqual(INTELLIGENCE_TRADE_BUCKETS.roofing, ["CCC", "RC"]);
  const roofAsk = floridaRoofingAskSentence(12);
  assert.match(roofAsk, /certified CCC plus registered RC/);
  assert.doesNotMatch(roofAsk, /registered RR/);
  const flAsk = buildAskItems({
    metrics: [],
    categories: [
      {
        id: "roofers",
        slug: "roofers",
        label: "Roofing",
        href: "/florida/roofers",
        tracked: 20,
        active: 12,
        occupationCodes: ["CCC", "RC"],
        splits: [],
        disclosure: "",
      },
    ],
  });
  assert.match(flAsk[0]?.answer ?? "", /certified CCC plus registered RC/);
  assert.doesNotMatch(flAsk[0]?.answer ?? "", /registered RR/);
});

test("C003C homepage wires SSR Intelligence OS and no loading shell", () => {
  const page = readFileSync(join(process.cwd(), "app/page.tsx"), "utf8");
  assert.match(page, /getContractorHomeIntel/);
  assert.match(page, /ContractorHomeIntelligence/);
  assert.doesNotMatch(page, /Loading contractor intelligence/);
  assert.doesNotMatch(page, /aggregateRating|ratingValue/);
  const os = readFileSync(join(process.cwd(), "lib/intelligence/os-layer.ts"), "utf8");
  assert.doesNotMatch(os, /certified CCC plus registered RR/);
});
