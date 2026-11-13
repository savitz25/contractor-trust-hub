#!/usr/bin/env node
/**
 * CONTRACTOR-SEO-PATTERN-002 HTML check (read-only GET, JavaScript disabled).
 * Usage: node scripts/check_contractor_seo_pattern_002.mjs <baseUrl> [canonicalOrigin]
 * The seven state research pages must show one visible main, an H1, research
 * text, citations, and internal links. A loading placeholder or a pending
 * Suspense chunk fails the check.
 */
const base = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const canonicalOrigin = (process.argv[3] || "https://www.contractortrusthub.com").replace(/\/$/, "");
const UA = "TrustHubOps-CONSEO-002/1.0 (read-only check)";

const PAGES = [
  { path: "/arizona", h1: "Arizona Contractor License & Regulatory Intelligence", cite: "Registrar of Contractors", minWords: 250 },
  { path: "/colorado", h1: "Colorado Contractor License & Regulatory Intelligence", cite: "DORA", minWords: 250 },
  { path: "/illinois", h1: "Illinois Roofing License Research", cite: "IDFPR", minWords: 200 },
  { path: "/new-york", h1: "New York Public-Work Contractor Registration Intelligence", cite: "NYSDOL", minWords: 250 },
  { path: "/oregon", h1: "Oregon Contractor License & Regulatory Intelligence", cite: "Construction Contractors Board", minWords: 200 },
  { path: "/virginia", h1: "Virginia Contractor License & Regulatory Intelligence", cite: "DPOR", minWords: 250 },
  { path: "/washington", h1: "Washington Contractor Registration, Bond & Insurance Intelligence", cite: "Labor & Industries", minWords: 250 },
];

const decode = (s) =>
  s.replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
const text = (html) =>
  decode(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<template[\s\S]*?<\/template>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

let failed = 0;
const results = [];
for (const page of PAGES) {
  const started = Date.now();
  const response = await fetch(base + page.path, { headers: { "user-agent": UA }, redirect: "manual" });
  const ms = Date.now() - started;
  const html = await response.text();
  const mains = html.match(/<main[\s>]/g) || [];
  const firstMain = (html.match(/<main[\s\S]*?<\/main>/) || [""])[0];
  const mainText = text(firstMain);
  const words = mainText ? mainText.split(" ").filter(Boolean).length : 0;
  const h1 = text((firstMain.match(/<h1[\s\S]*?<\/h1>/) || [""])[0]);
  const canonical = (html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/) || [])[1] || null;
  const robots = (html.match(/<meta[^>]+name="robots"[^>]+content="([^"]+)"/) || [])[1] || null;
  const xRobots = response.headers.get("x-robots-tag");
  const internal = new Set([...firstMain.matchAll(/href="(\/[^"#?]*)/g)].map((match) => match[1]));
  const external = [...firstMain.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((match) => match[1]).filter((url) => !url.startsWith(canonicalOrigin));
  const checks = {
    status200: response.status === 200,
    singleMain: mains.length === 1,
    h1Exact: h1 === page.h1,
    noLoadingPlaceholder: !/Loading (Arizona discovery|Colorado contractor research|Illinois roofing research|New York contractor research|Oregon discovery|Virginia contractor research|Washington discovery)/.test(mainText),
    noPendingStreamChunks: !/<div hidden id="S:\d+"/.test(html) && !/<!--\$\?-->/.test(html),
    meaningfulMain: words >= page.minWords,
    citation: mainText.includes(page.cite),
    canonicalSelf: canonical === canonicalOrigin + page.path,
    robotsIndexFollow: robots === "index, follow" && !xRobots,
    internalLinks: internal.has("/") || [...internal].some((href) => href.startsWith(page.path)),
    externalCitation: external.length >= 1,
    under8s: ms < 8000,
  };
  const ok = Object.values(checks).every(Boolean);
  if (!ok) failed++;
  results.push({
    path: page.path,
    ok,
    ms,
    bytes: html.length,
    mainWords: words,
    h1,
    canonical,
    robots,
    xRobots,
    internalLinks: [...internal],
    externalCitations: external.length,
    checks,
  });
}
console.log(JSON.stringify(results, null, 2));
if (failed) {
  console.error(`CONTRACTOR-SEO-PATTERN-002: ${failed} page(s) FAILED`);
  process.exit(1);
}
console.log("CONTRACTOR-SEO-PATTERN-002: all seven state research pages PASS");
