import assert from "node:assert/strict";
import test from "node:test";
import {
  isReplayEvent,
  sanitizeAnalyticsUrl,
  sanitizeCaptureResult,
  stripElementsChainText,
  suppressExceptionCapture,
} from "./privacy.ts";
import { analyticsBrowserOptOut } from "./environment.ts";
import { readFileSync } from "node:fs";

const PAGE =
  "https://www.contractortrusthub.com/search?q=roofers+in+broward&query=secret+question&page=2&state=fl&trade=roofing";

test("URL sanitizer strips q and other free-text query params", () => {
  const cleaned = sanitizeAnalyticsUrl(PAGE);
  assert.equal(
    cleaned,
    "https://www.contractortrusthub.com/search?page=2&state=fl&trade=roofing",
  );
  assert.doesNotMatch(cleaned || "", /roofers|secret|question|broward/i);
});

test("URL sanitizer strips q from referrer and session entry URLs and keeps the path", () => {
  assert.equal(
    sanitizeAnalyticsUrl("https://www.google.com/search?q=leaked+contractor&utm_source=google"),
    "https://www.google.com/search?utm_source=google",
  );
  assert.equal(
    sanitizeAnalyticsUrl("https://www.contractortrusthub.com/ask?q=my+license+question&trade=roofing#fragment"),
    "https://www.contractortrusthub.com/ask?trade=roofing",
  );
  assert.equal(
    sanitizeAnalyticsUrl("https://user:secret@www.contractortrusthub.com/verify?q=acme&state=tx"),
    "https://www.contractortrusthub.com/verify?state=tx",
  );
});

test("before_send sanitizes $current_url, $session_entry_url, $referrer and $pathname", () => {
  const event = sanitizeCaptureResult({
    uuid: "00000000-0000-4000-8000-000000000001",
    event: "$pageview",
    properties: {
      token: "phc_test_token",
      distinct_id: "anonymous-device",
      $current_url: PAGE,
      $session_entry_url: "https://www.contractortrusthub.com/verify?q=private+search&state=nj",
      $referrer: "https://www.google.com/search?q=leaked&hl=en",
      $pathname: "/ask?q=do+not+send+this&page=3",
      $title: "Ask: do not send this",
      query: "do not send this",
    },
  });

  assert.ok(event);
  assert.equal(event.properties?.token, "phc_test_token");
  assert.equal(event.properties?.distinct_id, "anonymous-device");
  assert.equal(
    event.properties?.$current_url,
    "https://www.contractortrusthub.com/search?page=2&state=fl&trade=roofing",
  );
  assert.equal(
    event.properties?.$session_entry_url,
    "https://www.contractortrusthub.com/verify?state=nj",
  );
  assert.equal(event.properties?.$referrer, "https://www.google.com/search?hl=en");
  assert.equal(event.properties?.$pathname, "/ask?page=3");
  assert.equal(event.properties?.$title, "Contractor Trust Hub");
  assert.equal(event.properties?.query, undefined);
  const serialized = JSON.stringify(event);
  assert.doesNotMatch(serialized, /roofers|private\+search|do\+not\+send|leaked/i);
});

test("URL sanitizer never throws and does not return a raw unparsed query", () => {
  assert.doesNotThrow(() => sanitizeAnalyticsUrl("%%%%"));
  assert.equal(sanitizeAnalyticsUrl(""), undefined);
  assert.equal(sanitizeAnalyticsUrl(null), undefined);
  assert.equal(sanitizeCaptureResult(null), null);
});

test("autocapture of a recent-research button never carries the raw question", () => {
  const raw = "roofers in broward who lied about insurance";
  const event = sanitizeCaptureResult({
    uuid: "00000000-0000-4000-8000-000000000002",
    event: "$autocapture",
    properties: {
      token: "phc_test_token",
      $current_url: "https://www.contractortrusthub.com/ask?q=roofers+in+broward",
      $el_text: raw,
      $elements_chain: `button.text-xs:text="${raw}"nth-child="1"nth-of-type="1";li:nth-child="1";ul.mt-2:attr__aria-label="${raw}"nth-child="2"`,
      $elements: [
        { tag_name: "button", $el_text: raw, text: raw, "attr__aria-label": raw, attr__title: raw, attr__class: "text-xs" },
        { tag_name: "a", attr__href: "/ask?q=roofers+in+broward&state=fl", href: "/ask?q=roofers+in+broward&state=fl" },
      ],
    },
  });
  assert.ok(event);
  assert.equal(event.properties?.$el_text, undefined);
  const elements = event.properties?.$elements as Array<Record<string, unknown>>;
  assert.equal(elements[0].$el_text, undefined);
  assert.equal(elements[0].text, undefined);
  assert.equal(elements[0]["attr__aria-label"], undefined);
  assert.equal(elements[0].attr__class, "text-xs");
  const serialized = JSON.stringify(event);
  assert.doesNotMatch(serialized, /roofers|broward|lied|insurance/i);
  assert.match(String(event.properties?.$elements_chain), /^button\.text-xs:nth-child="1"/);
});

test("elements chain text stripping keeps structure and handles escaped quotes", () => {
  assert.equal(
    stripElementsChainText('a.cls:attr__href="/x"text="say \\"hi\\" q"nth-child="2";div:text="secret"'),
    'a.cls:attr__href="/x"nth-child="2";div:',
  );
});

test("custom search events carry no raw search text", () => {
  const event = sanitizeCaptureResult({
    uuid: "00000000-0000-4000-8000-000000000003",
    event: "search_submitted",
    properties: {
      token: "phc_test_token",
      hub: "contractor",
      surface: "ask",
      state: "FL",
      q: "private question",
      query: "private question",
      search: "private question",
      prompt: "private question",
      $current_url: "https://www.contractortrusthub.com/search?search=private+question&term=x&state=fl",
    },
  });
  assert.ok(event);
  assert.doesNotMatch(JSON.stringify(event), /private/i);
  assert.equal(event.properties?.surface, "ask");
});

test("session replay payloads are recognized so before_send drops them", () => {
  assert.equal(isReplayEvent("$snapshot"), true);
  assert.equal(isReplayEvent("$pageview"), false);
  assert.equal(isReplayEvent(undefined), false);
});

test("browser client disables session replay and autocapture element text", () => {
  const source = readFileSync(new URL("./posthog-browser.ts", import.meta.url), "utf8");
  assert.match(source, /disable_session_recording:\s*true/);
  assert.match(source, /mask_all_text:\s*true/);
  assert.match(source, /maskAllInputs:\s*true/);
  assert.match(source, /isReplayEvent\(event\.event\)\) return null/);
  const askForm = readFileSync(new URL("../../components/ask/AskForm.tsx", import.meta.url), "utf8");
  assert.match(askForm, /className="ph-no-capture"/);
});

test("no $exception events are sent", () => {
  const dropped = suppressExceptionCapture({
    event: "$exception",
    properties: {
      $exception_list: [{ type: "Error", value: "roofers in broward" }],
      $exception_message: "roofers in broward",
    },
  });
  assert.equal(dropped, null);

  const pageview = suppressExceptionCapture({
    event: "$pageview",
    properties: { $pathname: "/privacy", $exception_list: [{ type: "Error" }] },
  });
  assert.equal(pageview?.event, "$pageview");
  assert.equal(pageview?.properties && "$exception_list" in pageview.properties, false);

  const source = readFileSync(new URL("./posthog-browser.ts", import.meta.url), "utf8");
  assert.match(source, /capture_exceptions:\s*false/);
  assert.match(source, /suppressExceptionCapture\(event\)/);
  assert.match(source, /respect_dnt:\s*true/);
  assert.match(source, /capture_copied_text:\s*false/);
  assert.match(source, /capture_value_css_selector_allowlist:\s*\[\]/);
  assert.match(source, /disable_session_recording:\s*true/);
});

test("Do Not Track or blocked cookies opt out of analytics", () => {
  const previous = globalThis.navigator;
  try {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { doNotTrack: "1", cookieEnabled: true },
    });
    assert.equal(analyticsBrowserOptOut(), true);
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { doNotTrack: "0", cookieEnabled: false },
    });
    assert.equal(analyticsBrowserOptOut(), true);
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { doNotTrack: "0", cookieEnabled: true },
    });
    assert.equal(analyticsBrowserOptOut(), false);
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { doNotTrack: "0", cookieEnabled: true, globalPrivacyControl: true },
    });
    assert.equal(analyticsBrowserOptOut(), true);
  } finally {
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: previous });
  }
});

test("identify, pageview, and custom event payloads drop email, search, and auth fields", () => {
  const secret = "roofers in broward";
  const email = "person@example.com";
  const identify = sanitizeCaptureResult({
    event: "$identify",
    properties: {
      distinct_id: email,
      email,
      $email: email,
      password: "hunter2-secret",
      access_token: "auth-secret-value",
      otp: "998877",
      q: secret,
      search: secret,
      $ip: "203.0.113.10",
      $current_url: `https://www.contractortrusthub.com/search?q=${encodeURIComponent(secret)}&access_token=abc&email=${encodeURIComponent(email)}&state=FL`,
      $set: { email, name: "Pat Example", search: secret },
    },
    $set: { email, password: "hunter2-secret", search: secret },
  });
  const identifyJson = JSON.stringify(identify);
  assert.equal(identifyJson.includes(email), false);
  assert.equal(identifyJson.includes(secret), false);
  assert.equal(identifyJson.includes("hunter2-secret"), false);
  assert.equal(identifyJson.includes("auth-secret-value"), false);
  assert.equal(identifyJson.includes("998877"), false);
  assert.equal(identifyJson.includes("203.0.113.10"), false);
  assert.equal(identify?.properties?.$geoip_disable, true);
  assert.equal(identify?.properties?.$ip, undefined);
  assert.match(String(identify?.properties?.$current_url), /state=FL/);
  assert.equal(String(identify?.properties?.$current_url).includes("q="), false);

  const pageview = sanitizeCaptureResult(
    suppressExceptionCapture({
      event: "$pageview",
      properties: {
        $current_url: `https://www.contractortrusthub.com/search?q=${encodeURIComponent(secret)}&email=${encodeURIComponent(email)}&state=FL`,
        $exception_message: secret,
        $exception_list: [{ type: "Error", value: secret }],
      },
    }),
  );
  const pageJson = JSON.stringify(pageview);
  assert.equal(pageview?.event, "$pageview");
  assert.equal(pageJson.includes(secret), false);
  assert.equal(pageJson.includes(email), false);
  assert.equal(pageview?.properties?.$geoip_disable, true);

  const custom = sanitizeCaptureResult({
    event: "search_submitted",
    properties: {
      surface: "ask_form",
      success: true,
      stateCode: "FL",
      query: secret,
      email,
      password: "hunter2-secret",
    },
  });
  assert.equal(custom?.properties?.surface, "ask_form");
  assert.equal(custom?.properties?.success, true);
  assert.equal(custom?.properties?.stateCode, "FL");
  const customJson = JSON.stringify(custom);
  assert.equal(customJson.includes(secret), false);
  assert.equal(customJson.includes(email), false);
  assert.equal(customJson.includes("hunter2-secret"), false);
});
