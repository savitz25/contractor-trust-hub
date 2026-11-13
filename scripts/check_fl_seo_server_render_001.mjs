#!/usr/bin/env node
/**
 * FL-SEO-SERVER-RENDER-001 HTML check (read-only GET).
 * Usage: node scripts/check_fl_seo_server_render_001.mjs <baseUrl> [canonicalOrigin]
 * Fetches the five Florida research pages and checks the JavaScript-disabled
 * view: one visible <main>, an H1, real research text, no loading placeholder,
 * no pending streamed Suspense chunks, self canonical, index/follow robots,
 * internal links and source citations.
 */
const base = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const canonicalOrigin = (process.argv[3] || "https://www.contractortrusthub.com").replace(/\/$/, "");
const UA = "TrustHubOps-FLSEO-001/1.0 (read-only check)";

const PAGES = [
  { path: "/florida", must: ["Florida"], minWords: 400 },
  { path: "/florida/broward", must: ["Broward"], minWords: 300 },
  { path: "/florida/palm-beach", must: ["Palm Beach"], minWords: 300 },
  { path: "/florida/miami-dade", must: ["Miami-Dade"], minWords: 300 },
  { path: "/florida/pinellas", must: ["Pinellas"], minWords: 300 },
];

const decode = (s) =>
  s.replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
const text = (html) =>
  decode(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<template[\s\S]*?<\/template>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

let failed = 0;
const results = [];
for (const p of PAGES) {
  const t0 = Date.now();
  const res = await fetch(base + p.path, { headers: { "user-agent": UA }, redirect: "manual" });
  const ms = Date.now() - t0;
  const html = await res.text();
  const head = html.slice(0, html.indexOf("<body") > 0 ? html.indexOf("<body") : 20000);
  const mains = html.match(/<main[\s>]/g) || [];
  const firstMain = (html.match(/<main[\s\S]*?<\/main>/) || [""])[0];
  const mainText = text(firstMain);
  const words = mainText ? mainText.split(" ").length : 0;
  const h1 = (firstMain.match(/<h1[\s\S]*?<\/h1>/) || [""])[0];
  const canonical = (html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/) || [])[1] || null;
  const robots = (html.match(/<meta[^>]+name="robots"[^>]+content="([^"]+)"/) || [])[1] || null;
  const xRobots = res.headers.get("x-robots-tag");
  const internal = new Set([...firstMain.matchAll(/href="(\/[^"#?]*)/g)].map((m) => m[1]));
  const external = new Set([...firstMain.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => m[1]).filter((u) => !u.startsWith(canonicalOrigin)));
  const checks = {
    status200: res.status === 200,
    singleMain: mains.length === 1,
    h1Present: text(h1).length > 0,
    noLoadingPlaceholder: !/Loading Florida research|Loading contractor list/.test(html),
    noPendingStreamChunks: !/<div hidden id="S:\d+"/.test(html) && !/<!--\$\?-->/.test(html),
    meaningfulMain: words >= p.minWords,
    countySpecific: p.must.every((m) => mainText.includes(m) && text(h1).includes(m)),
    canonicalSelf: canonical === canonicalOrigin + p.path,
    robotsIndexFollow: robots === "index, follow" && !xRobots,
    internalLinks: [...internal].some((h) => h.startsWith("/florida/") || h === "/florida") && internal.size >= 5,
    // Research citations are rendered as source-catalog text (agency, dataset,
    // request ids), not outbound links, so check the citation text itself.
    citations: /DBPR/.test(mainText) && (p.path !== "/florida" || /Sunbiz/.test(mainText)),
  };
  const ok = Object.values(checks).every(Boolean);
  if (!ok) failed++;
  results.push({ path: p.path, ok, ms, bytes: html.length, mainWords: words, h1: text(h1), canonical, robots, xRobots, internalLinks: internal.size, externalCitations: external.size, checks });
}
console.log(JSON.stringify(results, null, 2));
if (failed) {
  console.error(`FL-SEO-SERVER-RENDER-001: ${failed} page(s) FAILED`);
  process.exit(1);
}
console.log("FL-SEO-SERVER-RENDER-001: all Florida research pages PASS");
