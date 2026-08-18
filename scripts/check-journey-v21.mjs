/**
 * Contractor V2.1 journey eligibility. Run: node scripts/check-journey-v21.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "lib/network/journey-handoff.ts"), "utf8");
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const report = readFileSync(join(root, "app/contractors/[slug]/page.tsx"), "utf8");

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  }
}

assert(src.includes('surface === "trust-report" && !hasNetworkJourney'), "trust report requires context");
assert(src.includes("insurancetrusthub.com"), "insurance destination present");
assert(src.includes("movetrusthub.com"), "move destination present");
assert(!src.includes("lendertrusthub.com"), "no lender promotional destination");
assert(!src.includes("p.set('name'"), "does not forward name");
assert(!src.includes("p.set('email'"), "does not forward email");
assert(layout.includes("data-network-standard"), "version marker on body");
assert(report.includes("JourneyNextStep"), "trust report mounts next-step after evidence");
assert(report.includes("trust-report"), "trust report uses trust-report surface");
const analytics = readFileSync(join(root, "lib/network/journey-analytics.ts"), "utf8");
const nextStep = readFileSync(join(root, "components/network/JourneyNextStep.tsx"), "utf8");
assert(analytics.includes("journey_handoff_click"), "contractor uses journey_handoff_click");
assert(analytics.includes("FORBIDDEN"), "contractor forbids PII keys");
assert(nextStep.includes("trackJourneyHandoff"), "JourneyNextStep fires analytics");
assert(nextStep.includes("onClick"), "click handler present");
assert(!analytics.includes("contractorName"), "no contractor name in analytics");

if (failed) {
  console.error(`${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("Contractor V2.1 journey checks passed");
