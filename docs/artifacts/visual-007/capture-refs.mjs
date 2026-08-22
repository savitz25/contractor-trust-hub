import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const hubs = [
  { id: "ask", origin: "https://www.asktrusthub.com", dir: "ask-ref" },
  { id: "investor", origin: "https://www.investortrusthub.com", dir: "investor-ref" },
  { id: "lender", origin: "https://www.lendertrusthub.com", dir: "lender-ref" },
  { id: "insurance", origin: "https://www.insurancetrusthub.com", dir: "insurance-ref" },
  { id: "move", origin: "https://www.movetrusthub.com", dir: "move-ref" },
];

const browser = await chromium.launch({ headless: true });
const report = {};

async function shot(origin, dir) {
  const out = join(root, dir);
  mkdirSync(out, { recursive: true });
  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const p = await desk.newPage();
  await p.goto(origin + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(800);
  const header = await p.evaluate(() => {
    const el = document.querySelector("header");
    const b = el?.getBoundingClientRect();
    return b ? Math.round(b.height) : 69;
  });
  await p.screenshot({ path: join(out, "desktop-1440.jpg"), type: "jpeg", quality: 70 });
  await p.screenshot({
    path: join(out, "header-desktop.png"),
    type: "png",
    clip: { x: 0, y: 0, width: 1440, height: Math.min(header + 4, 90) },
  });
  await desk.close();

  const mob = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  const mp = await mob.newPage();
  await mp.goto(origin + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
  await mp.waitForTimeout(600);
  const mh = await mp.evaluate(() => {
    const el = document.querySelector("header");
    const b = el?.getBoundingClientRect();
    return b ? Math.round(b.height) : 57;
  });
  await mp.screenshot({ path: join(out, "mobile-390.jpg"), type: "jpeg", quality: 70 });
  await mp.screenshot({
    path: join(out, "header-mobile.png"),
    type: "png",
    clip: { x: 0, y: 0, width: 390, height: Math.min(mh + 4, 80) },
  });
  await mob.close();
  report[origin] = { header, mh };
}

try {
  for (const hub of hubs) {
    await shot(hub.origin, hub.dir);
  }
} finally {
  await browser.close();
}

writeFileSync(join(root, "refs-qa.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
