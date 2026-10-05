import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");
const snapshot = JSON.parse(read("lib/alabama-intelligence/accepted-snapshot.json"));
const page = read("app/alabama/page.tsx");
const sitemap = read("lib/seo/sitemap-data.ts");
const paths = read("lib/seo/published-state-path.ts");
const pkg = read("package.json");

if (snapshot.rows !== 8848 || snapshot.explicitSubcontractorSpecialtyRows !== 3312 || snapshot.unclassifiedRows !== 5536) {
  throw new Error("ALBGC published counts drifted");
}
if (snapshot.primeContractorLabel !== "NOT_IN_SOURCE") throw new Error("prime label");
if ((sitemap.match(/path: "\/alabama"/g) ?? []).length !== 1) throw new Error("sitemap must list /alabama once");
if (!paths.includes('"alabama"')) throw new Error("published slug");
if (!pkg.includes("test:al-con-001")) throw new Error("test script");
if (page.includes("AggregateRating") || page.includes("Trust Score")) throw new Error("no rating");
const metrics = JSON.parse(read("data/home/contractor-network-metrics-v1.json"));
if (!metrics.stateCapabilities.some((row) => row.state === "AL" && row.route === "/alabama")) {
  throw new Error("Alabama route missing from network metrics");
}
if (existsSync(join(root, "app", "alabama", "birmingham"))) throw new Error("no city route");
for (const name of readdirSync(join(root, "app", "alabama"))) {
  if (name !== "page.tsx") throw new Error(`unexpected Alabama route file ${name}`);
}
console.log("alabama publication ok");
