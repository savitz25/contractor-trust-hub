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
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

for (const [code, path] of Object.entries({ fl: "/florida", nj: "/new-jersey", ca: "/california", tx: "/texas", wa: "/washington", az: "/arizona" })) {
  assert(build.includes(`${code}: "${path}"`), `${code} state intelligence destination`);
}
assert(!shell.includes("Florida has state intelligence. Other live states"), "no Florida-only worldview");
assert(hero.includes("Research the contractor") && hero.includes("Explore state intelligence"), "hero CTA hierarchy");
assert(shell.includes("HomeDiscoverySearch") && shell.includes("HomeSearchBlock") && shell.includes("AskContractorTrustHub"), "research surfaces retained");
assert(shell.includes("Different evidence grains, kept separate"), "metric grain framing");
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

if (failures.length) { console.error("CON-HOME-003 FAIL"); failures.forEach((f) => console.error(` - ${f}`)); process.exit(1); }
console.log("CON-HOME-003 PASS homepage intelligence showcase");
