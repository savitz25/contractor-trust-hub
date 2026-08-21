/**
 * SHARE-003 metadata contract — Contractor Trust Hub.
 * Run: node scripts/assert-share-003.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");
const failures = [];
const assert = (cond, msg) => {
  if (!cond) failures.push(msg);
};

const routes = [
  "app/contractors/[slug]/share-og/route.tsx",
  "app/florida/share-og/route.tsx",
  "app/florida/[segment]/share-og/route.tsx",
  "app/florida/[segment]/[facet]/share-og/route.tsx",
  "app/arizona/share-og/route.tsx",
  "app/washington/share-og/route.tsx",
  "app/oregon/share-og/route.tsx",
  "app/guides/[slug]/share-og/route.tsx",
];
for (const rel of routes) {
  assert(existsSync(join(root, rel)), `${rel} exists`);
}

const entityRoute = read("app/contractors/[slug]/share-og/route.tsx");
const model = read("lib/seo/share-card-model.ts");
const card = read("lib/og/contractor-share-card.tsx");
const helper = read("lib/og/contractor-share-og.ts");
const trustReport = read("lib/seo/trust-report-seo.ts");
const discoveryMeta = read("lib/discovery/metadata.ts");
const shareHub = read("lib/seo/share-hub.ts");
const queries = read("lib/contractors/queries.ts");

assert(entityRoute.includes("contractorFallbackPng"), "missing contractor falls back to SHARE-002 PNG");
assert(entityRoute.includes("displayName"), "entity card uses public display name");
assert(entityRoute.includes("occupationLabel"), "trade label from public occupation mapping");
assert(!entityRoute.includes("matchConfidence"), "no match confidence on OG route");
assert(!entityRoute.includes("discipline"), "no discipline payload on OG route");
assert(!/google|places\.googleapis|GooglePlaces/i.test(entityRoute), "no Google Places on OG route");
assert(!/google|places\.googleapis|GooglePlaces/i.test(helper), "no Google Places in share helper");
assert(!entityRoute.includes("phone"), "no phone on OG route");
assert(!entityRoute.includes("email"), "no email on OG route");

assert(trustReport.includes("/share-og") || trustReport.includes("shareRouteOgImage"), "Trust Report OG points at share-og");
assert(trustReport.includes("pageMetadata"), "Trust Report still uses pageMetadata");
assert(discoveryMeta.includes("shareRouteOgImage"), "discovery pages get contextual share-og");

assert(shareHub.includes("shareRouteOgImage"), "shareRouteOgImage helper");
assert(shareHub.includes("www.contractortrusthub.com"), "canonical host pinned");
assert(!shareHub.includes("http://localhost"), "origin is not localhost");
assert(shareHub.includes('host === "localhost"'), "forbids localhost hosts");
for (const foreign of [
  "asktrusthub.com",
  "movetrusthub.com",
  "lendertrusthub.com",
  "seniortrusthub.com",
  "investortrusthub.com",
  "insurancetrusthub.com",
]) {
  assert(
    !shareHub.includes(`origin: "https://www.${foreign}"`),
    `SHARE_HUB origin is not ${foreign}`,
  );
}

assert(card.includes("1200") && card.includes("630"), "contextual card is 1200×630");
assert(card.includes("contractortrusthub.com"), "card shows contractor domain");
assert(!card.includes("lendertrusthub.com"), "card does not show lender domain");
assert(card.includes("ASK TRUST HUB NETWORK"), "network label allowed");
assert(model.includes("truncateShareText"), "long names are truncated");
assert(!/no complaints|fully verified|trusted|approved|safe contractor/i.test(model), "no endorsement copy");
assert(model.includes("Licensing · company research"), "neutral research label");
assert(helper.includes("contractor-trust-hub-og.png"), "fallback is SHARE-002 PNG");
assert(!queries.includes("places.googleapis"), "contractor queries do not add Places");

const guide = read("app/guides/how-to-verify-florida-contractor/page.tsx");
assert(guide.includes("shareRouteOgImage"), "flagship guide uses contextual OG");
assert(guide.includes("guide.path"), "guide canonical path unchanged");
assert(model.includes("ABC Roofing") === false, "model file has no fixture leakage");
assert(model.includes("maxChars"), "truncation helper is parameterized");
assert(entityRoute.includes("contractorFallbackPng()"), "invalid slug returns PNG, not 500");

if (failures.length) {
  console.error("SHARE-003 Contractor assertions failed:");
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}
console.log("SHARE-003 Contractor assertions passed.");
