import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "artifacts", "pra-prompt2");
mkdirSync(out, { recursive: true });
const bodies = join(root, "docs/intelligence/enhanced-county/pra-bodies");

const jobs = [
  { id: "PRR-MDC-PERMITS-001", county: "Miami-Dade", department: "RER", select: "https://miamidadecounty.govqa.us/WEBAPP/_rs/RequestSelect.aspx", rqst: "9", body: "mdc-permits.txt" },
  { id: "PRR-MDC-CONTRACTORS-001", county: "Miami-Dade", department: "RER", select: "https://miamidadecounty.govqa.us/WEBAPP/_rs/RequestSelect.aspx", rqst: "9", body: "mdc-contractors.txt" },
  { id: "PRR-MDC-ENFORCEMENT-001", county: "Miami-Dade", department: "RER", select: "https://miamidadecounty.govqa.us/WEBAPP/_rs/RequestSelect.aspx", rqst: "9", body: "mdc-enforcement.txt" },
  { id: "PRR-PIN-PERMITS-001", county: "Pinellas", department: "BUILDING SERVICES", select: "https://pinellas.govqa.us/WEBAPP/_rs/RequestSelect.aspx", rqst: "65", body: "pinellas-permits.txt" },
  { id: "PRR-PIN-CONTRACTORS-001", county: "Pinellas", department: "CONTRACTOR LICENSING", select: "https://pinellas.govqa.us/WEBAPP/_rs/RequestSelect.aspx", rqst: "67", body: "pinellas-contractors.txt" },
  { id: "PRR-PIN-ENFORCEMENT-001", county: "Pinellas", department: "CONTRACTOR LICENSING", select: "https://pinellas.govqa.us/WEBAPP/_rs/RequestSelect.aspx", rqst: "67", body: "pinellas-enforcement.txt" },
];

async function snap(page, name) {
  await page.screenshot({ path: join(out, name + ".png"), fullPage: true });
  writeFileSync(join(out, name + ".html"), await page.content());
}

async function clickAnon(page) {
  const candidates = [
    "input[name='RequesLoginFormLayout3$lnkAnonymous']",
    "#RequesLoginFormLayout3_lnkAnonymous_I",
    "input[value='Submit'][name*='Anonymous']",
    "text=INTERACT ANONYMOUSLY",
    "text=Interact Anonymously",
    "text=Submit Anonymously",
  ];
  for (const sel of candidates) {
    const loc = page.locator(sel).first();
    if (await loc.count()) {
      await loc.click({ force: true, timeout: 8000 }).catch(() => loc.evaluate((el) => el.click()));
      await page.waitForTimeout(3000);
      return sel;
    }
  }
  return null;
}

const browser = await chromium.launch({ headless: true });
const results = [];

for (const job of jobs) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1400 } });
  const page = await ctx.newPage();
  const rec = { ...job, filed: false, request_id: null, fee: null, status: "NOT_FILED", notes: "" };
  try {
    await page.goto(job.select, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(1500);
    const openUrl = page.url().replace(/RequestSelect\.aspx.*/, "RequestOpen.aspx?rqst=" + job.rqst);
    await page.goto(openUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(2000);
    rec.login_url = page.url();
    const anon = await clickAnon(page);
    rec.anon_control = anon;
    await snap(page, job.id + "-anon");

    const body = readFileSync(join(bodies, job.body), "utf8");
    if (await page.locator("textarea").count()) {
      await page.locator("textarea").first().fill(body);
    } else {
      rec.status = "ANON_CLICKED_NO_TEXTAREA";
      rec.notes = "Anonymous path reached but request description field not found. URL=" + page.url();
      results.push(rec);
      await ctx.close();
      continue;
    }
    const emails = page.locator("input[type=email], input[id*='mail' i], input[name*='mail' i]");
    const n = await emails.count();
    for (let i = 0; i < n; i++) {
      await emails.nth(i).fill("hello@asktrusthub.com").catch(() => {});
    }
    const captcha = await page.locator("iframe[src*='recaptcha'], .g-recaptcha").count();
    rec.captcha = captcha > 0;
    await snap(page, job.id + "-ready");
    if (captcha) {
      rec.status = "BLOCKED_CAPTCHA";
      rec.notes = "Anonymous form reached; CAPTCHA blocked submit.";
      results.push(rec);
      await ctx.close();
      continue;
    }
    const submit = page.locator("input[type=submit][value*='Submit' i], button:has-text('Submit')").last();
    await submit.click({ force: true, timeout: 15000 });
    await page.waitForTimeout(5000);
    await snap(page, job.id + "-done");
    const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    const m = text.match(/R\d{6,}-\d+/) || text.match(/REQ-\d+/) || text.match(/W\d{6,}/) || text.match(/reference number[:\s]+([A-Z0-9-]+)/i);
    rec.request_id = m ? m[0] : null;
    rec.filed = /thank you|has been received|request has been submitted|reference number R/i.test(text);
    rec.status = rec.filed ? "SUBMITTED_ANONYMOUS" : "FORM_FILLED_UNCONFIRMED";
    rec.acknowledgment = text.slice(0, 900);
    rec.form_url = page.url();
  } catch (e) {
    rec.status = "ERROR";
    rec.notes = String(e).slice(0, 700);
    await snap(page, job.id + "-v3error").catch(() => {});
  }
  results.push(rec);
  await ctx.close();
}

writeFileSync(join(out, "filing-results-v3.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results.map((r) => ({ id: r.id, status: r.status, request_id: r.request_id, anon: r.anon_control, url: r.form_url || r.login_url })), null, 2));
await browser.close();
