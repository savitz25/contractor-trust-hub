import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "artifacts", "pra-prompt2");
mkdirSync(out, { recursive: true });
const bodies = join(root, "docs/intelligence/enhanced-county/pra-bodies");

const jobs = [
  { id: "PRR-MDC-PERMITS-001", body: "mdc-permits.txt" },
  { id: "PRR-MDC-CONTRACTORS-001", body: "mdc-contractors.txt" },
  { id: "PRR-MDC-ENFORCEMENT-001", body: "mdc-enforcement.txt" },
];

const browser = await chromium.launch({ headless: true });
const results = [];

for (const job of jobs) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1600 } });
  const page = await ctx.newPage();
  const rec = { ...job, filed: false, status: "NOT_FILED" };
  try {
    await page.goto("https://miamidadecounty.govqa.us/WEBAPP/_rs/RequestSelect.aspx", {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.waitForTimeout(1200);
    const openUrl = page.url().replace(/RequestSelect\.aspx.*/, "RequestOpen.aspx?rqst=9");
    await page.goto(openUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(1500);
    await page.locator("input[name='RequesLoginFormLayout3$lnkAnonymous']").click({ force: true });
    await page.waitForURL(/RequestOpen\.aspx.*anon=1/, { timeout: 30000 });
    await page.waitForTimeout(2000);
    const desc = page.locator("#requestData_CustomFieldsFormLayout_cf_DeflectionInlineTextContainer_2_I");
    await desc.waitFor({ timeout: 20000 });
    await desc.fill(readFileSync(join(bodies, job.body), "utf8"));
    const email = page.locator("#requestData_CustomFieldsFormLayout_cf_23_I");
    if (await email.count()) {
      await email.fill("hello@asktrusthub.com");
    }
    await page.screenshot({ path: join(out, job.id + "-mdc-ready2.png"), fullPage: true });
    await page.locator("#btnSaveData_I").click({ force: true });
    await page.waitForTimeout(6000);
    await page.screenshot({ path: join(out, job.id + "-mdc-done2.png"), fullPage: true });
    writeFileSync(join(out, job.id + "-mdc-done2.html"), await page.content());
    const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    rec.url = page.url();
    rec.text = text.slice(0, 1200);
    rec.request_id = (text.match(/R\d{6,}-\d+/) || text.match(/W\d{6,}/) || [null])[0];
    rec.filed = /thank you|has been received|successfully submitted/i.test(text);
    rec.status = rec.filed ? "SUBMITTED_ANONYMOUS" : "UNCONFIRMED";
  } catch (e) {
    rec.status = "ERROR";
    rec.notes = String(e).slice(0, 700);
  }
  results.push(rec);
  await ctx.close();
}
writeFileSync(join(out, "mdc-v4.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results.map((r) => ({ id: r.id, status: r.status, request_id: r.request_id, url: r.url })), null, 2));
await browser.close();
