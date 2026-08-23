import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadContractorEnv } from "../lib/network-discovery/env";
import {
  PILOT_ARTIFACT,
  publishContractorDiscoveryPilot,
} from "../lib/network-discovery/publish";

loadContractorEnv();

const result = await publishContractorDiscoveryPilot();
if (!result.validationOk) {
  console.error("VALIDATION FAILED", result.validationIssues.slice(0, 20));
  process.exit(1);
}

const tExport = performance.now();
const outDir = join(process.cwd(), "data", "network-discovery");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, PILOT_ARTIFACT);
writeFileSync(outPath, JSON.stringify(result.manifest, null, 2) + "\n", "utf8");
const export_ms = Number((performance.now() - tExport).toFixed(3));

console.log(
  JSON.stringify(
    {
      wrote: outPath,
      entity_count: result.manifest.entity_count,
      fingerprint: result.manifest.fingerprint,
      eligibility: result.manifest.eligibility,
      category_breakdown: result.manifest.category_breakdown,
      geography: result.manifest.geography,
      identity: result.manifest.identity,
      query_readiness: result.manifest.query_readiness,
      catalog_estimates: result.catalog_estimates,
      timings_ms: { ...result.timings_ms, export_ms },
      external_calls: { Google: 0, LLM: 0, external_geo: 0, other_enrichment: 0 },
    },
    null,
    2
  )
);
