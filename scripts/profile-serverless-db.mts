import { performance } from "node:perf_hooks";
import { DEFAULT_BROWSE } from "../lib/discovery/browse";
import { getCounty, getDiscoveryState, getTrade } from "../lib/discovery/config";
import { listFloridaBrowse } from "../lib/discovery/florida-list";
import { getContractorBySlug } from "../lib/contractors/queries";

const state = getDiscoveryState("florida");
if (!state) throw new Error("Florida discovery is unavailable");

const cases = [
  ["Miami roofing", "miami-dade", "roofers", "miami"],
  ["Tampa HVAC", "hillsborough", "air-conditioning", "tampa"],
  ["Orlando GC", "orange", "general-contractors", "orlando"],
] as const;

let profileSlug: string | undefined;
for (const [label, countySlug, tradeSlug, citySlug] of cases) {
  const started = performance.now();
  const result = await listFloridaBrowse({
    county: getCounty(state, countySlug),
    trade: getTrade(state, tradeSlug),
    browse: { ...DEFAULT_BROWSE, citySlug },
  });
  profileSlug ||= result.results[0]?.slug;
  console.log(
    `${label}: ms=${Math.round(performance.now() - started)} firms=${result.total} rows=${result.results.length}`
  );
}

if (!profileSlug) throw new Error("No profile was available to measure");
const profileStarted = performance.now();
const profile = await getContractorBySlug(profileSlug);
console.log(
  `Profile: ms=${Math.round(performance.now() - profileStarted)} rendered=${profile ? "yes" : "no"}`
);
