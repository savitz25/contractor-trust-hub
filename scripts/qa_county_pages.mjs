import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const out = join("artifacts", "pra-prompt3-qa");
mkdirSync(out, { recursive: true });
const base = "http://127.0.0.1:3005";
const routes = ["/florida/miami-dade", "/florida/pinellas", "/florida/broward"];

const browser = await chromium.launch({ headless: true });
const report = [];
for (const path of routes) {
  for (const [name, viewport] of [
    ["desktop", { width: 1280, height: 900 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    const page = await browser.newPage({ viewport });
    const rec = { path, name, status: 0 };
    try {
      const resp = await page.goto(base + path, { waitUntil: "domcontentloaded", timeout: 45000 });
      rec.status = resp?.status() ?? 0;
      await page.waitForTimeout(2500);
      rec.title = await page.title();
      rec.h1 = (await page.locator("h1").first().innerText()).slice(0, 120);
      rec.body = (await page.locator("body").innerText()).slice(0, 2500);
      rec.hasStatewide = /Statewide Research/i.test(rec.body);
      rec.hasEnhanced = /Enhanced Local Research/i.test(rec.body);
      rec.hasRegulatory = /Regulatory & Enforcement History/.test(rec.body);
      rec.hasCanonical = rec.body.includes(path);
      rec.zerosFake = /0 local permit/i.test(rec.body);
      await page.screenshot({ path: join(out, `${path.slice(1).replaceAll("/", "-")}-${name}.png`), fullPage: true });
    } catch (e) {
      rec.error = String(e).slice(0, 400);
    }
    report.push(rec);
    await page.close();
  }
}
writeFileSync(join(out, "qa.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.map((r) => ({ path: r.path, name: r.name, status: r.status, h1: r.h1, statewide: r.hasStatewide, enhanced: r.hasEnhanced, err: r.error })), null, 2));
await browser.close();
