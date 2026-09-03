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
const v1 = JSON.parse(read("data/home/contractor-network-metrics-v1.json"));
const config = read("lib/states/config.ts");
const page = read("app/page.tsx");
const shell = read("components/home-intel/ContractorHomeIntelligence.tsx");
const hero = read("components/home/HomeIntelHero.tsx");
const enforce = read("components/home/HomeEnforcement.tsx");
const method = read("components/home/HomeMethodology.tsx");
const load = read("lib/home/load-intel-v2.ts");

assert(v1.schemaVersion === "contractor-network-metrics-v1", "v1 schema");
assert(typeof v1.sourceFingerprint === "string" && v1.sourceFingerprint.length === 64, "v1 fingerprint");
assert(snap.schemaVersion === "contractor-hub-intel-v2", "schema version");
assert(snap.sourceFingerprint === v1.sourceFingerprint, "intel-v2 fingerprint tracks v1");
assert(load.includes("projectIntelV2FromNetworkMetrics"), "homepage intel projected from v1");
assert(hero.includes("newestDocumentedSourceAsOf"), "hero uses documented source clock");
assert(!hero.includes("Last official update"), "no ambiguous last official update");

const byKey = Object.fromEntries(v1.metrics.map((m) => [m.key, m]));
const live = snap.publicCoverage;
assert(live.liveStates === 10, "10 live states");
assert(live.credentialRecords === byKey.live_credential_records.value, "live credentials match v1");
assert(live.activeCurrentCredentialRecords === byKey.live_active_current_credential_records.value, "live active/current match v1");
assert(live.activeCurrentCredentialRecords <= live.credentialRecords, "active subset of credentials");
assert(live.liveSourceSystems.includes("fl_dbpr") && live.liveSourceSystems.includes("tx_tsbpe"), "live sources");
assert(byKey.nj_construction_source_records.value !== live.credentialRecords, "NJ construction != credentials");
assert(v1.californiaReconciliation.joinLiveCredentialCohort === false, "CA truncated not joined");
assert(v1.californiaReconciliation.productionCslbCredentialRows !== v1.californiaReconciliation.acquiredTruncatedLicenseMasterRows, "CA production != truncated extract");

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
assert(graph.populatedLicenseSourceSystems === 18, "populated source systems");
assert(graph.populatedLicenseSourceSystemKeys.length === 18, "18 keys");
assert(live.liveSourceSystems.length === 11, "live 11 sources");
assert(graph.populatedLicenseSourceSystems !== live.liveSourceSystems.length, "no cohort mix");
assert(graph.licenseRows !== live.credentialRecords, "graph licenses != live credentials");
assert(graph.contractorIdentityRows !== live.credentialRecords, "public vs graph split");
assert(graph.entityLinks === 281255, "entity links");
assert(graph.publicContactObservations === 16009, "contacts");
assert(snap.permits.sourceRecords === 139586, "permits");
assert(!method.includes("13 enumerated"), "no 13-system license-row association");
assert(method.includes("populatedLicenseSourceSystems"), "methodology uses populated count");
assert(method.includes("broader research graph"), "broader graph wording");
assert(live.liveStates === 10 && live.liveSourceSystems.length === 11, "live 10/11");
assert(/are not a U\.S\.\s+contractor census/.test(snap.researchGraph.note), "census disclaimer");

const liveStatus = snap.licensingStatus.liveCohort;
assert(liveStatus.active + liveStatus.current === live.activeCurrentCredentialRecords, "status sum");

for (const fam of snap.tradeFamilies.families) {
  assert(fam.activeCurrentRows <= fam.credentialRows, `trade subset ${fam.id}`);
  assert(Array.isArray(fam.occupationCodes) && fam.occupationCodes.length > 0, `trade codes ${fam.id}`);
}

const build = read("lib/home-intel/build.ts");
const askUi = read("components/ask/AskContractorTrustHub.tsx") + read("components/ask/AskResults.tsx");
const compareUi = read("components/intel/MarketCompare.tsx");
const interpret = read("lib/ask/interpret.ts");

assert(page.includes("ContractorHomeIntelligence") && page.includes("getContractorHomeIntel"), "003C shell");
assert(shell.includes("HomeIntelHero") && shell.includes("loadContractorHubIntel"), "hero wired");
assert(shell.includes("AskContractorTrustHub"), "ask on homepage");
assert(shell.includes("MarketCompare"), "compare on homepage");
assert(shell.includes("HomeSearchBlock"), "verify search on homepage");
assert(shell.includes("id=\"verify\"") || shell.includes('id="verify"'), "verify anchor");
assert(shell.includes('id="states"'), "states coverage anchor");
assert(!hero.includes("SearchForm"), "search is not the hero identity");
assert(/Research contractor licensing/i.test(hero), "intelligence-first hero");
assert(!hero.includes("payload") && !hero.includes("SHA") && !hero.includes("fingerprint"), "no SHA in hero");
assert(!/1\.39\s*million|every licensed contractor in America|69,674 bad/i.test(hero + enforce + method), "forbidden copy");
assert(/bad contractors/i.test(enforce), "enforcement wording");
assert(build.includes("MARKET_FINDING"), "market findings");
assert((build.match(/storyType: "MARKET_FINDING"/g) || []).length === 2, "exactly 2 market findings");
assert((build.match(/storyType: "GAP"/g) || []).length === 1, "exactly 1 gap finding");
assert(!/title: "[^"]*worse/i.test(build), "no florida-worse finding title");
assert(askUi.includes("We interpreted your question as"), "interpretation UI");
assert(interpret.includes("fail_closed"), "ask fail-closed");
assert(interpret.includes("COMPLAINT_PHRASES"), "complaint fail-closed");
assert(compareUi.includes("Permit volume is not compared"), "no permit compare");
assert(compareUi.includes("/florida/broward") && compareUi.includes("/florida/palm-beach"), "compare counties");
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
