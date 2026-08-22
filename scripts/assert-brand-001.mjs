/**
 * CONTRACTOR-BRAND-001 — prevent reintroduction of heavy filled brackets.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const brand = join(root, "public/brand");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exitCode = 1;
  } else {
    console.log("PASS:", msg);
  }
}

const mark = readFileSync(join(brand, "contractor-trust-hub-mark.svg"), "utf8");
const logo = readFileSync(join(brand, "contractor-trust-hub-logo.svg"), "utf8");
const compact = readFileSync(join(brand, "contractor-trust-hub-logo-compact.svg"), "utf8");
const dark = readFileSync(join(brand, "contractor-trust-hub-logo-on-dark.svg"), "utf8");
const brandLogo = readFileSync(join(root, "components/BrandLogo.tsx"), "utf8");
const processScript = readFileSync(join(root, "scripts/process_logo_mockup.py"), "utf8");
const exportScript = readFileSync(join(root, "scripts/export_brand_pngs.py"), "utf8");

assert(mark.includes('viewBox="0 0 36 36"'), "mark viewBox 0 0 36 36");
assert(mark.includes('stroke-width="2.4"'), "mark canonical stroke 2.4");
assert(mark.includes('r="2.5"'), "mark outer dots r=2.5");
assert(mark.includes('r="2.1"'), "mark center r=2.1");
assert(mark.includes("#F5C518"), "mark Contractor gold");
assert(mark.includes("#F28C28") && mark.includes("#2F80ED") && mark.includes("#2BBBAD") && mark.includes("#8B5CF6"), "mark node palette");
assert(!mark.includes("M78 28"), "mark has no legacy heavy path");
assert(!/fill="#F5C518"[\s\S]*M78 28/.test(mark), "mark brackets are stroke not heavy fill");

assert(logo.includes("BEFORE YOU HIRE, VERIFY."), "full logo locked slogan");
assert(logo.includes('stroke-width="2.4"'), "full logo canonical stroke");
assert(!logo.includes("Before you hire"), "slogan not sentence-case variant in SVG");
assert(compact.includes('stroke-width="2.4"'), "compact logo canonical stroke");
assert(!compact.includes("BEFORE YOU HIRE"), "compact omits slogan");
assert(dark.includes("BEFORE YOU HIRE, VERIFY."), "dark full has slogan");
assert(dark.includes("#E8EEF9"), "dark lifts navy text");

assert(brandLogo.includes("logo-compact"), "BrandLogo references compact");
assert(brandLogo.includes('lockup'), "BrandLogo lockup prop");

assert(processScript.includes("retired") || processScript.includes("OBSOLETE"), "process_logo_mockup retired");
assert(processScript.includes("SystemExit(2)") || processScript.includes("raise SystemExit(2)"), "process_logo_mockup exits 2");
assert(exportScript.includes("stroke-width") || exportScript.includes("2.4"), "export script knows canonical stroke");
assert(!exportScript.includes("thickness = size * 0.09"), "export script no longer draws heavy brackets");

for (const f of [
  "contractor-trust-hub-mark.png",
  "favicon-192.png",
  "favicon-512.png",
  "apple-touch-icon.png",
  "contractor-trust-hub-logo.png",
  "contractor-trust-hub-og.png",
]) {
  assert(existsSync(join(brand, f)), `raster exists: ${f}`);
}

const og = readFileSync(join(brand, "contractor-trust-hub-og.png"));
assert(og.length > 1000, "OG PNG non-trivial");
// PNG signature
assert(og[0] === 0x89 && og[1] === 0x50, "OG is PNG");

if (process.exitCode) {
  console.error("assert-brand-001 FAILED");
  process.exit(1);
}
console.log("CONTRACTOR-BRAND-001 assertions passed.");
