import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

const prevIds: string[] = [];
if (existsSync(outPath)) {
  try {
    const prev = JSON.parse(readFileSync(outPath, "utf8")) as {
      entities?: { network_entity_id: string }[];
    };
    for (const e of prev.entities || []) prevIds.push(e.network_entity_id);
  } catch {
    /* no prior snapshot */
  }
}

writeFileSync(outPath, JSON.stringify(result.manifest, null, 2) + "\n", "utf8");
const export_ms = Number((performance.now() - tExport).toFixed(3));

const newIds = result.manifest.entities.map((e) => e.network_entity_id);
const prevSet = new Set(prevIds);
const newSet = new Set(newIds);
const overlap = newIds.filter((id) => prevSet.has(id)).length;
const removed = prevIds.filter((id) => !newSet.has(id)).length;
const added = newIds.filter((id) => !prevSet.has(id)).length;
const unexpected_id_remaps = newIds.filter((id) => !id.startsWith("contractor:")).length;

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
      membership_delta: {
        old: prevIds.length,
        new: newIds.length,
        overlap,
        removed,
        added,
        unexpected_id_remaps,
      },
      query_readiness_counts: (result.manifest.query_readiness as { counts?: unknown } | undefined)?.counts,
      catalog_estimates: result.catalog_estimates,
      timings_ms: { ...result.timings_ms, export_ms },
      external_calls: { Google: 0, LLM: 0, external_geo: 0, other_enrichment: 0 },
    },
    null,
    2
  )
);
