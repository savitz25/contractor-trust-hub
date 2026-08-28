/**
 * CON-HOME-INTEL-004 homepage intelligence + denominator tests.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");
const failures = [];
const assert = (c, m) => {
  if (!c) failures.push(m);
};

const snap = JSON.parse(read("data/home/contractor-hub-intel-v2.json"));
const config = read("lib/states/config.ts");
const page = read("app/page.tsx");
const shell = read("components/home-intel/ContractorHomeIntelligence.tsx");
const hero = read("components/home/HomeIntelHero.tsx");
const enforce = read("components/home/HomeEnforcement.tsx");
const method = read("components/home/HomeMethodology.tsx");

assert(snap.schemaVersion === "contractor-hub-intel-v2", "schema version");
assert(typeof snap.sourceFingerprint === "string" && snap.sourceFingerprint.length === 64, "fingerprint");

const live = snap.publicCoverage;
assert(live.liveStates === 10, "10 live states");
assert(live.credentialRecords === 644421, "live credentials");
assert(live.activeCurrentCredentialRecords === 499997, "live active/current");
assert(live.activeCurrentCredentialRecords <= live.credentialRecords, "active subset of credentials");
assert(live.liveSourceSystems.includes("fl_dbpr") && live.liveSourceSystems.includes("tx_tsbpe"), "live sources");

const order = [...config.match(/LIVE_STATE_ORDER = \[([^\]]+)\]/)[1].matchAll(/"([a-z]+)"/g)].map((m) => m[1]);
assert(order.length >= 10, "LIVE_STATE_ORDER");
assert(live.liveStateCodes.join(",") === "FL,TX,NJ,OR,WA,CA,AZ,LA,MS,KY", "state codes from config order");

const ev = snap.regulatoryEvidence;
const famSum = ev.byEvidenceFamily.reduce((s, f) => s + f.rows, 0);
assert(ev.totalActionRows === 69674, "discipline actions");
assert(famSum === ev.totalActionRows, "family sum equals actions");
assert(ev.canonicalObservations === 68081, "observations grain");
assert(ev.occurrences === 68087, "occurrences grain");
assert(ev.totalActionRows !== ev.canonicalObservations + ev.occurrences, "no cross-grain sum");
assert(ev.byEvidenceFamily.find((f) => f.key === "fl_dfs_stop_work")?.rows === 48254, "stop-work family");
assert(ev.byEvidenceFamily.find((f) => f.key === "fl_dbpr_unlicensed")?.rows === 11691, "ula family");

const graph = snap.researchGraph;
assert(graph.contractorIdentityRows === 1392730, "contractor rows");
assert(graph.licenseRows === 1266214, "license rows");
assert(graph.contractorIdentityRows !== live.credentialRecords, "public vs graph split");
assert(graph.entityLinks === 281255, "entity links");
assert(graph.publicContactObservations === 16009, "contacts");
assert(snap.permits.sourceRecords === 139586, "permits");

const liveStatus = snap.licensingStatus.liveCohort;
assert(liveStatus.active + liveStatus.current === live.activeCurrentCredentialRecords, "status sum");

for (const fam of snap.tradeFamilies.families) {
  assert(fam.activeCurrentRows <= fam.credentialRows, `trade subset ${fam.id}`);
  assert(Array.isArray(fam.occupationCodes) && fam.occupationCodes.length > 0, `trade codes ${fam.id}`);
}

assert(page.includes("ContractorHomeIntelligence") && page.includes("getContractorHomeIntel"), "003C shell");
assert(shell.includes("HomeIntelHero") && shell.includes("loadContractorHubIntel"), "hero wired");
assert(hero.includes("SearchForm"), "search in hero");
assert(hero.includes("id=\"search\"") || hero.includes('id="search"'), "search anchor");
assert(!hero.includes("payload") && !hero.includes("SHA") && !hero.includes("fingerprint"), "no SHA in hero");
assert(!/1\.39\s*million|every licensed contractor in America|69,674 bad/i.test(hero + enforce + method), "forbidden copy");
assert(/bad contractors/i.test(enforce), "enforcement wording");
assert(
  shell.includes("/florida") || read("components/home/HomeBeyondLicense.tsx").includes("/florida"),
  "florida link",
);
assert(snap.tradeFamilies.canonicalNormalizationExisted === false, "trade blocker documented");

if (failures.length) {
  console.error("CON-HOME-INTEL-004 FAIL");
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}
console.log("CON-HOME-INTEL-004 PASS homepage intel denominators");
