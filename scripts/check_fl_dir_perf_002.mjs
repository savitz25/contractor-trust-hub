#!/usr/bin/env node
/**
 * FL-DIR-PERF-002 HTML check (read-only GETs; for a LOCAL `next start` only).
 * Usage: node scripts/check_fl_dir_perf_002.mjs <baseUrl> <ok|empty|fail>
 *   ok    = DB answers (scripts/fl_dir_perf_002/representative_sample.sql):
 *           county/trade and city+trade render results, H1, self canonical and
 *           index,follow in the INITIAL HTML (no loading shell); a real zero
 *           county/trade is an indexable "No matches"; unknown trade under a
 *           county is a real 404.
 *   empty = schema present, zero rows: real empty states (200 "No matches"),
 *           city+trade with zero firms is a 404 (unchanged behaviour).
 *   fail  = DB unreachable / SQL error / statement timeout: no Florida directory
 *           URL may answer 200 or show "No matches"; county/trade and city+trade
 *           are HTTP 5xx + noindex; no DB error detail in any response.
 * Every mode: Googlebot and browser UAs. Prints one JSON line per request; exit 1 on any failure.
 */
const base = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const mode = process.argv[3] || "ok";
const ORIGIN = "https://www.contractortrusthub.com";
const UAS = {
  browser: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  googlebot: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
};
const LEAK = [/statement timeout/i, /canceling statement/i, /ECONNREFUSED/, /timeout exceeded when trying to connect/i,
  /relation "[a-z_]+" does not exist/i, /\bSELECT\b[\s\S]{0,40}\bFROM\b/, /licenses_t|firm_key|occupation_code|page_pos/,
  /FloridaDirectoryUnavailableError|listFloridaBrowse/, /\n\s+at [\w.<>]+ \(/, /node_modules\//, /postgres(ql)?:\/\//, /127\.0\.0\.1:\d{3,5}/];

const DIRECTORY_FAIL = [
  "/florida/broward/roofers",
  "/florida/miami-dade/general-contractors",
  "/florida/broward/fort-lauderdale/roofers",
  "/florida/roofers",
  "/florida/general-contractors",
  "/florida/broward?list=1",
];
const CASES = {
  ok: [
    { path: "/florida/broward/roofers", status: 200, index: true, canonical: "/florida/broward/roofers", h1: /Roof.*Broward County/i, must: ["Synthetic Firm"], no: ["No matches", "Loading contractor list"] },
    { path: "/florida/miami-dade/general-contractors", status: 200, index: true, canonical: "/florida/miami-dade/general-contractors", h1: /Miami-Dade County/i, must: ["Synthetic Firm"], no: ["No matches", "Loading contractor list"] },
    { path: "/florida/broward/fort-lauderdale/roofers", status: 200, index: true, canonical: "/florida/broward/fort-lauderdale/roofers", h1: /Fort Lauderdale/i, must: ["Synthetic Firm"], no: ["No matches", "Loading contractor list"], robotsInHead: true },
    { path: "/florida/roofers", status: 200, index: true, canonical: "/florida/roofers", must: ["Synthetic Firm"], no: ["No matches"] },
    { path: "/florida/general-contractors", status: 200, index: true, canonical: "/florida/general-contractors", must: ["Synthetic Firm"], no: ["No matches"] },
    { path: "/florida/leon/roofers", status: 200, index: true, canonical: "/florida/leon/roofers", must: ["No matches"], note: "real zero county/trade" },
    { path: "/florida/broward/roofers?page=2", status: 200, index: false, must: ["Synthetic Firm"] },
    { path: "/florida/broward/not-a-trade", status: 404, index: false },
    { path: "/florida/broward/fort-lauderdale/not-a-trade", status: 404, index: false },
    { path: "/florida/not-a-real-segment", status: 404, index: false },
  ],
  empty: [
    { path: "/florida/broward/roofers", status: 200, index: true, must: ["No matches"] },
    { path: "/florida/roofers", status: 200, index: true, must: ["No matches"] },
    { path: "/florida/broward/fort-lauderdale/roofers", status: 404, index: false },
    { path: "/florida/broward/not-a-trade", status: 404, index: false },
  ],
  fail: [
    ...DIRECTORY_FAIL.map((path) => ({ path, failed: true })),
    { path: "/florida/broward/not-a-trade", status: 404, index: false },
    { path: "/florida/broward/fort-lauderdale/not-a-trade", status: 404, index: false },
    { path: "/florida/not-a-real-segment", status: 404, index: false },
  ],
};

let bad = 0;
for (const [uaName, ua] of Object.entries(UAS)) for (const c of CASES[mode]) {
  const t0 = Date.now();
  let res, html;
  try {
    res = await fetch(base + c.path, { headers: { "user-agent": ua }, redirect: "manual", signal: AbortSignal.timeout(90_000) });
    html = await res.text();
  } catch (e) {
    bad++;
    console.log(JSON.stringify({ mode, ua: uaName, path: c.path, pass: false, fails: [`fetch: ${e}`] }));
    continue;
  }
  const ms = Date.now() - t0;
  const headEnd = html.indexOf("</head>");
  const robots = [...html.matchAll(/<meta[^>]+name="robots"[^>]+content="([^"]+)"/g)].map((m) => ({ c: m[1], inHead: headEnd < 0 || m.index < headEnd }));
  const xr = res.headers.get("x-robots-tag");
  const noindex = robots.some((r) => /noindex/i.test(r.c)) || /noindex/i.test(xr || "");
  const indexable = res.status === 200 && !noindex;
  const canonical = (html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/) || [])[1] || null;
  const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1]?.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim() || null;
  const visible = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<template[\s\S]*?<\/template>/gi, " ").replace(/<div hidden[^>]*>[\s\S]*?<\/div>/gi, " ");
  const leaks = LEAK.filter((r) => r.test(html)).map(String);
  const fails = [];
  if (leaks.length) fails.push(`leak: ${leaks.join(" ")}`);
  if (c.failed) {
    if (res.status < 500) fails.push(`failed read answered ${res.status} (must be 5xx)`);
    if (/No matches for/.test(html)) fails.push('failed read contains "No matches"');
    if (!noindex) fails.push("failed read must carry noindex");
  } else {
    if (res.status !== c.status) fails.push(`status ${res.status} != ${c.status}`);
    if (c.index === true && !indexable) fails.push("expected indexable");
    if (c.index === false && indexable) fails.push("expected not indexable");
    if (c.canonical && canonical !== ORIGIN + c.canonical) fails.push(`canonical ${canonical}`);
    if (c.h1 && !(h1 && c.h1.test(h1))) fails.push(`h1 ${h1}`);
    for (const t of c.must || []) if (!visible.includes(t)) fails.push(`missing in initial HTML: ${t}`);
    for (const t of c.no || []) if (visible.includes(t)) fails.push(`unexpected in initial HTML: ${t}`);
    if (c.robotsInHead && uaName === "googlebot" && !robots.some((r) => r.inHead)) fails.push("robots meta not in <head> for Googlebot");
  }
  if (fails.length) bad++;
  console.log(JSON.stringify({ mode, ua: uaName, path: c.path, status: res.status, ms, robots, xRobots: xr, canonical, h1,
    cacheControl: res.headers.get("cache-control"), noMatches: /No matches for/.test(html), loadingShell: /Loading contractor list/.test(html),
    bytes: html.length, pass: fails.length === 0, fails, note: c.note }));
}
process.exit(bad ? 1 : 0);
