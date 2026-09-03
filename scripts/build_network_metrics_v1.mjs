/**
 * Build contractor-network-metrics-v1 from production + publication-gated snapshots.
 * Does not merge truncated CA CSLB rows into the live credential denominator.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const requireJson = createRequire(import.meta.url);

function loadEnv(p) {
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnv(join(root, ".env.local"));
loadEnv("C:\\Users\\makei\\contractor-trust-hub\\.env.local");

async function restCount(base, key, table, query = "") {
  const url = `${base}/rest/v1/${table}?select=*${query ? `&${query}` : ""}`;
  const res = await fetch(url, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "count=exact",
      Range: "0-0",
      "Range-Unit": "items",
    },
  });
  const t = await res.text();
  if (!res.ok && res.status !== 206 && res.status !== 416) {
    throw new Error(`${table} ${query} ${res.status} ${t.slice(0, 180)}`);
  }
  const tail = (res.headers.get("content-range") || "").split("/")[1];
  return tail && tail !== "*" ? Number(tail) : 0;
}

function liveCohortFromConfig() {
  const src = readFileSync(join(root, "lib/states/config.ts"), "utf8");
  const orderMatch = src.match(/LIVE_STATE_ORDER = \[([^\]]+)\]/);
  if (!orderMatch) throw new Error("LIVE_STATE_ORDER missing");
  const order = [...orderMatch[1].matchAll(/"([a-z]+)"/g)].map((m) => m[1]);
  const slugToCode = { fl: "FL", tx: "TX", nj: "NJ", or: "OR", wa: "WA", ca: "CA", az: "AZ", la: "LA", ms: "MS", ky: "KY", wi: "WI" };
  const codes = [];
  const sources = [];
  for (const slug of order) {
    const re = new RegExp(`\\n  ${slug}: \\{([\\s\\S]*?)\\n  \\},`);
    const block = src.match(re)?.[1];
    if (!block) throw new Error(`state block missing: ${slug}`);
    if (!/live:\s*true/.test(block)) continue;
    codes.push(slugToCode[slug] || slug.toUpperCase());
    const multi = block.match(/licenseSources:\s*\[([^\]]+)\]/);
    if (multi) sources.push(...[...multi[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]));
    else {
      const one = block.match(/licenseSource:\s*"([^"]+)"/);
      if (!one) throw new Error(`licenseSource missing: ${slug}`);
      sources.push(one[1]);
    }
  }
  return { liveStateCodes: codes, liveSourceSystems: [...new Set(sources)].sort() };
}

async function main() {
  const { computeContractorNetworkMetrics } = await import(
    pathToFileURL(join(root, "lib/metrics/compute-contractor-network-metrics.ts")).href
  );
  const prev = JSON.parse(readFileSync(join(root, "data/home/contractor-hub-intel-v2.json"), "utf8"));
  const nj = JSON.parse(readFileSync(join(root, "lib/new-jersey-intelligence/accepted-snapshot.json"), "utf8"));
  const caMaster = JSON.parse(readFileSync(join(root, "data/raw/ca_cslb_master/manifest.json"), "utf8"));
  const cohort = liveCohortFromConfig();
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !key) throw new Error("Supabase URL/key missing — cannot generate from production");

  const extras = ["ct_dcp", "id_dopl", "mn_dli", "nv_nscb", "ok_cib", "tn_blc", "va_dpor", "wi_dsps"];
  const allSources = [...new Set([...cohort.liveSourceSystems, ...extras])];
  const licensesBySource = {};
  for (const src of allSources) {
    licensesBySource[src] = await restCount(base, key, "licenses", `source_system=eq.${src}`);
  }
  const liveActive = await restCount(
    base,
    key,
    "licenses",
    `source_system=in.(${cohort.liveSourceSystems.join(",")})&status_normalized=in.(active,current)`
  );
  const input = {
    generatedAt: new Date().toISOString(),
    liveStateCodes: cohort.liveStateCodes,
    liveSourceSystems: cohort.liveSourceSystems,
    licensesBySource,
    liveActiveCurrentCredentialRecords: liveActive,
    researchGraphLicenseRecords: Object.values(licensesBySource).reduce((n, v) => n + v, 0),
    researchGraphContractorIdentities: await restCount(base, key, "contractors"),
    contractorEntityLinks: await restCount(base, key, "contractor_entities"),
    publicContactObservations: await restCount(base, key, "public_contact_observations"),
    disciplineActionRows: await restCount(base, key, "discipline_actions"),
    regulatoryObservations: await restCount(base, key, "regulatory_source_observations"),
    regulatoryOccurrences: await restCount(base, key, "regulatory_source_occurrences"),
    indexedPermitSourceRecords: await restCount(base, key, "permit_source_records"),
    evidenceFamilies: prev.regulatoryEvidence.byEvidenceFamily.map((f) => ({
      ...f,
      grain: "discipline_action_row",
    })),
    liveStatus: prev.licensingStatus.liveCohort,
    tradeFamilies: prev.tradeFamilies,
    caProductionCslbRows: licensesBySource.ca_cslb,
    caAcquiredTruncatedRows: caMaster.license_rows,
    caAcquiredAsOf: caMaster.as_of,
    njConstructionSourceRecords: nj.construction.total_source_records,
    njConstructionSourceAsOf: nj.hero.current_value,
    njCurrentMunicipalities: nj.hero.geography_value,
    njMunicipalityAsOf: nj.as_of,
    njPublishedCountyPages: 4,
    njPublicWorksRegulatoryRows: nj.hero.observations_value,
    floridaCountyIntelligencePages: 4,
  };

  const manifest = computeContractorNetworkMetrics(input);
  const outV1 = join(root, "data/home/contractor-network-metrics-v1.json");
  writeFileSync(outV1, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const { projectIntelV2FromNetworkMetrics } = await import(
    pathToFileURL(join(root, "lib/metrics/project-intel-v2.ts")).href
  );
  const intelV2 = projectIntelV2FromNetworkMetrics(manifest);
  intelV2.licensingStatus.graph = prev.licensingStatus.graph;
  writeFileSync(join(root, "data/home/contractor-hub-intel-v2.json"), `${JSON.stringify(intelV2, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        wrote: ["data/home/contractor-network-metrics-v1.json", "data/home/contractor-hub-intel-v2.json"],
        fingerprint: manifest.sourceFingerprint,
        generatedAt: manifest.generatedAt,
        liveCredentials: manifest.liveCohort.licensesBySource,
        liveActive,
        california: manifest.californiaReconciliation,
        newJersey: manifest.newJerseyReconciliation,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
