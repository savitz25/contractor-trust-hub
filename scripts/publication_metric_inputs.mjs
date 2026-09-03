/**
 * Parse publication/config sources that the network metric rollup must track.
 * Used by the generator and by staleness tests so a new live state or county
 * page cannot ship without regenerating contractor-network-metrics-v1.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

export function publicationMetricInputs() {
  const config = read("lib/states/config.ts");
  const order = [...config.match(/LIVE_STATE_ORDER = \[([^\]]+)\]/)[1].matchAll(/"([a-z]+)"/g)].map((m) => m[1]);
  const slugToCode = { fl: "FL", tx: "TX", nj: "NJ", or: "OR", wa: "WA", ca: "CA", az: "AZ", la: "LA", ms: "MS", ky: "KY", wi: "WI" };
  const liveStateCodes = [];
  const liveSourceSystems = [];
  for (const slug of order) {
    const re = new RegExp(`\\n  ${slug}: \\{([\\s\\S]*?)\\n  \\},`);
    const block = config.match(re)?.[1];
    if (!block || !/live:\s*true/.test(block)) continue;
    liveStateCodes.push(slugToCode[slug] || slug.toUpperCase());
    const multi = block.match(/licenseSources:\s*\[([^\]]+)\]/);
    if (multi) liveSourceSystems.push(...[...multi[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]));
    else liveSourceSystems.push(block.match(/licenseSource:\s*"([^"]+)"/)[1]);
  }

  const flCoverage = read("lib/intelligence/coverage.ts");
  const floridaCountyIntelligencePages = [
    ...flCoverage.match(/export const FLORIDA_COUNTY_INTEL_SLUGS = \[([^\]]+)\]/s)[1].matchAll(/"([^"]+)"/g),
  ].map((m) => m[1]);

  const njCatalog = read("lib/new-jersey-intelligence/counties/catalog.ts");
  const njPublishedCountyPages = [
    ...njCatalog.match(/export const NJ_COUNTY_SLUGS = \[([^\]]+)\]/s)[1].matchAll(/"([^"]+)"/g),
  ].map((m) => m[1]);

  const caLocal = read("lib/california-intelligence/local/publication.ts");
  const caCityLocalPages = [...caLocal.matchAll(/path:\s*"(\/california\/[^"]+)"/g)].map((m) => m[1]);

  return {
    liveStateCodes,
    liveSourceSystems: [...new Set(liveSourceSystems)].sort(),
    floridaCountyIntelligencePages,
    njPublishedCountyPages,
    caCityLocalPages,
    publishedCountyIntelligencePageCount:
      floridaCountyIntelligencePages.length + njPublishedCountyPages.length,
  };
}
