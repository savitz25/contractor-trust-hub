/**
 * Stage 8B funnel structure smoke tests (no browser).
 * node scripts/test_funnel_smoke.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

// Matrix + components exist
assert.ok(fs.existsSync(path.join(root, "lib/funnel/cta-matrix.ts")));
assert.ok(fs.existsSync(path.join(root, "lib/funnel/analytics.ts")));
assert.ok(fs.existsSync(path.join(root, "lib/funnel/journey-context.ts")));
assert.ok(fs.existsSync(path.join(root, "components/funnel/NextBestAction.tsx")));

const matrix = read("lib/funnel/cta-matrix.ts");
for (const fn of [
  "planResultsActions",
  "scopeBuilderActions",
  "quoteAnalyzerActions",
  "trustReportActions",
  "contractAnalyzerActions",
  "projectDashboardActions",
]) {
  assert.match(matrix, new RegExp(fn));
}

// Primary CTAs wired
assert.match(read("components/decision/ScopeBuilderClient.tsx"), /Use this scope in Quote Analyzer/);
assert.match(read("components/decision/ScopeBuilderClient.tsx"), /NextBestAction/);
assert.match(read("components/decision/QuoteAnalyzerClient.tsx"), /quoteAnalyzerActions/);
assert.match(read("components/contractor/TrustNextActions.tsx"), /trustReportActions/);
assert.match(read("components/plan/PlanResults.tsx"), /planResultsActions/);
assert.match(read("components/projects/ProjectDashboardClient.tsx"), /projectDashboardActions/);
assert.match(read("components/projects/ContractAnalyzerClient.tsx"), /Create \/ save protected project/);

// Analytics events named in docs
const analytics = read("lib/funnel/analytics.ts");
for (const e of [
  "scope_created",
  "quote_analyzed",
  "bids_compared",
  "trust_report_viewed",
  "project_created",
  "project_completed",
]) {
  assert.match(analytics, new RegExp(e));
}

// Layout continuity chip
assert.match(read("app/layout.tsx"), /JourneyContextChip/);

// Homepage resume prioritizes projects
assert.match(read("components/home/HomeContinuity.tsx"), /Continue: analyze a quote|Continue project/);

// Independence: no marketplace language in NextBestAction
const nba = read("components/funnel/NextBestAction.tsx");
assert.doesNotMatch(nba, /Best contractors|Guaranteed safe/i);
assert.match(nba, /not a marketplace/i);

// Canonical path routes exist
for (const route of [
  "app/plan",
  "app/tools/scope-builder",
  "app/tools/quote-analyzer",
  "app/tools/compare-bids",
  "app/verify",
  "app/tools/pre-hire-checklist",
  "app/tools/contract-analyzer",
  "app/projects",
  "app/passport",
]) {
  assert.ok(
    fs.existsSync(path.join(root, route)) ||
      fs.existsSync(path.join(root, route + "/page.tsx")),
    `missing route ${route}`
  );
}

console.log("test_funnel_smoke: all passed");
