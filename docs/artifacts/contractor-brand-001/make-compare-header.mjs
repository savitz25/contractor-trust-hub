import { chromium } from 'playwright';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 520 } });
const b = pathToFileURL(join(root, 'before/header-desktop.png')).href;
const a = pathToFileURL(join(root, 'after/header-desktop.png')).href;
await page.setContent(`<!DOCTYPE html><html><body style="margin:0;padding:16px;background:#0a2540;color:#fff;font-family:Inter,system-ui,sans-serif">
  <h1 style="font-size:16px;margin:0 0 12px">OLD heavy brackets vs NEW canonical thin brackets</h1>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
    <figure style="margin:0;background:#132a4a;border-radius:10px;overflow:hidden">
      <figcaption style="padding:8px;font-size:11px;color:#fda4af;font-weight:700">BEFORE</figcaption>
      <img src="${b}" style="width:100%;display:block;background:#fff"/>
    </figure>
    <figure style="margin:0;background:#132a4a;border-radius:10px;overflow:hidden">
      <figcaption style="padding:8px;font-size:11px;color:#a5b4fc;font-weight:700">AFTER</figcaption>
      <img src="${a}" style="width:100%;display:block;background:#fff"/>
    </figure>
  </div>
</body></html>`);
await page.waitForTimeout(400);
await page.screenshot({ path: join(root, 'compare-header-desktop.jpg'), type: 'jpeg', quality: 85, fullPage: true });

const mp = await browser.newPage({ viewport: { width: 900, height: 700 } });
await mp.goto(pathToFileURL(join(root, 'mark-compare.html')).href);
await mp.waitForTimeout(300);
await mp.screenshot({ path: join(root, 'mark-compare.jpg'), type: 'jpeg', quality: 85, fullPage: true });
await browser.close();
console.log('compare composites ok');
