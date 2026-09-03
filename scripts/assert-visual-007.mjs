/**
 * VISUAL-007 Contractor network shell — source contract.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");
const failures = [];
const assert = (cond, msg) => {
  if (!cond) failures.push(msg);
};

const tokens = read("lib/design/trusthub-visual-standard.ts");
const mark = read("public/brand/contractor-trust-hub-mark.svg");
const compact = read("public/brand/contractor-trust-hub-logo-compact.svg");
const css = read("app/globals.css");
const header = read("components/layout/SiteHeader.tsx");
const logo = read("components/BrandLogo.tsx");
const switcher = read("components/network/SwitchHubMenu.tsx");
const registry = read("lib/network/registry.ts");
const layout = read("app/layout.tsx");
const shareCard = read("lib/og/contractor-share-card.tsx");
const site = read("lib/site.ts");

assert(tokens.includes("2026.08.21-visual-v1"), "chassis version");
assert(tokens.includes('contractor: "#F5C518"'), "Contractor gold accent");
assert(mark.includes('viewBox="0 0 36 36"'), "mark viewBox 0 0 36 36");
assert(mark.includes('stroke-width="2.4"'), "canonical stroke 2.4");
assert(mark.includes('r="2.5"'), "canonical outer dots");
assert(mark.includes('r="2.1"'), "canonical center");
assert(mark.includes("#F5C518"), "Contractor gold brackets");
assert(!mark.includes("M78 28"), "no legacy heavy path");
assert(compact.includes('stroke-width="2.4"'), "compact canonical stroke");
assert(!compact.includes("BEFORE YOU HIRE"), "compact omits slogan");
assert(css.includes("--th-header-desktop: 69px"), "69px desktop header");
assert(css.includes("--th-header-tablet: 65px"), "65px tablet");
assert(css.includes("--th-header-mobile: 57px"), "57px mobile");
assert(css.includes("--th-logo-desktop: 36px"), "36px logo");
assert(css.includes("--th-control: 44px"), "44px controls");
assert(css.includes("--th-shell-max: 1200px"), "1200 shell");
assert(!css.includes("th-header") || !/^\s*\.th-header[\s\S]{0,400}backdrop-filter/m.test(css), "no backdrop-filter on th-header");
assert(!header.includes("AskNetworkBar"), "AskNetworkBar removed from header");
assert(!header.includes("backdrop-blur"), "no backdrop-blur on header");
assert(header.includes("th-header"), "reference header class");
assert(header.includes('variant="embedded"'), "Switch Hub in drawer");
assert(!header.includes("compact={"), "no compact Switch Hub in product header");
assert(!header.includes("Ask Trust Hub network"), "no stacked network label");
assert(logo.includes("logo-compact"), "BrandLogo still uses approved compact lockup");
assert(switcher.includes("switcherEntries()"), "registry order");
assert(switcher.includes("ASK TRUST HUB NETWORK"), "network panel title");
assert(switcher.includes("aria-current"), "aria-current");
assert(registry.includes('CURRENT_NETWORK_HUB_ID: NetworkHubId = "contractor"'), "current hub is contractor");
assert(layout.includes("data-th-chassis"), "chassis stamp");
assert(layout.includes('id="main-content"'), "skip target");
assert(layout.includes("Inter"), "Inter chrome font");
assert(site.includes("https://www.contractortrusthub.com"), "canonical host");
assert(shareCard.includes("borderRadius") && shareCard.includes("ASK TRUST HUB NETWORK"), "SHARE-004B canonical network card");

const order = ['id: "ask"', 'id: "move"', 'id: "lender"', 'id: "insurance"', 'id: "contractor"', 'id: "senior"', 'id: "investor"'];
let last = -1;
for (const id of order) {
  const i = registry.indexOf(id);
  assert(i > last, `registry order ${id}`);
  last = i;
}

if (failures.length) {
  console.error("VISUAL-007 assertions failed:");
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}
console.log("VISUAL-007 Contractor network-shell assertions passed.");
