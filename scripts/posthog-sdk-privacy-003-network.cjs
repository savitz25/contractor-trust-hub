// Real SDK network regression for POSTHOG-SDK-PRIVACY-003.
// These checks match the independent C3 browser assertions: exact activation,
// compressed capture, Blob beacons, flag payloads, and origin-scoped transports.
// Offline only. The key is synthetic. No production PostHog project is contacted.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const zlib = require("node:zlib");
const repoRoot = path.resolve(__dirname, "..");
const modules = process.env.POSTHOG_SDK_QA_MODULES || path.join(repoRoot, "node_modules");
if (
  !fs.existsSync(path.join(modules, "esbuild")) ||
  !fs.existsSync(path.join(modules, "playwright")) ||
  !fs.existsSync(path.join(modules, "posthog-js"))
) {
  console.error(
    "Set POSTHOG_SDK_QA_MODULES to a node_modules with esbuild, playwright, and posthog-js.",
  );
  process.exit(1);
}
const esbuild = require(path.join(modules, "esbuild"));
const { chromium } = require(path.join(modules, "playwright"));
const root = fs.mkdtempSync(path.join(os.tmpdir(), "posthog-sdk-privacy-003-"));
const KEY = "phc_C3_V2_SYNTHETIC_OFFLINE_ONLY";
const localRepo = repoRoot;
const localDir = fs.existsSync(path.join(repoRoot, "apps/web/src/lib/analytics/privacy.ts"))
  ? path.join(repoRoot, "apps/web/src/lib/analytics")
  : path.join(repoRoot, "lib/analytics");
const labels = [path.basename(repoRoot)];
const out = {};
async function bundle(label, activation = "enabled", env = "production", debug = "", key = KEY) {
  const repo = localRepo;
  const dir = localDir;

  const contents = `import * as env from ${JSON.stringify(dir + "/environment.ts")}; import * as privacy from ${JSON.stringify(dir + "/privacy.ts")}; import * as client from ${JSON.stringify(dir + "/posthog-browser.ts")}; import * as capture from ${JSON.stringify(dir + "/trusthub.ts")}; window.qa={env,privacy,client,capture};`;
  const built = await esbuild.build({
    stdin: { contents, resolveDir: repo },
    nodePaths: [modules],
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    logLevel: "silent",
    define: {
      "process.env.NEXT_PUBLIC_POSTHOG_KEY": JSON.stringify(key),
      "process.env.NEXT_PUBLIC_POSTHOG_ACTIVATION":
        activation === undefined ? "undefined" : JSON.stringify(activation),
      "process.env.NEXT_PUBLIC_POSTHOG_HOST": '"https://collector.invalid"',
      "process.env.VERCEL_ENV": JSON.stringify(env),
      "process.env.NEXT_PUBLIC_VERCEL_ENV": JSON.stringify(env),
      "process.env.NEXT_PUBLIC_POSTHOG_DEBUG": JSON.stringify(debug),
      "process.env.NODE_ENV": '"production"',
    },
  });
  return built.outputFiles[0].text;
}
async function context(browser, script, options = {}) {
  const ctx = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    serviceWorkers: "block",
  });
  const requests = [];
  await ctx.route("**/*", async (route) => {
    const req = route.request(),
      u = new URL(req.url());
    if (req.isNavigationRequest() && u.hostname === "qa.invalid")
      return route.fulfill({
        status: 200,
        contentType: "text/html",
        body:
          '<html data-analytics-environment="' +
          (options.env || "production") +
          '"><head><title>Research</title></head><body><button id="ordinary" data-note="eldercare family note">Search</button><button id="second">Next</button><button id="case_for_mother" name="case_for_mother">Case details</button><div class="ph-no-capture"><button id="excluded">sensitive family discussion</button></div></body></html>',
      });
    let data = req.postDataBuffer(),
      body = null,
      encoding = "none";
    if (data) {
      try {
        if (data[0] === 31 && data[1] === 139) {
          body = zlib.gunzipSync(data).toString();
          encoding = "gzip";
        } else {
          body = data.toString();
          encoding = "text";
        }
      } catch {
        encoding = "binary";
        body = data.toString("base64");
      }
    }
    requests.push({
      url: req.url(),
      method: req.method(),
      resourceType: req.resourceType(),
      contentType: req.headers()["content-type"] || null,
      bytes: data?.length || 0,
      encoding,
      body: body?.replaceAll(KEY, "[synthetic-project-key]"),
    });
    const payload = {
      featureFlags: {},
      featureFlagPayloads: {},
      sessionRecording: false,
      autocapture_opt_out: false,
      supportedCompression: options.gzip ? ["gzip-js", "gzip"] : [],
    };
    if (u.pathname.startsWith("/array/") && u.pathname.endsWith(".js"))
      return route.fulfill({ status: 200, contentType: "application/javascript", body: "" });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload),
    });
  });
  await ctx.addInitScript((signals) => {
    for (const [key, value] of Object.entries({
      webdriver: false,
      doNotTrack: "0",
      globalPrivacyControl: false,
      cookieEnabled: true,
      ...signals,
    }))
      Object.defineProperty(navigator, key, { get: () => value, configurable: true });
  }, options.signals || {});
  const page = await ctx.newPage();
  await page.goto(
    options.url ||
      "https://qa.invalid/search?q=care%20for%20mother&code=OTP_7x9z&email=alex%40example.invalid",
  );
  await page.addScriptTag({ content: script });
  return { ctx, page, requests };
}
async function initialize(f, uncompressed = false) {
  return f.page.evaluate(async (uncompressed) => {
    window.events = [];
    window.sdk = await qa.client.getPosthogBrowser();
    if (sdk) {
      sdk.on("eventCaptured", (e) => events.push(JSON.parse(JSON.stringify(e))));
      sdk.set_config(
        uncompressed
          ? { opt_out_useragent_filter: true, disable_compression: true, request_batching: false }
          : { opt_out_useragent_filter: true },
      );
    }
    return {
      enabled: qa.env.shouldEnablePosthog(),
      client: !!sdk,
      compression: sdk?.compression,
      disableCompression: sdk?.config.disable_compression,
    };
  }, uncompressed);
}
function captureRequests(requests) {
  return requests.filter((r) => /\/(e|capture|batch)\//.test(new URL(r.url).pathname));
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const label of labels) {
      const tests = [];
      const add = (name, pass, observed) => tests.push({ name, pass, observed });
      const sessions = [];
      for (const activation of [
        "",
        "disabled",
        "true",
        "1",
        "ENABLED",
        "Enabled",
        " enabled",
        "enabled ",
        "\tenabled\n",
        "enabled",
      ]) {
        const f = await context(browser, await bundle(label, activation));
        const got = await initialize(f);
        await f.page.waitForTimeout(150);
        add(
          "literal_latch_" + JSON.stringify(activation),
          got.client === (activation === "enabled") &&
            (activation === "enabled" || f.requests.length === 0),
          { activation, ...got, requestCount: f.requests.length },
        );
        sessions.push({ name: "latch " + JSON.stringify(activation), requests: f.requests });
        await f.ctx.close();
      }
      for (const [name, signals] of [
        ["DNT", { doNotTrack: "1" }],
        ["GPC", { globalPrivacyControl: true }],
        ["cookies_off", { cookieEnabled: false }],
      ]) {
        const f = await context(browser, await bundle(label), { signals });
        const got = await initialize(f);
        await f.page.waitForTimeout(150);
        add(name, !got.client && f.requests.length === 0, {
          ...got,
          requestCount: f.requests.length,
        });
        await f.ctx.close();
      }
      for (const [name, env, debug] of [
        ["preview_off", "preview", "true"],
        ["development_debug_off", "development", "true"],
      ]) {
        const f = await context(browser, await bundle(label, "", env, debug), { env });
        const got = await initialize(f);
        await f.page.waitForTimeout(100);
        add(name, !got.client && f.requests.length === 0, got);
        await f.ctx.close();
      }
      // Exercise the real SDK with default compression/batching and a server advertising gzip support.
      {
        const f = await context(browser, await bundle(label), { gzip: true });
        const got = await initialize(f);
        await f.page.waitForTimeout(150);
        await f.page.evaluate(() => {
          sdk.capture(
            "c3_permitted_default",
            { surface: "ask", success: true },
            { send_instantly: true },
          );
          qa.capture.captureTrustEvent(
            "search_submitted",
            { surface: "ask", success: true },
            { sendBeforeUnload: true },
          );
        });
        await f.page.waitForTimeout(800);
        const events = await f.page.evaluate(() =>
          events.map((e) => ({ event: e.event, properties: e.properties })),
        );
        const captured = captureRequests(f.requests);
        add(
          "default_sdk_permitted_capture_reaches_network",
          captured.some((r) => (r.body || "").includes("c3_permitted_default")),
          { ...got, eventNames: events.map((e) => e.event), captureRequests: captured },
        );
        add(
          "application_sendBeforeUnload_reaches_network",
          captured.some((r) => (r.body || "").includes("search_submitted")),
          { captureRequests: captured },
        );
        sessions.push({ name: "default SDK compressed transport", requests: f.requests, events });
        await f.ctx.close();
      }
      // Distinct uncompressed session to inspect permitted event, flags, and native transport payloads.
      {
        const f = await context(browser, await bundle(label));
        await initialize(f, true);
        await f.page.waitForTimeout(150);
        const probes = await f.page.evaluate(() => {
          const urls = [
            "https://qa.invalid/search?%2571=eldercare-sensitive-query",
            "https://qa.invalid/search?redirect_uri=https%3A%2F%2Ftarget.invalid%2F%3FauthCode%3DAuthZ9x7",
            "https://qa.invalid/search?%2570assword=PwdZ9x7",
            "https://qa.invalid/search?searchTerm=eldercare-sensitive-query",
          ];
          const result = urls.map((input) => ({
            input,
            output: qa.privacy.sanitizeAnalyticsUrl(input),
          }));
          sdk.capture(
            "c3_permitted_json",
            { surface: "ask", success: true },
            { send_instantly: true },
          );
          sdk.setPersonProperties({
            query: "eldercare-sensitive-query",
            question: "family-sensitive-question",
            search: "treatment-sensitive-search",
            token: "AuthZ9x7",
            password: "PwdZ9x7",
            email: "alex@example.invalid",
          });
          sdk.reloadFeatureFlags();
          for (const row of result)
            sdk.capture("$pageview", { $current_url: row.input }, { send_instantly: true });
          return result;
        });
        await f.page.locator("#ordinary").click();
        await f.page.waitForTimeout(300);
        const flags = f.requests.filter((r) => /\/flags\//.test(r.url));
        add(
          "real_sdk_flags_remove_realistic_search_and_auth",
          flags.length > 0 &&
            !/eldercare-sensitive-query|family-sensitive-question|treatment-sensitive-search|AuthZ9x7|PwdZ9x7|alex@/.test(
              JSON.stringify(flags),
            ),
          flags,
        );
        add(
          "encoded_and_nested_sensitive_url_variants",
          !JSON.stringify(probes)
            .split('"output":')
            .slice(1)
            .some((s) => /^("[^"]*(eldercare-sensitive-query|AuthZ9x7|PwdZ9x7))/.test(s)),
          probes,
        );
        const captured = captureRequests(f.requests);
        const pageviews = captured
          .flatMap((r) => {
            try {
              return JSON.parse(r.body).batch || [];
            } catch {
              return [];
            }
          })
          .filter((e) => e.event === "$pageview");
        add(
          "sdk_pageview_network_remove_sensitive_url_variants",
          pageviews.length === 4 &&
            !/eldercare-sensitive-query|AuthZ9x7|PwdZ9x7/.test(JSON.stringify(pageviews)),
          pageviews,
        );
        add(
          "uncompressed_permitted_event_reaches_network",
          captured.some((r) => (r.body || "").includes("c3_permitted_json")),
          captured.map((r) => ({ url: r.url, bytes: r.bytes })),
        );
        const nativeStart = f.requests.length;
        const native = await f.page.evaluate(async () => {
          const payload = JSON.stringify({
            password: "PwdZ9x7",
            query: "eldercare-sensitive-query",
          });
          await fetch(
            new Request("https://collector.invalid/flags/?v=2", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: payload,
            }),
          );
          await fetch("https://collector.invalid/config", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: payload,
          });
          await fetch("https://collector.invalid/flags/?code=AuthZ9x7");
          // This is a non-analytics application request. The global patch must not alter it.
          const response = await fetch("https://qa.invalid/api/capture/submit", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: payload,
          });
          const beacon = sdk.capture(
            "c3_beacon_permitted",
            { surface: "ask", success: true },
            { send_instantly: true, transport: "sendBeacon" },
          );
          return { applicationStatus: response.status, beaconEventCreated: !!beacon };
        });
        await f.page.waitForTimeout(250);
        const nativeRequests = f.requests.slice(nativeStart);
        add(
          "fetch_Request_body_guard",
          !nativeRequests.some(
            (r) =>
              r.url === "https://collector.invalid/flags/?v=2" &&
              (r.body || "").includes("PwdZ9x7"),
          ),
          nativeRequests,
        );
        add(
          "config_endpoint_body_guard",
          !nativeRequests.some(
            (r) =>
              r.url === "https://collector.invalid/config" && (r.body || "").includes("PwdZ9x7"),
          ),
          nativeRequests,
        );
        add(
          "request_URL_guard",
          !nativeRequests.some((r) => r.url.includes("code=AuthZ9x7")),
          nativeRequests,
        );
        add(
          "non_analytics_fetch_unchanged",
          nativeRequests.some(
            (r) =>
              r.url === "https://qa.invalid/api/capture/submit" &&
              (r.body || "").includes("PwdZ9x7"),
          ),
          nativeRequests,
        );
        add(
          "real_sdk_uncompressed_beacon_reaches_network",
          captureRequests(nativeRequests).some((r) =>
            (r.body || "").includes("c3_beacon_permitted"),
          ),
          native,
        );
        sessions.push({
          name: "uncompressed SDK and transport boundaries",
          requests: f.requests,
          events: await f.page.evaluate(() => events),
        });
        await f.ctx.close();
      }
      const record = { label, tests, sessions };
      out[label] = record;
      fs.writeFileSync(
        path.join(root, label + "-independent-network.json"),
        JSON.stringify(record, null, 2).replaceAll(KEY, "[synthetic-project-key]"),
      );
      console.log(
        label,
        tests.filter((t) => t.pass).length + "/" + tests.length,
        tests
          .filter((t) => !t.pass)
          .map((t) => t.name)
          .join(", "),
      );
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(
    path.join(root, "independent-network-summary.json"),
    JSON.stringify(
      Object.fromEntries(
        Object.entries(out).map(([l, r]) => [l, r.tests.map(({ name, pass }) => ({ name, pass }))]),
      ),
      null,
      2,
    ),
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
