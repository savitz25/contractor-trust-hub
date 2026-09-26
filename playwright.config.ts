import { defineConfig, devices } from "@playwright/test";

/**
 * Browser regressions with real pointer and touch input. The fixture pages are built from the real card
 * component, the real stylesheet and the real surface handler, so no database or dev server is needed.
 *   npm run check:ath-search-ux-001:browser
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: { headless: true, trace: "retain-on-failure" },
  projects: [
    {
      name: "desktop-1440x1000",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 }, hasTouch: false },
    },
    {
      name: "mobile-390x844-touch",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
    },
    {
      name: "desktop-1440x1000-reduced-motion",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 }, hasTouch: false, contextOptions: { reducedMotion: "reduce" } },
    },
  ],
});
