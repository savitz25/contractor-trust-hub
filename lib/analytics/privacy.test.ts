import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeAnalyticsUrl, sanitizeCaptureResult } from "./privacy.ts";

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
