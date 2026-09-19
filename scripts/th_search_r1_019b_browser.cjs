/**
 * TH-SEARCH-R1-019B review 2 -- browser tooling proof.
 *
 * Fresh, isolated, HEADLESS browser context per viewport (no shared profile, no extension, no
 * iframe). Explicit CSS viewport, deviceScaleFactor 1 (100% zoom), text typed with real key events
 * and submitted with a real keyboard Enter. Screenshots are written next to the JSON.
 *
 * Usage: node scripts/th_search_r1_019b_browser.cjs <baseUrl> <playwright-core dir> <label> "<query>"...
 */
const fs = require("node:fs");
const path = require("node:path");
const [baseUrl, pwDir, label, ...queries] = process.argv.slice(2);
const { chromium } = require(path.join(pwDir, "playwright-core"));
const OUT = "docs/qa/th-search-r1-019b/browser";

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
  const report = { ranAt: new Date().toISOString(), baseUrl, browser: await browser.version(), headless: true, submitMethod: "page.keyboard.type + page.keyboard.press('Enter') on the focused search input (trusted key events; no requestSubmit, no iframe)", runs: [] };
  try {
    for (const [i, query] of queries.entries()) {
      const width = [1280, 390][i % 2];
      const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      await page.goto(`${baseUrl}/verify`, { waitUntil: "domcontentloaded" });
      const input = page.locator('input[name="q"]').first();
      await input.click();
      await page.keyboard.type(query, { delay: 15 });
      const typedValue = await input.inputValue();
      const started = Date.now();
      await Promise.all([page.waitForURL(/[?&]q=/, { timeout: 30000 }), page.keyboard.press("Enter")]);
      await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
      const facts = await page.evaluate(() => ({
        url: location.pathname + location.search,
        innerWidth: window.innerWidth,
        clientWidth: document.documentElement.clientWidth,
        devicePixelRatio: window.devicePixelRatio,
        visualViewportScale: window.visualViewport ? window.visualViewport.scale : null,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        retainedQuery: (document.querySelector('input[name="q"]') || {}).value ?? null,
        profileLinks: [...document.querySelectorAll('a[href^="/contractors/"]')].length,
        firstProfile: (document.querySelector('a[href^="/contractors/"]') || {}).textContent ?? null,
        tookTooLong: /took too long|try again/i.test(document.body.innerText),
        noMatch: /no (matching|results|contractors)/i.test(document.body.innerText),
      }));
      const shot = `${label}-${width}-${i + 1}.png`;
      await page.screenshot({ path: path.join(OUT, shot), fullPage: false });
      report.runs.push({ query, cssViewportWidth: width, typedValue, elapsedMs: Date.now() - started, screenshot: shot, ...facts });
      await context.close();
    }
    // 320 px overflow check of the search page itself (no query is sent).
    const context = await browser.newContext({ viewport: { width: 320, height: 800 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/verify`, { waitUntil: "networkidle" });
    report.overflow320 = await page.evaluate(() => ({ innerWidth: window.innerWidth, scrollWidth: document.documentElement.scrollWidth, horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth }));
    await page.screenshot({ path: path.join(OUT, `${label}-320-form.png`) });
    await context.close();
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(OUT, `${label}.json`), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
