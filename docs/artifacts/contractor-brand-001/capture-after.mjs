import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, 'after');
mkdirSync(out, { recursive: true });
const origin = process.env.CTH_ORIGIN || 'http://127.0.0.1:3021';
const browser = await chromium.launch({ headless: true });
const report = {};

async function shot(page, name, opts = {}) {
  const isPng = name.endsWith('.png');
  await page.screenshot({
    path: join(out, name),
    type: isPng ? 'png' : 'jpeg',
    ...(isPng ? {} : { quality: 72 }),
    ...opts,
  });
}

const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const p = await desk.newPage();
await p.goto(origin + '/', { waitUntil: 'networkidle', timeout: 90000 });
await p.waitForTimeout(700);
report.desktop = await p.evaluate(() => {
  const logo = document.querySelector('[data-brand-logo]');
  const header = document.querySelector('header');
  const r = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { w: Math.round(b.width), h: Math.round(b.height), src: el.getAttribute?.('src') || null };
  };
  return {
    overflowX: document.documentElement.scrollWidth > innerWidth + 1,
    headerH: header ? Math.round(header.getBoundingClientRect().height) : null,
    logo: r(logo),
    lockup: logo?.getAttribute('data-brand-lockup'),
  };
});
await shot(p, 'header-desktop.png', { clip: { x: 0, y: 0, width: 1440, height: 130 } });
await shot(p, 'desktop-1440.jpg');
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await p.waitForTimeout(400);
await p.locator('footer').first().screenshot({ path: join(out, 'footer.png') });
await desk.close();

for (const w of [1280, 1024, 768, 430, 390, 375]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(origin + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(400);
  report[`w${w}`] = await page.evaluate(() => ({
    overflowX: document.documentElement.scrollWidth > innerWidth + 1,
    logoH: document.querySelector('[data-brand-logo]')?.getBoundingClientRect().height || null,
  }));
  await page.screenshot({ path: join(out, `w${w}.jpg`), type: 'jpeg', quality: 65 });
  await ctx.close();
}

const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const mp = await mob.newPage();
await mp.goto(origin + '/', { waitUntil: 'networkidle', timeout: 90000 });
await mp.waitForTimeout(500);
await shot(mp, 'header-mobile.png', { clip: { x: 0, y: 0, width: 390, height: 120 } });
await shot(mp, 'mobile-390.jpg');
await mob.close();

// Asset board
const board = await browser.newContext({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1 });
const bp = await board.newPage();
await bp.setContent(`<!DOCTYPE html><html><body style="margin:0;padding:24px;font-family:Inter,system-ui;background:#f8fafc;color:#0a2540">
  <h1 style="font-size:18px">CONTRACTOR-BRAND-001 assets</h1>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">
    <figure style="margin:0;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px">
      <figcaption style="font-size:12px;font-weight:700;margin-bottom:8px">FULL lockup · light</figcaption>
      <img src="${origin}/brand/contractor-trust-hub-logo.svg" height="88" alt="full"/>
    </figure>
    <figure style="margin:0;background:#0a2540;border-radius:12px;padding:16px">
      <figcaption style="font-size:12px;font-weight:700;margin-bottom:8px;color:#94a3b8">FULL lockup · dark</figcaption>
      <img src="${origin}/brand/contractor-trust-hub-logo-on-dark.svg" height="88" alt="full dark"/>
    </figure>
    <figure style="margin:0;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px">
      <figcaption style="font-size:12px;font-weight:700;margin-bottom:8px">COMPACT header</figcaption>
      <img src="${origin}/brand/contractor-trust-hub-logo-compact.svg" height="36" alt="compact"/>
    </figure>
    <figure style="margin:0;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;display:flex;gap:16px;align-items:center">
      <figcaption style="font-size:12px;font-weight:700">MARK</figcaption>
      <img src="${origin}/brand/contractor-trust-hub-mark.svg" width="72" height="72" alt="mark"/>
      <img src="${origin}/brand/favicon-192.png" width="48" height="48" alt="favicon"/>
    </figure>
  </div>
  <figure style="margin:16px 0 0;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px">
    <figcaption style="font-size:12px;font-weight:700;margin-bottom:8px">OG 1200×630</figcaption>
    <img src="${origin}/brand/contractor-trust-hub-og.png" style="width:100%;display:block" alt="og"/>
  </figure>
</body></html>`);
await bp.waitForTimeout(500);
await bp.screenshot({ path: join(out, 'asset-board.jpg'), type: 'jpeg', quality: 80, fullPage: true });
await board.close();

await browser.close();
writeFileSync(join(out, 'qa.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
const fail = report.desktop?.overflowX || report.desktop?.lockup !== 'compact';
if (fail) process.exit(1);
console.log('after captures ok');
