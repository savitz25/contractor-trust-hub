#!/usr/bin/env node
/**
 * FL-DIR-PERF-001 HTML check (read-only GETs; for a local `next start`).
 * Usage: node scripts/check_fl_dir_perf_001.mjs <baseUrl> <ok|slow>
 *   ok   = server backed by a DB that answers (synthetic fixture):
 *          a trade with rows renders results; a trade with zero rows is a real,
 *          indexable empty state; unknown segments stay real 404s.
 *   slow = server backed by a DB whose reads exceed the 8 s statement timeout:
 *          no Florida directory URL may show "No matches", and no
 *          non-streamed failed render may answer 200 + index. Streamed routes (behind
 *          [facet]/loading.tsx) must not show "No matches"; their 200 shell is reported.
 * Prints one JSON line per URL and exits 1 on any failed expectation.
 */
const base = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const mode = process.argv[3] || "ok";
const UA = "TrustHubOps-FL-DIR-PERF-001/1.0 (local read-only check)";

const decode = (s) =>
  s.replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const visibleText = (html) =>
  decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<template[\s\S]*?<\/template>/gi, " ")
      .replace(/<div hidden[^>]*>[\s\S]*?<\/div>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  ).replace(/\s+/g, " ").trim();

const CASES = {
  ok: [
    { path: "/florida/roofers", status: 200, index: true, mustText: ["Synthetic Roofing"], noText: ["No matches"] },
    { path: "/florida/underground-utility", status: 200, index: true, mustText: ["No matches"] },
    { path: "/florida/not-a-real-segment", status: 404, index: false },
    // 1 synthetic firm < CITY_INDEX_MIN: thin city page stays noindex (unchanged behavior).
    { path: "/florida/broward/fort-lauderdale/roofers", status: 200, index: false, mustText: ["Synthetic Roofing"] },
  ],
  slow: [
    { path: "/florida/roofers", failed: true },
    { path: "/florida/general-contractors", failed: true },
    { path: "/florida/broward?list=1", failed: true },
    { path: "/florida/orange", failed: true },
    { path: "/florida/broward/roofers", failed: true, streamed: true },
    // City+trade metadata reads the directory: on failure it must emit noindex.
    { path: "/florida/broward/fort-lauderdale/roofers", failed: true, streamed: true, mustNoindex: true },
    { path: "/florida/not-a-real-segment", status: 404, index: false },
  ],
};

let bad = 0;
for (const c of CASES[mode]) {
  const t0 = Date.now();
  const res = await fetch(base + c.path, { headers: { "user-agent": UA }, redirect: "manual" });
  const html = await res.text();
  const ms = Date.now() - t0;
  const robotsMeta = [...html.matchAll(/<meta[^>]+name="robots"[^>]+content="([^"]+)"/g)].map((m) => m[1]);
  const xRobots = res.headers.get("x-robots-tag");
  const canonical = (html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/) || [])[1] || null;
  const text = visibleText(html);
  const rawNoMatches = /No matches for/.test(html);
  const noindex = robotsMeta.some((r) => /noindex/i.test(r)) || /noindex/i.test(xRobots || "");
  const indexable = !noindex && res.status === 200;
  const fails = [];
  let residual = null;
  if (c.failed) {
    if (rawNoMatches) fails.push('failed read contains "No matches" anywhere in the HTML');
    if (c.mustNoindex && !noindex) fails.push("failed read must carry noindex");
    if (res.status === 200 && !noindex) {
      // Routes under app/florida/[segment]/[facet]/loading.tsx flush a 200 loading shell
      // before the DB read; the error then arrives in the stream. Reported, not failed:
      // removing that loading.tsx is a separate follow-up decision.
      if (c.streamed) residual = "streamed route: 200 loading shell was sent before the read failed";
      else fails.push("failed read answered 200 and indexable");
    }
  } else {
    if (res.status !== c.status) fails.push(`status ${res.status} != ${c.status}`);
    if (c.index === true && !indexable) fails.push("expected indexable");
    if (c.index === false && indexable) fails.push("expected not indexable");
    for (const t of c.mustText || []) if (!text.includes(t)) fails.push(`missing text: ${t}`);
    for (const t of c.noText || []) if (text.includes(t)) fails.push(`unexpected text: ${t}`);
  }
  if (fails.length) bad++;
  console.log(
    JSON.stringify({
      mode, path: c.path, status: res.status, ms, robotsMeta, xRobots, canonical,
      cacheControl: res.headers.get("cache-control"), noMatchesInHtml: rawNoMatches,
      h1: (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1]?.replace(/<[^>]+>/g, "").trim() || null,
      pass: fails.length === 0, fails, residual,
    })
  );
}
process.exit(bad ? 1 : 0);
