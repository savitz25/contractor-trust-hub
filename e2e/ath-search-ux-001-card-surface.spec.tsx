/**
 * ATH-SEARCH-UX-001 / D1: the whole name-candidate card opens the profile.
 *
 * Real pointer and touch input against a fixture built from the real AskResultCard markup, the real
 * app/globals.css and the real lib/ask/card-surface.ts handler (transpiled and bound the way the client
 * component binds it). Navigation is observed through routed profile requests, never inferred from the DOM.
 * On the c2af7603 candidate this file fails: lib/ask/card-surface.ts does not exist there and blank padding,
 * resting facts and action-row whitespace do not navigate.
 */
import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const ORIGIN = "http://ath-search-ux-001.fixture";
const PROFILE_A = "/contractors/cac1813307-snyder-co";
const PROFILE_B = "/contractors/cac1815743-snyder-air-conditioning-plumbing-electric-llc";

/** Rendered by scripts/ath_search_ux_001_card_surface_fixture.tsx in a tsx process, outside the Playwright transform. */
let cachedFixture: string | null = null;
function fixtureHtml(): string {
  if (cachedFixture) return cachedFixture;
  cachedFixture = execFileSync(
    process.execPath,
    [path.join(ROOT, "node_modules/tsx/dist/cli.mjs"), path.join(ROOT, "scripts/ath_search_ux_001_card_surface_fixture.tsx")],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  if (!cachedFixture.includes("cth-result-card")) throw new Error("fixture did not render the card");
  return cachedFixture;
}

async function openFixture(page: Page): Promise<string[]> {
  const hits: string[] = [];
  const html = fixtureHtml();
  await page.context().route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/") return route.fulfill({ status: 200, contentType: "text/html", body: html });
    if (url.pathname.startsWith("/contractors/")) {
      hits.push(url.pathname);
      return route.fulfill({ status: 200, contentType: "text/html", body: `<h1 data-testid="profile">PROFILE ${url.pathname}</h1>` });
    }
    return route.fulfill({ status: 404, body: "not found" });
  });
  await page.goto(`${ORIGIN}/`);
  await expect(page.locator("article")).toHaveCount(3);
  expect(await page.evaluate(() => (window as unknown as { __cardSurfacesBound: number }).__cardSurfacesBound)).toBe(2);
  return hits;
}

const cardOf = (page: Page, index: number) => page.locator("article").nth(index);

/** Blank padding of the facts block: inside its right padding, so no text element is under the pointer. */
async function factsPadding(page: Page, index: number) {
  const box = await cardOf(page, index).locator(".cth-result-card__facts").boundingBox();
  if (!box) throw new Error("facts box");
  return { x: box.x + box.width - 8, y: box.y + box.height / 2 };
}

/** Whitespace of the action row to the right of the Save control, outside every control. */
async function actionRowWhitespace(page: Page, index: number) {
  const row = await cardOf(page, index).locator(".cth-result-card__actions").boundingBox();
  const save = await cardOf(page, index).locator('button[data-search-action="save"]').boundingBox();
  if (!row || !save) throw new Error("action row box");
  return { x: row.x + row.width - 8, y: save.y + save.height / 2 };
}

async function expectProfile(page: Page, hits: string[], profile: string) {
  await expect(page.getByTestId("profile")).toHaveText(`PROFILE ${profile}`);
  expect(hits).toEqual([profile]);
}

async function expectNoNavigation(page: Page, hits: string[]) {
  await page.waitForTimeout(300);
  expect(page.url()).toBe(`${ORIGIN}/`);
  expect(hits).toEqual([]);
}

test.describe("D1 card surface", () => {
  test("blank body padding opens the profile", async ({ page }) => {
    const hits = await openFixture(page);
    const point = await factsPadding(page, 0);
    const target = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.className ?? "", point);
    expect(target).toContain("cth-result-card__facts");
    await page.mouse.click(point.x, point.y);
    await expectProfile(page, hits, PROFILE_A);
  });

  test("resting address text opens the profile with an ordinary click", async ({ page }) => {
    const hits = await openFixture(page);
    const address = cardOf(page, 1).locator("p", { hasText: "Recorded address" });
    await address.click({ position: { x: 40, y: 10 } });
    await expectProfile(page, hits, PROFILE_B);
  });

  test("action-row whitespace outside the controls opens the profile", async ({ page }) => {
    const hits = await openFixture(page);
    const point = await actionRowWhitespace(page, 0);
    const target = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.className ?? "", point);
    expect(target).toContain("cth-result-card__actions");
    await page.mouse.click(point.x, point.y);
    await expectProfile(page, hits, PROFILE_A);
  });

  test("the name and View profile still navigate exactly once", async ({ page }) => {
    const hits = await openFixture(page);
    await cardOf(page, 0).locator("h3").click();
    await expectProfile(page, hits, PROFILE_A);
    await page.goBack();
    await expect(page.locator("article")).toHaveCount(3);
    hits.length = 0;
    await cardOf(page, 0).getByText("View profile").click();
    await expectProfile(page, hits, PROFILE_A);
  });

  test("Save and Trace stay independent and open disclosure content is not a navigation target", async ({ page }) => {
    const hits = await openFixture(page);
    await cardOf(page, 0).locator('button[data-search-action="save"]').click();
    await expectNoNavigation(page, hits);
    const summary = cardOf(page, 0).locator('summary[data-search-action="trace"]');
    await summary.click();
    await expect(cardOf(page, 0).locator("details.cth-result-disclosure").first()).toHaveJSProperty("open", true);
    await expectNoNavigation(page, hits);
    await cardOf(page, 0).locator("dd", { hasText: "Florida DBPR" }).first().click();
    await expectNoNavigation(page, hits);
    await summary.click();
    await expect(cardOf(page, 0).locator("details.cth-result-disclosure").first()).toHaveJSProperty("open", false);
    await expectNoNavigation(page, hits);
  });

  test("dragging to select the address, then Ctrl+C, does not navigate", async ({ page, hasTouch }) => {
    test.skip(hasTouch, "mouse drag selection is a fine-pointer gesture");
    const hits = await openFixture(page);
    const box = await cardOf(page, 0).locator("p", { hasText: "Recorded address" }).boundingBox();
    if (!box) throw new Error("address box");
    await page.mouse.move(box.x + 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 260, box.y + box.height / 2, { steps: 12 });
    await page.mouse.up();
    const selected = await page.evaluate(() => window.getSelection()?.toString() ?? "");
    expect(selected).toContain("Recorded address");
    await page.keyboard.press("Control+C");
    await expectNoNavigation(page, hits);
  });

  test("a modified click on blank padding does nothing; on the name it opens a new tab", async ({ page, context }) => {
    const hits = await openFixture(page);
    const point = await factsPadding(page, 0);
    await page.keyboard.down("Control");
    await page.mouse.click(point.x, point.y);
    await page.keyboard.up("Control");
    await expectNoNavigation(page, hits);
    expect(context.pages()).toHaveLength(1);
    const popup = context.waitForEvent("page");
    await cardOf(page, 0).locator("h3").click({ modifiers: ["Control"] });
    const opened = await popup;
    await opened.waitForURL(`${ORIGIN}${PROFILE_A}`);
    await expect(opened.getByTestId("profile")).toHaveText(`PROFILE ${PROFILE_A}`);
    expect(page.url()).toBe(`${ORIGIN}/`);
  });

  test("a row without a public profile stays inert", async ({ page }) => {
    const hits = await openFixture(page);
    await expect(cardOf(page, 2)).not.toHaveAttribute("data-card-surface", /./);
    const point = await factsPadding(page, 2);
    await page.mouse.click(point.x, point.y);
    await expectNoNavigation(page, hits);
    await expect(cardOf(page, 2).getByText("No public profile is published for this row")).toBeVisible();
  });

  test("one profile tab stop per card", async ({ page }) => {
    await openFixture(page);
    const stops = await page.evaluate(() =>
      [...document.querySelectorAll("article")].map((article) => article.querySelectorAll('a[href*="/contractors/"], [tabindex]').length),
    );
    expect(stops).toEqual([1, 1, 0]);
    await expect(cardOf(page, 0)).not.toHaveAttribute("tabindex", /./);
  });

  test("tap on blank padding opens the profile; a scroll gesture does not", async ({ page, hasTouch }) => {
    test.skip(!hasTouch, "touch project only");
    const hits = await openFixture(page);
    const tapPoint = await factsPadding(page, 0);
    await page.touchscreen.tap(tapPoint.x, tapPoint.y);
    await expectProfile(page, hits, PROFILE_A);
    await page.goBack();
    await expect(page.locator("article")).toHaveCount(3);
    hits.length = 0;
    const start = await factsPadding(page, 1);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: start.x, y: start.y }] });
    for (let step = 1; step <= 6; step += 1) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: start.x, y: start.y - step * 40 }] });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expectNoNavigation(page, hits);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });

  test("hover lift exists for fine pointers and is removed under reduced motion", async ({ page, hasTouch }) => {
    test.skip(hasTouch, "hover is a fine-pointer state");
    await openFixture(page);
    const reduced = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
    await cardOf(page, 0).hover({ position: { x: 300, y: 12 } });
    await page.waitForTimeout(250);
    const transform = await cardOf(page, 0).evaluate((el) => getComputedStyle(el).transform);
    if (reduced) expect(transform).toBe("none");
    else expect(transform).toBe("matrix(1, 0, 0, 1, 0, -2)");
  });
});
