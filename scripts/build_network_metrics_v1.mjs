import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
/** Offline accepted-input projection. --check fails on drift without writing. */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { publicationMetricInputs } from "./publication_metric_inputs.mjs";
const {
  computeContractorNetworkMetrics,
} = require("../lib/metrics/compute-contractor-network-metrics.ts");
const {
  acceptedHomepageEvidence,
} = require("../lib/metrics/accepted-homepage-evidence.ts");
const {
  partitionCredentials,
  classifyCredentialStatus,
} = require("../lib/metrics/credential-status.ts");
const { count, fingerprint } = require("../lib/metrics/accepted-contract.ts");
const {
  projectIntelV2FromNetworkMetrics,
} = require("../lib/metrics/project-intel-v2.ts");
import { appendExpansionMetrics } from "./network_expansion_metrics.mjs";
const root = join(dirname(fileURLToPath(import.meta.url)), ".."),
  sources = [];
const read = (path) => {
  const d = JSON.parse(readFileSync(join(root, path), "utf8"));
  sources.push({
    path,
    sha256: fingerprint(d),
    sourceAsOf: d.clocks?.sourceAsOf ?? d.sourceAsOf ?? null,
    retrievedAt:
      d.clocks?.retrievedAt ?? d.source?.retrieved_at ?? d.retrievedAt ?? null,
    snapshotAsOf: d.clocks?.snapshotAsOf ?? d.snapshotAsOf ?? d.as_of ?? null,
  });
  return d;
};
const out = "data/home/contractor-network-metrics-v1.json",
  check = process.argv.includes("--check");
const generatedAt = check
  ? JSON.parse(readFileSync(join(root, out), "utf8")).generatedAt
  : new Date().toISOString();
const census = read("data/metrics/accepted-network-census-v1.json"),
  co = read("lib/colorado-intelligence/accepted-snapshot.json"),
  nj = read("lib/new-jersey-intelligence/accepted-snapshot.json"),
  ca = read("data/raw/ca_cslb_master/manifest.json"),
  pub = publicationMetricInputs();
const sum = (rows) =>
  rows.reduce((n, r) => n + count(r.rows, "accepted rows"), 0);
if (sum(census.licenseGroups) !== census.totals.licenses)
  throw Error("Database census mismatch");
if (census.licenseGroups.some((r) => r.source_system === "co_dora"))
  throw Error(
    "CO database/local ownership collision; explicitly reconcile before publishing",
  );
const groups = census.licenseGroups.map((r) => ({
  source: r.source_system,
  credentialClass: r.occupation_code,
  nativeStatus: r.primary_status,
  normalizedStatus: r.status_normalized,
  rows: r.rows,
}));
for (const prefix of ["EC", "PC"]) {
  const c = co.business_credentials[prefix],
    local = Object.entries(c.status_counts).map(([s, rows]) => ({
      source: "co_dora",
      credentialClass: prefix,
      nativeStatus: s,
      normalizedStatus: s,
      rows,
    }));
  partitionCredentials(local, c.all_rows);
  if (sum(local.filter((r) => r.nativeStatus === "Active")) !== c.active_exact)
    throw Error("CO exact Active mismatch");
  groups.push(...local);
}
const licensesBySource = {};
for (const r of groups)
  licensesBySource[r.source] =
    (licensesBySource[r.source] ?? 0) + count(r.rows, "credential rows"); // initialized accumulator, not missing-source fallback
const liveGroups = groups.filter((r) =>
    pub.liveSourceSystems.includes(r.source),
  ),
  liveStatus = partitionCredentials(liveGroups, sum(liveGroups)),
  graphStatus = partitionCredentials(groups, sum(groups));
const labels = {
  contractor_disc_lic: [
    "fl_dbpr_discipline",
    "Florida DBPR licensed discipline",
  ],
  contractor_disc_rf: ["fl_recovery_fund", "Florida recovery fund"],
  contractor_disc_ula: ["fl_dbpr_unlicensed", "Florida unlicensed activity"],
  fl_dfs_workers_comp_stop_work: [
    "fl_dfs_stop_work",
    "Florida workers compensation stop-work",
  ],
  dca_standard_files_discipline_flag: [
    "nj_enforcement",
    "New Jersey discipline flags",
  ],
  roc_disciplinary_actions: [
    "az_roc_discipline",
    "Arizona ROC disciplinary actions",
  ],
};
const evidenceFamilies = census.evidenceGroups.map((r) => ({
  key: labels[r.source_dataset]?.[0] ?? r.source_dataset,
  label: labels[r.source_dataset]?.[1] ?? r.source_dataset,
  sourceSystem: r.source_system,
  sourceDataset: r.source_dataset,
  rows: count(r.rows, "evidence rows"),
  grain: "discipline_action_row",
}));
if (sum(evidenceFamilies) !== census.totals.discipline_actions)
  throw Error("Evidence census mismatch");
evidenceFamilies.push({
  key: "co_dora_discipline",
  label: "Colorado credential-linked discipline observations",
  sourceSystem: "co_dora",
  sourceDataset: "co_dora_discipline",
  rows: count(co.discipline.contractor_relevant_rows, "CO discipline"),
  grain: "discipline_action_row",
});
const config = read("lib/home/trade-families.json");
const tradeFamilies = {
    ...config,
    families: config.families.map((f) => {
      const members = [...f.members];
      if (["electrical", "plumbing"].includes(f.id))
        members.push({
          sourceSystem: "co_dora",
          occupationCodes: [f.id === "electrical" ? "EC" : "PC"],
          origin: "Accepted CO business EC/PC",
        });
      const rows = liveGroups.filter((r) =>
        members.some(
          (m) =>
            m.sourceSystem === r.source &&
            m.occupationCodes.includes(r.credentialClass),
        ),
      );
      return {
        id: f.id,
        label: f.label,
        href: f.href,
        credentialRows: sum(rows),
        activeCurrentRows: sum(
          rows.filter((r) =>
            ["active", "current"].includes(
              classifyCredentialStatus(r.normalizedStatus),
            ),
          ),
        ),
        contributingSources: [...new Set(members.map((m) => m.sourceSystem))],
        occupationCodes: [
          ...new Set(members.flatMap((m) => m.occupationCodes)),
        ],
        origin: members.map((m) => m.origin),
      };
    }),
  },
  t = census.totals;
const m = computeContractorNetworkMetrics({
  generatedAt,
  ...pub,
  licensesBySource,
  liveActiveCurrentCredentialRecords: liveStatus.active + liveStatus.current,
  researchGraphLicenseRecords: sum(groups),
  researchGraphContractorIdentities: t.contractors,
  contractorEntityLinks: t.contractor_entities,
  publicContactObservations: t.public_contact_observations,
  disciplineActionRows: sum(evidenceFamilies),
  regulatoryObservations: t.regulatory_source_observations,
  regulatoryOccurrences: t.regulatory_source_occurrences,
  indexedPermitSourceRecords: t.permit_source_records,
  evidenceFamilies,
  liveStatus,
  tradeFamilies,
  caProductionCslbRows: count(licensesBySource.ca_cslb, "CA"),
  caAcquiredTruncatedRows: ca.license_rows,
  caAcquiredAsOf: ca.as_of,
  njConstructionSourceRecords: nj.construction.total_source_records,
  njConstructionSourceAsOf: nj.hero.current_value,
  njCurrentMunicipalities: nj.hero.geography_value,
  njMunicipalityAsOf: nj.as_of,
  njPublishedCountyPages: pub.njPublishedCountyPages.length,
  njPublicWorksRegulatoryRows: nj.hero.observations_value,
  floridaCountyIntelligencePages: pub.floridaCountyIntelligencePages.length,
  caCityLocalPages: pub.caCityLocalPages.length,
  nycLocalPages: pub.nycLocalPages.length,
});
m.contractRevision = "ATH-METRICS-R2-02";
m.licensingStatus.graph = graphStatus;
m.statusReconciliation = {
  sourceUniverse: sum(groups),
  includedUniverse: sum(liveGroups),
  explicitExclusions: sum(
    groups.filter((r) => !pub.liveSourceSystems.includes(r.source)),
  ),
  partitionSum: Object.values(liveStatus).reduce((a, b) => a + b, 0),
  unexplainedRemainder: 0,
  exclusionRule:
    "Research sources outside configured Verify cohort. Supplemental state snapshots below are separately scoped, never added again.",
  groups: groups.map((r) => ({
    ...r,
    bucket: classifyCredentialStatus(r.normalizedStatus),
    included: pub.liveSourceSystems.includes(r.source),
  })),
};
m.liveCohort.cohortRule =
  "Accepted database census for configured Verify sources plus non-overlapping accepted local CO EC/PC business credentials. Supplemental VA/NY/IL cohorts remain separate.";
m.acceptedStateDatasets = {};
m.stateCapabilities = [];
const states = {
  florida: "FL",
  "new-jersey": "NJ",
  california: "CA",
  texas: "TX",
  washington: "WA",
  arizona: "AZ",
  colorado: "CO",
  virginia: "VA",
  "new-york": "NY",
  illinois: "IL",
};
for (const [slug, state] of Object.entries(states)) {
  const path =
      slug === "florida"
        ? "data/metrics/accepted-network-census-v1.json"
        : "lib/" + slug + "-intelligence/accepted-snapshot.json",
    snapshot = read(path);
  m.acceptedStateDatasets[state] = { path, snapshot };
  m.stateCapabilities.push({
    state,
    route: "/" + slug,
    status: "STATE_SOURCE_LIVE",
    specialistComplete: false,
    completion: "NOT_ASSERTED",
    capabilities: [
      {
        id: "accepted-specialist-evidence",
        status: "STATE_SOURCE_LIVE",
        metricKeys: [],
        bulkCount: null,
      },
    ],
  });
}
for (const state of pub.liveStateCodes.filter(
  (s) => !m.stateCapabilities.some((c) => c.state === s),
))
  m.stateCapabilities.push({
    state,
    route: null,
    status: "STATE_SOURCE_LIVE",
    specialistComplete: false,
    completion: "NOT_ASSERTED",
    capabilities: [
      {
        id: "verify-credentials",
        status: "STATE_SOURCE_LIVE",
        metricKeys: ["live_credential_records"],
        bulkCount: null,
      },
    ],
  });
for (const name of readdirSync(join(root, "lib"))
  .sort()
  .filter((n) => n.endsWith("-intelligence")))
  for (const suffix of [
    "accepted-snapshot.json",
    "local/accepted-snapshot.json",
  ]) {
    const path = "lib/" + name + "/" + suffix;
    if (existsSync(join(root, path)))
      m.acceptedStateDatasets[path] = { path, snapshot: read(path) };
  }
m.homepageEvidence = acceptedHomepageEvidence(m).map((row) => ({
  ...row,
  generatedAt,
  snapshotAsOf: row.artifact.startsWith("contractor-network")
    ? census.snapshotAsOf
    : null,
  retrievedAt: row.artifact.startsWith("contractor-network")
    ? census.retrievedAt
    : null,
}));
for (const row of m.homepageEvidence.filter(
  (r) => !r.artifact.startsWith("contractor-network"),
)) {
  const entry = Object.values(m.acceptedStateDatasets).find(
    (d) =>
      row.href &&
      d.path ===
        "lib/" + row.href.slice(1) + "-intelligence/accepted-snapshot.json",
  );
  if (entry) {
    const d = entry.snapshot,
      c = d.clocks ?? {};
    row.retrievedAt =
      c.retrievedAt ??
      c.regulant_lists_retrievedAt ??
      d.source?.retrieved_at ??
      null;
    row.snapshotAsOf = c.snapshotAsOf ?? d.as_of ?? null;
    row.artifact = entry.path;
  }
}
appendExpansionMetrics(m, count);
for (const row of m.homepageEvidence) {
  count(row.count, row.id);
  m.metrics.push({
    key: "evidence_" + row.id.replaceAll("-", "_"),
    label: row.label,
    value: row.count,
    unit: "count",
    grain: row.grain,
    denominator: row.counts,
    description: row.doesNotCount,
    coverage: row.geography,
    contributingSourceSystems: [row.artifact],
    sourceAsOf: row.sourceAsOf,
    retrievedAt: row.retrievedAt ?? null,
    snapshotAsOf: row.snapshotAsOf ?? null,
    generatedAt,
    publicationStatus: "PUBLIC",
    trace: {
      counts: row.counts,
      doesNotCount: row.doesNotCount,
      contributingSourceSystems: [row.artifact],
      geographicCoverage: row.geography,
      sourceDates:
        row.sourceAsOf ??
        "Official date unknown; source clocks retained separately.",
      generationDate: generatedAt.slice(0, 10),
    },
  });
}
for (const metric of m.metrics.filter((r) => !r.key.startsWith("evidence_"))) {
  const snapshotMetric =
    metric.key.startsWith("nj_") || metric.key.startsWith("ca_acquired_");
  const routeMetric =
    metric.key.startsWith("published_") ||
    metric.key === "live_researched_states";
  metric.snapshotAsOf = routeMetric
    ? null
    : snapshotMetric
      ? metric.key.startsWith("nj_")
        ? nj.as_of
        : ca.as_of
      : census.snapshotAsOf;
  metric.retrievedAt =
    snapshotMetric || routeMetric ? null : census.retrievedAt;
  if (routeMetric) metric.sourceAsOf = null;
  if (metric.key === "research_graph_license_records") {
    metric.denominator =
      "Accepted database license census plus non-overlapping local Colorado EC/PC credentials";
    metric.trace.counts =
      "Database credential rows plus accepted local CO business credentials; no additional canonical companies are created.";
  }
  if (metric.key === "regulatory_discipline_action_rows") {
    metric.denominator =
      "Accepted database discipline_actions plus non-overlapping local CO credential-linked observations";
    metric.coverage = "FL, NJ, AZ, CO; separate evidence families";
    metric.trace.counts = metric.denominator;
    metric.trace.geographicCoverage = metric.coverage;
  }
}

// Coverage is explicit even where no accepted specialist source exists.
const states50 =
  "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(
    " ",
  );
for (const state of states50.filter(
  (s) => !m.stateCapabilities.some((c) => c.state === s),
)) {
  const acquired = groups.some(
    (g) => g.source?.slice(0, 2).toUpperCase() === state,
  );
  m.stateCapabilities.push({
    state,
    route: null,
    status: acquired ? "STATE_SOURCE_ACQUIRED" : "UNKNOWN",
    specialistComplete: false,
    completion: "NOT_ASSERTED",
    capabilities: [
      {
        id: "state-source",
        status: acquired ? "STATE_SOURCE_ACQUIRED" : "UNKNOWN",
        metricKeys: [],
        bulkCount: null,
      },
    ],
  });
}
m.coverageDefinition =
  "Live Verify credential cohort, acquired state evidence and published state intelligence routes are distinct. No state-wide specialist-completion claim is inferred.";
m.acceptedSources = [...new Map(sources.map((s) => [s.path, s])).values()].sort(
  (a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0),
);
m.sourceFingerprint = fingerprint({
  sources: m.acceptedSources,
  pub,
  groups,
  tradeFamilies,
  evidence: m.homepageEvidence.map(({ generatedAt, ...r }) => r),
});
m.sourceFingerprint = fingerprint({
  inputFingerprint: m.sourceFingerprint,
  generator: [
    "scripts/build_network_metrics_v1.mjs",
    "scripts/network_expansion_metrics.mjs",
    "lib/metrics/credential-status.ts",
    "lib/metrics/accepted-homepage-evidence.ts",
    "lib/metrics/compute-contractor-network-metrics.ts",
  ].map((p) => readFileSync(join(root, p), "utf8").replaceAll("\r\n", "\n")),
});
m.newestDocumentedSourceAsOf =
  m.metrics
    .map((r) => r.sourceAsOf)
    .filter((d) => /^\d{4}-\d{2}-\d{2}/.test(d ?? ""))
    .sort()
    .at(-1) ?? null;
for (const [path, data] of [
  [out, m],
  [
    "data/home/contractor-hub-intel-v2.json",
    projectIntelV2FromNetworkMetrics(m),
  ],
]) {
  const bytes = JSON.stringify(data, null, 2) + "\n";
  if (check) {
    if (readFileSync(join(root, path), "utf8") !== bytes)
      throw Error("Stale metrics: " + path);
  } else writeFileSync(join(root, path), bytes);
}
console.log(
  JSON.stringify({
    check,
    generatedAt,
    fingerprint: m.sourceFingerprint,
    universe: sum(liveGroups),
    partition: liveStatus,
    remainder: 0,
  }),
);
