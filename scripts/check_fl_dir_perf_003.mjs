#!/usr/bin/env node
/**
 * FL-DIR-PERF-003 HTML check (read-only GETs; for a LOCAL `next start` only).
 * Usage: node scripts/check_fl_dir_perf_003.mjs <baseUrl> <ok|empty|fail|facetfail>
 *   ok        = FL-DIR-PERF-001 fixture: directory pages 200 and indexable; every
 *               robots/googlebot meta agrees (no noindex next to index).
 *   empty     = zero rows: real empty states stay 200, indexable, no "unavailable" notice.
 *   fail      = DB unreachable / SQL error / statement timeout: directory URLs are 5xx;
 *               EVERY robots/googlebot meta on 5xx and 404 says noindex (no "index, follow").
 *   facetfail = fixture + scripts/fl_dir_perf_003/side_list_fault_override.sql: the directory
 *               renders (200, results present) with an "unavailable" notice and noindex;
 *               never a silently empty side list on an indexable page.
 *   memo      = slow fixture (9 s > 8 s statement_timeout): the same failing URL twice in a row;
 *               the first waits for the timeout, the repeat inside 15 s answers 5xx without a
 *               new statement (fast), then a different URL still runs its own read.
 * Googlebot and browser UAs. One JSON line per request; exit 1 on any failure.
 */
const base = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const mode = process.argv[3] || "ok";
const UAS = {
  browser: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  googlebot: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
};
const LEAK = [/statement timeout/i, /canceling statement/i, /ECONNREFUSED/, /timeout exceeded when trying to connect/i,
  /synthetic side-list failure/, /relation "[a-z_]+" does not exist/i, /FloridaDirectoryUnavailableError|listFloridaBrowse/,
  /\n\s+at [\w.<>]+ \(/, /postgres(ql)?:\/\//, /127\.0\.0\.1:\d{3,5}/];
const NOTICE = /(city|trade|county) list could not be loaded/;

const DIRECTORY = [
  "/florida/roofers",
  "/florida/general-contractors",
  "/florida/broward?list=1",
  "/florida/manatee",
  "/florida/broward/roofers",
  "/florida/broward/fort-lauderdale/roofers",
  "/florida/broward/fort-lauderdale/roofers?page=2",
];
const NOT_FOUND = ["/florida/broward/not-a-trade", "/florida/not-a-real-segment", "/florida/broward/fort-lauderdale/not-a-trade"];

const CASES = {
  ok: [
    { path: "/florida/roofers", status: 200, index: true, must: ["Synthetic Roofing"], no: [NOTICE] },
    { path: "/florida/broward?list=1", status: 200, index: true, must: ["Synthetic Roofing"], no: [NOTICE] },
    { path: "/florida/broward/roofers", status: 200, index: true, must: ["Synthetic Roofing"], no: [NOTICE] },
    { path: "/florida/manatee", status: 200, index: true, must: ["No matches"], no: [NOTICE], note: "real zero county" },
    { path: "/florida/broward/roofers?page=2", status: 200, index: false },
    ...NOT_FOUND.map((path) => ({ path, status: 404, index: false })),
  ],
  empty: [
    { path: "/florida/roofers", status: 200, index: true, must: ["No matches"], no: [NOTICE] },
    { path: "/florida/broward/roofers", status: 200, index: true, must: ["No matches"], no: [NOTICE] },
    { path: "/florida/manatee", status: 200, index: true, must: ["No matches"], no: [NOTICE] },
  ],
  fail: [
    ...DIRECTORY.map((path) => ({ path, failed: true })),
    ...NOT_FOUND.map((path) => ({ path, status: 404, index: false })),
  ],
  facetfail: [
    { path: "/florida/roofers", status: 200, index: false, must: ["Synthetic Roofing", "county list could not be loaded"] },
    { path: "/florida/broward?list=1", status: 200, index: false, must: ["Synthetic Roofing", "city list could not be loaded"] },
    { path: "/florida/broward/roofers", status: 200, index: false, must: ["Synthetic Roofing", "city list could not be loaded"] },
    ...NOT_FOUND.map((path) => ({ path, status: 404, index: false })),
  ],
};

let bad = 0;
if (mode === "memo") {
  const steps = [
    { path: "/florida/roofers", slow: true },
    { path: "/florida/roofers", slow: false },
    { path: "/florida/roofers", slow: false },
    { path: "/florida/broward/roofers", slow: true },
    { path: "/florida/broward/roofers", slow: false },
  ];
  for (const s of steps) {
    const t0 = Date.now();
    const res = await fetch(base + s.path, { headers: { "user-agent": UAS.googlebot }, signal: AbortSignal.timeout(90_000) });
    const html = await res.text();
    const ms = Date.now() - t0;
    const metas = [...html.matchAll(/<meta[^>]+name="(robots|googlebot)"[^>]+content="([^"]+)"/g)].map((m) => `${m[1]}=${m[2]}`);
    const fails = [];
    if (res.status < 500) fails.push(`status ${res.status}`);
    if (!metas.length || !metas.every((m) => /noindex/.test(m))) fails.push(`robots ${metas.join(" | ")}`);
    if (s.slow && ms < 7_500) fails.push(`expected a real ~8 s statement timeout, got ${ms} ms`);
    if (!s.slow && ms > 2_000) fails.push(`repeat should be memoised (no statement), took ${ms} ms`);
    if (fails.length) bad++;
    console.log(JSON.stringify({ mode, path: s.path, expectSlow: s.slow, status: res.status, ms, robots: metas, pass: !fails.length, fails }));
  }
  process.exit(bad ? 1 : 0);
}
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
  const metas = [...html.matchAll(/<meta[^>]+name="(robots|googlebot)"[^>]+content="([^"]+)"/g)].map((m) => `${m[1]}=${m[2]}`);
  const xr = res.headers.get("x-robots-tag");
  const noindexAll = metas.length > 0 && metas.every((m) => /noindex/i.test(m));
  const anyNoindex = metas.some((m) => /noindex/i.test(m)) || /noindex/i.test(xr || "");
  const contradictory = anyNoindex && metas.some((m) => !/noindex/i.test(m));
  const indexable = res.status === 200 && !anyNoindex;
  const visible = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<template[\s\S]*?<\/template>/gi, " ");
  const leaks = LEAK.filter((r) => r.test(html)).map(String);
  const fails = [];
  if (leaks.length) fails.push(`leak: ${leaks.join(" ")}`);
  if (contradictory) fails.push(`contradictory robots: ${metas.join(" | ")}`);
  if (c.failed) {
    if (res.status < 500) fails.push(`failed read answered ${res.status} (must be 5xx)`);
    if (/No matches for/.test(html)) fails.push('failed read contains "No matches"');
    if (!noindexAll) fails.push(`every robots meta must say noindex: ${metas.join(" | ")}`);
  } else {
    if (res.status !== c.status) fails.push(`status ${res.status} != ${c.status}`);
    if (c.index === true && !indexable) fails.push("expected indexable");
    if (c.index === false && indexable) fails.push("expected not indexable");
    if (c.index === false && !noindexAll && res.status !== 200) fails.push(`every robots meta must say noindex: ${metas.join(" | ")}`);
    for (const t of c.must || []) if (!(t instanceof RegExp ? t.test(visible) : visible.includes(t))) fails.push(`missing: ${t}`);
    for (const t of c.no || []) if (t instanceof RegExp ? t.test(visible) : visible.includes(t)) fails.push(`unexpected: ${t}`);
  }
  if (fails.length) bad++;
  console.log(JSON.stringify({ mode, ua: uaName, path: c.path, status: res.status, ms, robots: metas, xRobots: xr,
    notice: NOTICE.test(visible), noMatches: /No matches for/.test(html), bytes: html.length, pass: fails.length === 0, fails, note: c.note }));
}
process.exit(bad ? 1 : 0);
