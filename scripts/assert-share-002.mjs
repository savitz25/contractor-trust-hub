/**
 * SHARE-002 metadata contract — Contractor Trust Hub.
 * Run: node scripts/assert-share-002.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");
const readBin = (rel) => readFileSync(join(root, rel));

const failures = [];
function assert(cond, msg) {
  if (!cond) failures.push(msg);
}

function pngSize(rel) {
  const buf = readBin(rel);
  if (buf.subarray(0, 8).toString("binary") !== "\x89PNG\r\n\x1a\n") {
    throw new Error(`${rel} is not a PNG`);
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const shareHub = read("lib/seo/share-hub.ts");
const layout = read("app/layout.tsx");
const pageMeta = read("lib/seo/page-meta.ts");
const florida = read("app/florida/page.tsx");
const trustReport = read("lib/seo/trust-report-seo.ts");

assert(shareHub.includes('id: "contractor"'), "SHARE_HUB.id is contractor");
assert(shareHub.includes('host: "www.contractortrusthub.com"'), "SHARE_HUB.host");
assert(shareHub.includes('ogImagePath: "/opengraph-image"'), "dynamic canonical OG path");
assert(shareHub.includes("ogWidth: 1200") && shareHub.includes("ogHeight: 630"), "1200×630");
assert(shareHub.includes('twitterCard: "summary_large_image"'), "twitter large");

assert(layout.includes("shareOgImageAbsoluteUrl"), "layout uses absolute OG PNG");
assert(layout.includes("SHARE_HUB.twitterCard"), "layout twitter from SHARE_HUB");
assert(!layout.includes("contractor-trust-hub-logo.svg"), "layout OG is not SVG");
assert(!layout.includes('card: "summary"'), "layout is not summary card");
assert(!layout.includes("localhost"), "no localhost in layout");
assert(!layout.includes(".vercel.app"), "no vercel.app in layout");

assert(pageMeta.includes("shareOgImageAbsoluteUrl"), "page-meta default OG is PNG");
assert(!pageMeta.includes("contractor-trust-hub-logo.svg"), "page-meta is not SVG");
assert(pageMeta.includes("SHARE_HUB.twitterCard"), "page-meta twitter large");
assert(!pageMeta.includes('card: "summary"'), "page-meta is not summary");

assert(florida.includes("discoveryMetadata"), "Florida local page uses discovery metadata");
assert(trustReport.includes("pageMetadata"), "contractor Trust Report uses pageMetadata fallback card");

const card = pngSize("public/brand/contractor-trust-hub-og.png");
assert(
  card.width === 1200 && card.height === 630,
  `OG PNG is 1200×630, got ${card.width}×${card.height}`,
);

if (failures.length) {
  console.error("SHARE-002 Contractor assertions failed:");
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}
console.log("SHARE-002 Contractor assertions passed (PNG 1200×630, summary_large_image, SVG social fallback gone).");
