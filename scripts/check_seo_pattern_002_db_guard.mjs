#!/usr/bin/env node
/**
 * SEO-PATTERN-002 B1 guard HTML check (read-only GETs; for a local `next start`
 * backed by scripts/seo_pattern_002_guard/synthetic_schema.sql).
 * Usage: node scripts/check_seo_pattern_002_db_guard.mjs <baseUrl> <ok|fail|partial-list|partial-oos>
 *   ok          fixture mode 'ok': real rows render; real zero-row segments keep
 *               their indexable empty state; unknown segments stay real 404s.
 *   fail        fixture mode slow / partial-facets, or an
 *               unreachable DATABASE_URL: no AZ/OR/WA segment may answer 200,
 *               be indexable, show an empty-license / zero-count / empty-facet
 *               state, or leak database error details.
 *   partial-list fixture mode 'partial-list': count ok, rows fail. Segments
 *               with rows fail closed; real zero-count segments stay genuine.
 *   partial-oos fixture mode 'partial-oos': WA trade pages (out-of-state facet
 *               read fails) must fail the same way.
 * Prints one JSON line per URL and exits 1 on any failed expectation.
 */
const base = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const mode = process.argv[3] || "ok";
const UA = "TrustHubOps-SEO002-B1-GUARD/1.0 (local read-only check)";

const decode = (s) =>
  s.replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const visibleText = (html) =>
  decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<template[\s\S]*?<\/template>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<[^>]+>/g, " ")
  ).replace(/\s+/g, " ").trim();

const FALSE_EMPTY = [
  /No active (ROC|CCB|L&I) licenses found/,
  /\b0 active contractors?\b/,
  /No categories with records yet/,
  /No [A-Z][\w /&-]* found\b/,
];
// Database error details that must never reach the response body.
const LEAK = [/statement timeout/i, /ECONNREFUSED/, /could not determine data type/i, /seo002 fixture/i, /\bSELECT\b[\s\S]{0,40}\bFROM\b/, /DATABASE_URL/, /pooler\.supabase/];

const SEGMENTS = [
  "/arizona/maricopa", "/arizona/phoenix", "/arizona/roofing", "/arizona/greenlee", "/arizona/pool",
  "/oregon/multnomah", "/oregon/residential-general", "/oregon/wheeler", "/oregon/out-of-state",
  "/washington/king", "/washington/electrical", "/washington/yakima", "/washington/out-of-state",
];
const NOT_FOUND = ["/arizona/not-a-real-segment", "/oregon/not-a-real-segment", "/washington/not-a-real-segment", "/oregon/PHOENIX"];

const CASES = {
  ok: [
    { path: "/arizona/maricopa", status: 200, index: true, mustText: ["Synthetic AZ Roofing"] },
    { path: "/arizona/roofing", status: 200, index: true, mustText: ["Synthetic AZ Roofing"] },
    { path: "/oregon/multnomah", status: 200, index: true, mustText: ["Synthetic OR Builder"] },
    { path: "/oregon/residential-general", status: 200, index: true, mustText: ["Synthetic OR Builder"] },
    { path: "/oregon/out-of-state", status: 200, index: true, mustText: ["Synthetic OR Commercial"] },
    { path: "/washington/king", status: 200, index: true, mustText: ["Synthetic WA Electric"] },
    { path: "/washington/electrical", status: 200, index: true, mustText: ["Synthetic WA Electric", "Out of state"] },
    // Real zero rows: the existing indexable empty state is unchanged.
    { path: "/arizona/greenlee", status: 200, index: true, mustText: ["No active ROC licenses found for"] },
    { path: "/arizona/pool", status: 200, index: true, mustText: ["0 active contractors"] },
    { path: "/oregon/wheeler", status: 200, index: true, mustText: ["No active CCB licenses found for"] },
    { path: "/washington/yakima", status: 200, index: true, mustText: ["No active L&I licenses found for"] },
    ...NOT_FOUND.map((path) => ({ path, status: 404, index: false })),
  ],
  fail: [...SEGMENTS.map((path) => ({ path, failed: true })), ...NOT_FOUND.map((path) => ({ path, status: 404, index: false }))],
  // Listing COUNT answers, the row query fails. Segments with real rows must
  // fail closed; segments whose real count is 0 never run the row query, so
  // they keep the genuine indexable empty state.
  "partial-list": [
    ...["/arizona/maricopa", "/arizona/phoenix", "/arizona/roofing", "/oregon/multnomah", "/oregon/residential-general",
      "/oregon/out-of-state", "/washington/king", "/washington/electrical", "/washington/out-of-state"].map((path) => ({ path, failed: true })),
    { path: "/arizona/greenlee", status: 200, index: true, mustText: ["No active ROC licenses found for"] },
    { path: "/oregon/wheeler", status: 200, index: true, mustText: ["No active CCB licenses found for"] },
    { path: "/washington/yakima", status: 200, index: true, mustText: ["No active L&I licenses found for"] },
  ],
  "partial-oos": [
    { path: "/washington/electrical", failed: true },
    { path: "/washington/king", status: 200, index: true, mustText: ["Synthetic WA Electric"] },
  ],
};

let bad = 0;
for (const c of CASES[mode] || []) {
  const t0 = Date.now();
  const res = await fetch(base + c.path, { headers: { "user-agent": UA }, redirect: "manual" });
  const html = await res.text();
  const ms = Date.now() - t0;
  const text = visibleText(html);
  const robots = [...html.matchAll(/<meta[^>]+name="robots"[^>]+content="([^"]+)"/g)].map((m) => m[1]);
  const xRobots = res.headers.get("x-robots-tag") || "";
  const noindex = robots.some((r) => /noindex/.test(r)) || /noindex/.test(xRobots);
  const indexable = !noindex && robots.some((r) => /(^|,\s*)index/.test(r));
  const falseEmpty = FALSE_EMPTY.filter((re) => re.test(text)).map(String);
  const leaks = LEAK.filter((re) => re.test(html)).map(String);
  const checks = {};
  if (c.failed) {
    checks.non200 = res.status !== 200;
    checks.noindex = noindex;
    checks.noFalseEmpty = falseEmpty.length === 0;
  } else {
    checks.status = res.status === c.status;
    checks.index = c.index ? indexable && !noindex : noindex;
    for (const t of c.mustText || []) checks[`text:${t}`] = text.includes(t);
  }
  checks.noDbErrorLeak = leaks.length === 0;
  checks.noLoadingShell = !/Loading (Arizona|Oregon|Washington) (list|results)/.test(html);
  const pass = Object.values(checks).every(Boolean);
  if (!pass) bad++;
  console.log(JSON.stringify({ mode, path: c.path, status: res.status, ms, robots, xRobots: xRobots || null, falseEmpty, leaks, checks, pass }));
}
if (bad) {
  console.error(`SEO-PATTERN-002 B1 guard (${mode}): ${bad} FAILED`);
  process.exit(1);
}
console.log(`SEO-PATTERN-002 B1 guard (${mode}): PASS`);
