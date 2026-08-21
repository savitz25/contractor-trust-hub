import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), 'before');
mkdirSync(out, { recursive: true });
const origin = process.env.ASK_ORIGIN || 'https://www.contractortrusthub.com';
const browser = await chromium.launch({ headless: true });

const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const p = await desk.newPage();
await p.goto(origin + '/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForTimeout(1200);
await p.screenshot({ path: join(out, 'header-desktop.png'), type: 'png', clip: { x: 0, y: 0, width: 1440, height: 130 } });
await p.screenshot({ path: join(out, 'desktop-1440.jpg'), type: 'jpeg', quality: 70 });
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await p.waitForTimeout(400);
await p.locator('footer').first().screenshot({ path: join(out, 'footer.png'), type: 'png' }).catch(async () => {
  await p.screenshot({ path: join(out, 'footer.png'), type: 'png', fullPage: false });
});
await desk.close();

const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const mp = await mob.newPage();
await mp.goto(origin + '/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await mp.waitForTimeout(1000);
await mp.screenshot({ path: join(out, 'header-mobile.png'), type: 'png', clip: { x: 0, y: 0, width: 390, height: 120 } });
await mp.screenshot({ path: join(out, 'mobile-390.jpg'), type: 'jpeg', quality: 70 });
await mob.close();
await browser.close();
console.log('before captures ok →', out);
