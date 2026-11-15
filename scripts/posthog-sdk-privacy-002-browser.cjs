// Reproducible browser regression for POSTHOG-SDK-PRIVACY-002.
// The unmodified C3 harness calls sdk.on immediately after getPosthogBrowser().
// A fail-closed activation gate makes that client null, so the key-only check
// has to run in its own bundle. The other 25 checks use an explicit activation latch.
// All network requests stay offline. No production key is used.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const modules = process.env.POSTHOG_SDK_QA_MODULES || path.join(root, 'node_modules');
if (!fs.existsSync(path.join(modules, 'esbuild')) || !fs.existsSync(path.join(modules, 'playwright')) || !fs.existsSync(path.join(modules, 'posthog-js'))) {
  console.error('Set POSTHOG_SDK_QA_MODULES to a node_modules with esbuild, playwright, and posthog-js.');
  process.exit(1);
}
const esbuild = require(path.join(modules, 'esbuild'));
const { chromium } = require(path.join(modules, 'playwright'));

function hubLabel(dirName) {
  const name = dirName.toLowerCase();
  if (name.includes('insurance')) return 'insurance';
  if (name.includes('lender')) return 'lender';
  if (name.includes('investor')) return 'investor';
  if (name.includes('senior') || name.includes('care')) return 'senior';
  return 'contractor';
}
const all = [[hubLabel(path.basename(root)), root]];

function analyticsDir(root) {
  for (const rel of ['lib/analytics', 'apps/web/src/lib/analytics']) {
    if (fs.existsSync(path.join(root, rel, 'posthog-browser.ts'))) return path.join(root, rel);
  }
  throw new Error('analytics dir missing ' + root);
}

function pageviewUrl(label) {
  if (label === 'insurance' || label === 'senior') return 'https://qa.invalid/search?auth_code=123456';
  if (label === 'lender') return 'https://qa.invalid/search?redirect_uri=https%3A%2F%2Ftarget.invalid%2F%3Fcode%3D123456';
  return 'https://qa.invalid/search?state=qa%40example.invalid';
}

async function bundle(root, dir, activation, key, debug = '') {
  const code = `import * as env from ${JSON.stringify(dir + '/environment.ts')}; import * as privacy from ${JSON.stringify(dir + '/privacy.ts')}; import * as client from ${JSON.stringify(dir + '/posthog-browser.ts')}; import * as capture from ${JSON.stringify(dir + '/trusthub.ts')}; window.qa={env,privacy,client,capture};`;
  const build = await esbuild.build({
    stdin: { contents: code, resolveDir: root },
    nodePaths: [modules],
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    logLevel: 'silent',
    define: {
      'process.env.NEXT_PUBLIC_POSTHOG_KEY': JSON.stringify(key),
      'process.env.NEXT_PUBLIC_POSTHOG_HOST': '"https://collector.invalid"',
      'process.env.NEXT_PUBLIC_POSTHOG_DEBUG': JSON.stringify(debug),
      'process.env.NEXT_PUBLIC_POSTHOG_ACTIVATION': JSON.stringify(activation),
      'process.env.VERCEL_ENV': '"production"',
      'process.env.NEXT_PUBLIC_VERCEL_ENV': '"production"',
      'process.env.NODE_ENV': '"production"',
    },
  });
  return build.outputFiles[0].text;
}

async function fixture(browser, script, signals = {}, url = 'https://qa.invalid/search?q=PRIVATE_QUERY&code=123456&email=qa%40example.invalid&state=FL') {
  const context = await browser.newContext({ userAgent: 'Mozilla/5.0 Windows NT 10.0 Chrome/130.0.0.0 Safari/537.36' });
  const requests = [];
  await context.route('**/*', async (route) => {
    const request = route.request();
    if (request.isNavigationRequest()) {
      return route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<html data-analytics-environment="production"><head><title>PRIVATE_QUERY</title></head><body><button id="safe" data-note="PRIVATE_NOTE">PRIVATE_LABEL</button><input value="PRIVATE_INPUT"><div class="ph-no-capture"><button id="private">PRIVATE_NOTE</button></div></body></html>',
      });
    }
    requests.push({ url: request.url(), method: request.method(), body: request.postData() });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ featureFlags: {}, featureFlagPayloads: {}, sessionRecording: false, autocapture_opt_out: false, supportedCompression: [] }),
    });
  });
  await context.addInitScript((signals) => {
    for (const [key, value] of Object.entries({ webdriver: false, doNotTrack: '0', globalPrivacyControl: false, cookieEnabled: true, ...signals })) {
      Object.defineProperty(navigator, key, { get: () => value, configurable: true });
    }
  }, signals);
  const page = await context.newPage();
  await page.goto(url);
  await page.addScriptTag({ content: script });
  return { context, page, requests };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const summary = {};
  let failed = 0;
  try {
    for (const [label, root] of all) {
      const dir = analyticsDir(root);
      const tests = [];
      const add = (name, pass, observed) => {
        tests.push({ name, pass });
        if (!pass) {
          failed += 1;
          const text = JSON.stringify(observed);
          console.log('FAIL', label, name, text.length > 1200 ? text.slice(0, 1200) : text);
        }
      };
      const absent = await bundle(root, dir, 'enabled', '');
      const keyedOff = await bundle(root, dir, '', 'phc_C3_SYNTHETIC_OFFLINE_ONLY');
      const keyed = await bundle(root, dir, 'enabled', 'phc_C3_SYNTHETIC_OFFLINE_ONLY');
      const debug = await bundle(root, dir, 'enabled', 'phc_C3_SYNTHETIC_OFFLINE_ONLY', 'true');
      for (const [name, script, signals] of [
        ['missing_key', absent, {}],
        ['dnt_1', keyed, { doNotTrack: '1' }],
        ['dnt_yes', keyed, { doNotTrack: 'yes' }],
        ['gpc', keyed, { globalPrivacyControl: true }],
        ['cookies_off', keyed, { cookieEnabled: false }],
        ['debug_dnt', debug, { doNotTrack: '1' }],
        ['debug_gpc', debug, { globalPrivacyControl: true }],
        ['debug_cookies_off', debug, { cookieEnabled: false }],
      ]) {
        const f = await fixture(browser, script, signals);
        const output = await f.page.evaluate(async () => {
          const client = await qa.client.getPosthogBrowser();
          qa.capture.captureTrustEvent('search_submitted', { surface: 'ask', success: true });
          await new Promise((r) => setTimeout(r, 30));
          return { enabled: qa.env.shouldEnablePosthog(), client: !!client, cookies: document.cookie, storage: Object.keys(localStorage) };
        });
        add(name, !output.client && !output.enabled && f.requests.length === 0, { ...output, requests: f.requests.length });
        await f.context.close();
      }
      const off = await fixture(browser, keyedOff);
      const offResult = await off.page.evaluate(async () => {
        const client = await qa.client.getPosthogBrowser();
        qa.capture.captureTrustEvent('search_submitted', { surface: 'ask', success: true });
        await new Promise((r) => setTimeout(r, 50));
        return { enabled: qa.env.shouldEnablePosthog(), client: !!client };
      });
      add('existing_key_alone_must_not_activate', !offResult.client && !offResult.enabled && off.requests.length === 0, { ...offResult, requests: off.requests.map((q) => q.url) });
      await off.context.close();

      const f = await fixture(browser, keyed);
      const init = await f.page.evaluate(async () => {
        window.events = [];
        window.sdk = await qa.client.getPosthogBrowser();
        sdk.on('eventCaptured', (e) => events.push(JSON.parse(JSON.stringify(e))));
        sdk.set_config({ disable_compression: true, request_batching: false, opt_out_useragent_filter: true });
        const c = sdk.config;
        return {
          enabled: qa.env.shouldEnablePosthog(),
          initialized: !!sdk,
          settings: Object.fromEntries(['capture_exceptions', 'disable_session_recording', 'enable_heatmaps', 'capture_heatmaps', 'capture_dead_clicks', 'mask_all_text', 'respect_dnt', 'persistence'].map((k) => [k, c[k]])),
        };
      });
      add('privacy_sdk_settings', init.settings.capture_exceptions === false && init.settings.disable_session_recording === true && init.settings.enable_heatmaps === false && init.settings.capture_heatmaps === false && init.settings.capture_dead_clicks === false && init.settings.mask_all_text === true, init.settings);
      for (const event of ['$exception', '$snapshot', '$snapshot_items', '$heatmap', '$$heatmap']) {
        const out = await f.page.evaluate((event) => {
          const n = events.length;
          const result = sdk.capture(event, { private: 'PRIVATE_NOTE' }, { send_instantly: true });
          return { returned: result ?? null, captured: events.length - n };
        }, event);
        add('drop_' + event, out.captured === 0, out);
      }
      const sanitized = await f.page.evaluate(() => {
        sdk.capture('c3_payload_probe', { email: 'qa@example.invalid', otp: '654321', password: 'PRIVATE_PASSWORD', notes: 'PRIVATE_NOTE', $el_text: 'PRIVATE_LABEL', $current_url: location.href, $referrer: 'https://ref.invalid/?code=123456&q=PRIVATE_QUERY', $set: { email: 'qa@example.invalid', notes: 'PRIVATE_NOTE' }, $ip: '192.0.2.1', $exception_message: 'PRIVATE_EXCEPTION' }, { send_instantly: true });
        return events.at(-1);
      });
      if (!sanitized) {
        const debugState = await f.page.evaluate(() => ({ loaded: sdk.__loaded, optedOut: sdk.has_opted_out_capturing(), ua: navigator.userAgent, dnt: navigator.doNotTrack, config: sdk.config.token, disabled: sdk.config.opt_out_capturing_by_default, bot: sdk._is_bot() }));
        throw new Error(label + ' no captured event: ' + JSON.stringify(debugState));
      }
      add('standard_sensitive_fields', !JSON.stringify(sanitized).match(/qa@example|PRIVATE_|123456|654321|192\.0\.2\.1/), sanitized);
      add('geoip_flag_boolean', sanitized.properties.$geoip_disable === true, { value: sanitized.properties.$geoip_disable, type: typeof sanitized.properties.$geoip_disable });
      const short = await f.page.evaluate(() => qa.privacy.sanitizeAnalyticsUrl('https://qa.invalid/auth/callback?code=123456&state=FL'));
      add('short_auth_code_url', !short.includes('123456'), short);
      const propCode = await f.page.evaluate(() => {
        sdk.capture('c3_auth_probe', { code: '123456', auth_code: '654321' }, { send_instantly: true });
        return events.at(-1);
      });
      add('auth_code_event_properties', !JSON.stringify(propCode).match(/123456|654321/), propCode);
      const links = await f.page.evaluate(() => {
        const urls = ['https://qa.invalid/?state=qa%40example.invalid', 'https://qa.invalid/?custom=qa%40example.invalid', 'https://qa.invalid/?auth_code=123456', 'https://qa.invalid/?redirect_uri=https%3A%2F%2Ftarget.invalid%2F%3Fcode%3D123456', 'https://qa.invalid/search/qa%40example.invalid'];
        return urls.map((input) => ({ input, output: qa.privacy.sanitizeAnalyticsUrl(input) }));
      });
      add('adversarial_sensitive_urls', links.every((x) => !decodeURIComponent(x.output || '').match(/qa@example|123456/)), links);
      const urlProbe = await f.page.evaluate((bad) => {
        sdk.capture('$pageview', { $current_url: bad, $pathname: '/search' }, { send_instantly: true });
        return events.at(-1);
      }, pageviewUrl(label));
      add('sdk_pageview_sensitive_url', !decodeURIComponent(JSON.stringify(urlProbe)).match(/qa@example|123456/), urlProbe);
      const n = await f.page.evaluate(() => events.length);
      await f.page.locator('#safe').click();
      const auto = await f.page.evaluate((n) => events.slice(n), n);
      add('autocapture_private_text', auto.some((x) => x.event === '$autocapture') && !JSON.stringify(auto).includes('PRIVATE_'), auto);
      const beforePrivate = await f.page.evaluate(() => events.length);
      await f.page.locator('#private').click();
      add('ph_no_capture', await f.page.evaluate((n) => events.length === n, beforePrivate), {});
      const transition = await f.page.evaluate(async () => {
        Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true, configurable: true });
        const n = events.length;
        qa.capture.captureTrustEvent('c3_disabled_helper', { surface: 'ask', success: true });
        await new Promise((r) => setTimeout(r, 30));
        return { helperEvents: events.length - n, enabled: qa.env.shouldEnablePosthog() };
      });
      add('gpc_after_init_helper', transition.helperEvents === 0 && !transition.enabled, transition);
      const n2 = await f.page.evaluate(() => events.length);
      await f.page.locator('#safe').click();
      const postGpc = await f.page.evaluate((n) => events.slice(n), n2);
      add('gpc_after_init_autocapture', postGpc.length === 0, postGpc);
      await f.page.waitForTimeout(200);
      const flags = f.requests.filter((q) => q.url.includes('/flags/'));
      const related = f.requests.filter((q) => /\/flags\/|\/array\/|\/config|\/decide|\/e\/|\/capture|\/batch/i.test(q.url));
      const leaked = /PRIVATE_QUERY|qa%40example|qa@example|123456|PRIVATE_NOTE/.test(JSON.stringify(related));
      add('flags_requests_sanitized', flags.length > 0 && !leaked, { flagCount: flags.length, related: related.map((q) => ({ url: q.url, body: (q.body || '').slice(0, 500) })) });
      summary[label] = tests.filter((x) => x.pass).length + '/' + tests.length;
      console.log(label, summary[label], tests.filter((x) => !x.pass).map((x) => x.name).join(', '));
      await f.context.close();
    }
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify(summary));
  if (failed) process.exit(1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
