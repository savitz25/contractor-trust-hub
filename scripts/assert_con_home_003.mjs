import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");
const shell = read("components/home-intel/ContractorHomeIntelligence.tsx");
const hero = read("components/home/HomeIntelHero.tsx");
const layers = read("components/home/HomeEvidenceLayers.tsx");
const build = read("lib/home-intel/build.ts");
const page = read("app/page.tsx");
const wa = JSON.parse(read("lib/washington-intelligence/accepted-snapshot.json"));
const az = JSON.parse(read("lib/arizona-intelligence/accepted-snapshot.json"));
const metrics = JSON.parse(read("data/home/contractor-network-metrics-v1.json"));
const inventory = read("lib/home-intel/evidence-inventory.ts");
const inventoryUi = read("components/home/HomeEvidenceInventory.tsx");
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

for (const [code, path] of Object.entries({ fl: "/florida", nj: "/new-jersey", ca: "/california", tx: "/texas", wa: "/washington", az: "/arizona" })) {
  assert(build.includes(`${code}: "${path}"`), `${code} state intelligence destination`);
}
assert(!shell.includes("Florida has state intelligence. Other live states"), "no Florida-only worldview");
assert(hero.includes("Research the contractor") && hero.includes("Explore state intelligence"), "hero CTA hierarchy");
assert(shell.includes("HomeDiscoverySearch") && shell.includes("HomeSearchBlock") && shell.includes("AskContractorTrustHub"), "research surfaces retained");
assert(inventoryUi.includes("The scale is real. The grains stay separate."), "metric grain framing");
assert(metrics.metrics.some((m) => m.key === "live_credential_records" && m.grain === "license_credential_record"), "accepted metric grain");
assert(wa.graph.ids_with_both === 70622 && wa.graph.join_key.includes("exact"), "WA exact identity graph");
assert(shell.includes("Missing bond or insurance evidence is not proof"), "WA missing semantics");
assert(az.current_posting.all_current === 57886 && az.current_posting.files_are_not_additive, "AZ final accepted ROC clock and overlap");
assert(shell.includes("License row ≠ unique company") && shell.includes("Qualifying party ≠ owner"), "AZ identity semantics");
assert(shell.includes("no statewide general-contractor license class"), "Texas structure semantics");
assert(hero.includes("Network rollup generated") && shell.includes("Source as of"), "source and generation clocks separated");
assert(!/AggregateRating|Trust Score schema/i.test(page + shell), "no rating schema");
assert(!/\bTRUSTED\b|\bVETTED\b|\bAPPROVED\b|\bSAFE\b|BEST CONTRACTOR|TOP CONTRACTOR/i.test(hero + layers), "no prohibited claims");
assert(page.includes('"@type": "WebPage"') && !page.includes("AggregateRating"), "WebPage JSON-LD only");
assert(shell.includes("HomeEvidenceInventory"), "deterministic evidence inventory is on homepage");
assert(inventory.includes('id: "nj-construction"') && inventory.includes("nj.hero.universe_value"), "NJ construction-source evidence represented from accepted artifact");
assert(inventory.includes('id: "wa-bond-rows"') && inventory.includes('id: "wa-insurance-rows"') && inventory.includes('id: "wa-both-identities"'), "Washington bond/insurance evidence represented");
assert(inventory.includes('id: "austin-permits"') && inventory.includes("txLocal.austin.rows"), "Texas Austin permit evidence represented");
assert(inventory.includes('id: "sf-permits"') && inventory.includes('id: "la-current-permits"'), "California local work-history evidence represented");
assert(inventory.includes("network.evidenceFamilies.filter") && inventory.includes('geography: "Florida"'), "Florida enforcement families represented");
assert(inventory.includes('id: "az-current"') && inventory.includes("az.current_posting.all_current"), "Arizona ROC intelligence represented");
assert(!/grandTotal|evidenceTotal|totalEvidenceRows/.test(inventory), "inventory defines no collapsed evidence total");
assert(inventoryUi.includes("Why there is no grand total") && inventoryUi.includes("homepageEvidenceByFamily"), "UI explains incompatible grains and consumes inventory projection");
assert(shell.includes("Intersection—not a next stage") && !shell.includes("cth-intel-funnel"), "WA bond and insurance are parallel sets, not sequential funnel stages");

if (failures.length) { console.error("CON-HOME-003 FAIL"); failures.forEach((f) => console.error(` - ${f}`)); process.exit(1); }
console.log("CON-HOME-003 PASS homepage intelligence showcase");
