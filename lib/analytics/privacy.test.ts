import assert from "node:assert/strict";
import test from "node:test";
import { isReplayEvent, sanitizeAnalyticsUrl, sanitizeCaptureResult, stripElementsChainText } from "./privacy.ts";
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
