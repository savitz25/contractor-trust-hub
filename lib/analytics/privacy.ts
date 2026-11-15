/**
 * Contractor Trust Hub analytics privacy.
 * Raw search text never leaves the browser. PostHog reserved ingest fields stay intact:
 * stripping `token` makes posthog-js drop the event.
 */

export const FREE_TEXT_QUERY_KEYS = [
  "q",
  "query",
  "question",
  "search",
  "term",
  "terms",
  "text",
  "keyword",
  "keywords",
  "prompt",
  "message",
  "note",
  "notes",
  "body",
  "name",
] as const;

export const SENSITIVE_QUERY_KEYS = [
  ...FREE_TEXT_QUERY_KEYS,
  "email",
  "token",
  "code",
  "password",
  "access_token",
  "refresh_token",
  "session",
  "otp",
  "auth_error",
  "error",
  "error_code",
  "error_description",
  "error_uri",
  "handoff",
] as const;

const SENSITIVE_QUERY_KEY_PATTERN = /token|email|code|password|note|error|handoff|secret|otp/i;

export function isSensitiveQueryKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return (
    (SENSITIVE_QUERY_KEYS as readonly string[]).includes(normalized) ||
    SENSITIVE_QUERY_KEY_PATTERN.test(key)
  );
}

export const FORBIDDEN_EVENT_KEYS = [
  "q",
  "query",
  "question",
  "email",
  "name",
  "first_name",
  "last_name",
  "phone",
  "address",
  "ssn",
  "password",
  "token",
  "authorization",
  "cookie",
  "note",
  "notes",
  "body",
  "message",
  "href",
  "url",
  "search",
  "prompt",
  "keyword",
  "keywords",
  "auth_error",
  "error",
  "error_message",
  "error_description",
  "handoff",
  "input_value",
  "$input_value",
] as const;

/** SDK/ingest fields. Stripping `token` makes posthog-js drop the event. */
export const POSTHOG_RESERVED_KEYS = [
  "token",
  "distinct_id",
  "timestamp",
  "uuid",
  "event",
  "offset",
  "api_key",
] as const;

const PAGE_URL_PROPERTY_KEYS = [
  "$current_url",
  "$referrer",
  "$initial_current_url",
  "$session_entry_url",
  "$entry_current_url",
  "$initial_referrer",
  "$session_entry_referrer",
  "$prev_pageview_url",
] as const;

const SEARCH_SURFACE = /\/(ask|search|verify|credentials)(?:\/|$|\?)/;

const AUTOCAPTURE_URL_KEYS = [
  "$external_click_url",
  "$el_href",
  "attr__href",
  "attr__action",
  "attr__formaction",
  "attr__src",
] as const;

export function isPosthogReservedKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (lower.startsWith("$")) return true;
  return (POSTHOG_RESERVED_KEYS as readonly string[]).includes(lower);
}

export function sanitizeAnalyticsUrl(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw, "https://www.contractortrusthub.com");
    for (const key of [...url.searchParams.keys()]) {
      if (isSensitiveQueryKey(key)) url.searchParams.delete(key);
    }
    url.hash = "";
    url.username = "";
    url.password = "";
    return hardenAnalyticsUrl(`${url.origin}${url.pathname}${url.search}`);
  } catch {
    return undefined;
  }
}

export function sanitizeAnalyticsPathname(raw: string): string {
  const value = raw.split("#")[0] || "/";
  if (!value.includes("?") && !value.includes("://")) return value || "/";
  const cleaned = sanitizeAnalyticsUrl(value.startsWith("/") ? value : value);
  if (!cleaned) return value.split("?")[0] || "/";
  try {
    const url = new URL(cleaned);
    return `${url.pathname}${url.search}`;
  } catch {
    return value.split("?")[0] || "/";
  }
}

export function redactSensitiveParamsInText(text: string): string {
  return text.replace(/([?&]|&amp;)([^=&;"'\s]+)=([^&;"'\s]*)/g, (match, lead: string, key: string) => {
    let decoded = key;
    try {
      decoded = decodeURIComponent(key);
    } catch {
      /* keep the raw parameter name */
    }
    return isSensitiveQueryKey(decoded) ? `${lead}${key}=[redacted]` : match;
  });
}

export function sanitizeCapturedNetworkRequest<T extends { name?: string }>(request: T): T {
  if (typeof request.name === "string") {
    request.name = sanitizeAnalyticsUrl(request.name) ?? request.name.replace(/\?[^#]*/, "");
  }
  return request;
}

function sanitizeUrlProperties(target: Record<string, unknown>): void {
  for (const key of PAGE_URL_PROPERTY_KEYS) {
    if (typeof target[key] === "string") target[key] = sanitizeAnalyticsUrl(target[key] as string);
  }
  if (typeof target.$pathname === "string") {
    target.$pathname = sanitizeAnalyticsPathname(target.$pathname);
  }
}

function sanitizeAutocaptureUrls(properties: Record<string, unknown>): void {
  for (const key of AUTOCAPTURE_URL_KEYS) {
    if (typeof properties[key] === "string") {
      properties[key] = sanitizeAnalyticsUrl(properties[key] as string) ?? "[redacted]";
    }
  }
  if (typeof properties.$elements_chain === "string") {
    properties.$elements_chain = redactSensitiveParamsInText(properties.$elements_chain);
  }
  if (Array.isArray(properties.$elements)) {
    for (const element of properties.$elements) {
      if (!element || typeof element !== "object") continue;
      const record = element as Record<string, unknown>;
      for (const key of AUTOCAPTURE_URL_KEYS) {
        if (typeof record[key] === "string") {
          record[key] = sanitizeAnalyticsUrl(record[key] as string) ?? "[redacted]";
        }
      }
      if (typeof record.href === "string") record.href = sanitizeAnalyticsUrl(record.href) ?? "[redacted]";
    }
  }
}

/** Autocapture element fields that can echo user-entered text (labels, values, tooltips). */
const AUTOCAPTURE_TEXT_KEYS = [
  "$el_text",
  "text",
  "attr__aria-label",
  "attr__title",
  "attr__value",
  "attr__placeholder",
  "attr__alt",
] as const;

const ELEMENTS_CHAIN_TEXT_PATTERN = /(?:^|(?<=[:"]))(?:text|attr__aria-label|attr__title|attr__value|attr__placeholder|attr__alt)="(?:[^"\\]|\\.)*"/g;

/** Session replay events. Replay is disabled for this hub; before_send drops these. */
export const REPLAY_EVENT_NAMES = ["$snapshot", "$snapshot_items", "$heatmap", "$$heatmap"] as const;

export function isReplayEvent(event: string | undefined | null): boolean {
  return typeof event === "string" && (REPLAY_EVENT_NAMES as readonly string[]).includes(event);
}

export function stripElementsChainText(chain: string): string {
  return chain.replace(ELEMENTS_CHAIN_TEXT_PATTERN, "");
}

function stripAutocaptureText(properties: Record<string, unknown>): void {
  scrubPrivateElementAttributes(properties);
  delete properties.$el_text;
  if (typeof properties.$elements_chain === "string") {
    properties.$elements_chain = stripElementsChainText(properties.$elements_chain);
  }
  if (Array.isArray(properties.$elements)) {
    for (const element of properties.$elements) {
      if (!element || typeof element !== "object") continue;
      const record = element as Record<string, unknown>;
      for (const key of AUTOCAPTURE_TEXT_KEYS) delete record[key];
    }
  }
}

function sanitizeReplaySnapshotHrefs(node: unknown, depth = 0): void {
  if (depth > 8 || node == null || typeof node === "string") return;
  if (Array.isArray(node)) {
    for (const item of node) sanitizeReplaySnapshotHrefs(item, depth + 1);
    return;
  }
  if (typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  if (typeof obj.href === "string") {
    const cleaned = sanitizeAnalyticsUrl(obj.href);
    if (cleaned) obj.href = cleaned;
  }
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") sanitizeReplaySnapshotHrefs(value, depth + 1);
  }
}

function replaceSearchSurfaceTitle(properties: Record<string, unknown>): void {
  const path = `${properties.$pathname || ""} ${properties.$current_url || ""}`;
  if (!SEARCH_SURFACE.test(path)) return;
  properties.$title = "Contractor Trust Hub";
  properties.title = "Contractor Trust Hub";
  properties.$document_title = "Contractor Trust Hub";
}

export function sanitizePageviewProperties(properties: Record<string, unknown>): Record<string, unknown> {
  sanitizeUrlProperties(properties);
  for (const bag of ["$set", "$set_once"]) {
    const nested = properties[bag];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      sanitizeUrlProperties(nested as Record<string, unknown>);
    }
  }
  delete properties.$input_value;
  delete properties.input_value;
  sanitizeReplaySnapshotHrefs(properties.$snapshot_data);
  stripAutocaptureText(properties);
  sanitizeAutocaptureUrls(properties);
  replaceSearchSurfaceTitle(properties);
  for (const key of Object.keys(properties)) {
    if (isPosthogReservedKey(key)) continue;
    if ((FORBIDDEN_EVENT_KEYS as readonly string[]).includes(key.toLowerCase())) delete properties[key];
  }
  return properties;
}

const EXTRA_IDENTITY_KEYS = [
  "otp",
  "secret",
  "access_token",
  "refresh_token",
  "id_token",
  "session",
  "credential",
  "credentials",
] as const;

function nestedPropertyBag(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Drops emails, search text, sign-in fields, and auth-shaped keys from one property bag. */
function scrubIdentityProperties(bag: Record<string, unknown>): void {
  sanitizeUrlProperties(bag);
  for (const key of Object.keys(bag)) {
    if (isPosthogReservedKey(key)) continue;
    if (isSensitiveAnalyticsPropertyKey(key)) {
      delete bag[key];
      continue;
    }
    const lower = key.toLowerCase();
    if ((FORBIDDEN_EVENT_KEYS as readonly string[]).includes(lower)) {
      delete bag[key];
      continue;
    }
    if ((EXTRA_IDENTITY_KEYS as readonly string[]).includes(lower)) {
      delete bag[key];
      continue;
    }
    if (/email|password|token|ssn|phone|secret|otp|authorization|cookie/.test(lower)) {
      delete bag[key];
      continue;
    }
    const value = bag[key];
    if (typeof value === "string" && value.includes("@")) delete bag[key];
  }
  for (const key of ["distinct_id", "email", "$email"]) {
    const value = bag[key];
    if (typeof value === "string" && value.includes("@")) delete bag[key];
  }
}

/**
 * Last pass for identify, capture, pageview, and custom events.
 * Clears a client-supplied network address and asks PostHog not to add a location.
 * PostHog can still see the request address. Storage of that address is a project setting.
 */
function finishPrivacyPayload(event: {
  properties?: Record<string, unknown>;
  $set?: Record<string, unknown>;
  $set_once?: Record<string, unknown>;
}): void {
  if (event.properties) {
    scrubIdentityProperties(event.properties);
    const set = nestedPropertyBag(event.properties.$set);
    const once = nestedPropertyBag(event.properties.$set_once);
    if (set) scrubIdentityProperties(set);
    if (once) scrubIdentityProperties(once);
    for (const key of Object.keys(event.properties)) {
      if (key === "$ip" || key.startsWith("$exception")) delete event.properties[key];
    }
    event.properties.$geoip_disable = true;
  }
  if (event.$set) scrubIdentityProperties(event.$set);
  if (event.$set_once) scrubIdentityProperties(event.$set_once);
}

/** `$exception` autocapture is never sent. Exception properties are removed from every event. */
export function suppressExceptionCapture<
  T extends { event?: string; properties?: Record<string, unknown> } | null,
>(event: T): T | null {
  if (!event) return event;
  if (event.properties) {
    for (const key of Object.keys(event.properties)) {
      if (key.startsWith("$exception")) delete event.properties[key];
    }
  }
  if (event.event === "$exception") return null;
  return event;
}

export function sanitizeCaptureResult<
  T extends {
    properties?: Record<string, unknown>;
    $set?: Record<string, unknown>;
    $set_once?: Record<string, unknown>;
  } | null,
>(event: T): T {
  if (!event) return event;
  if (event.properties) sanitizePageviewProperties(event.properties);
  finishPrivacyPayload(event);
  return event;
}

const SAFE_TOKEN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,80}$/;

export function stateCode(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : undefined;
}

export function safeSlug(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const slug = value.trim();
  return /^[a-z0-9][a-z0-9-]{0,120}$/i.test(slug) ? slug : undefined;
}

export function stripForbiddenProperties(
  props: Record<string, unknown> | undefined,
): Record<string, string | number | boolean> {
  const cleaned: Record<string, string | number | boolean> = {};
  if (!props) return cleaned;
  for (const [key, value] of Object.entries(props)) {
    const lower = key.toLowerCase();
    if ((FORBIDDEN_EVENT_KEYS as readonly string[]).includes(lower)) continue;
    if (/email|password|token|ssn|phone|query|question/.test(lower) && !lower.startsWith("$")) continue;
    if (value === null || value === undefined) continue;
    if (typeof value === "number") {
      if (Number.isFinite(value)) cleaned[key] = value;
      continue;
    }
    if (typeof value === "boolean") {
      cleaned[key] = value;
      continue;
    }
    if (typeof value !== "string") continue;
    if (key.startsWith("$")) {
      cleaned[key] = key === "$pathname" ? sanitizeAnalyticsPathname(value) : (sanitizeAnalyticsUrl(value) ?? value.split("?")[0]);
      continue;
    }
    if (SAFE_TOKEN.test(value)) cleaned[key] = value;
  }
  return cleaned;
}


const ANALYTICS_EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

function decodeAnalyticsPart(value: string): string | null {
  let current = value;
  try {
    for (let i = 0; i < 3; i++) {
      const next = decodeURIComponent(current.replace(/\+/g, " "));
      if (next === current) return current;
      current = next;
    }
    return current;
  } catch {
    return null;
  }
}

/** Auth-shaped property names. stateCode, zipCode, countryCode, and areaCode stay. */
export function isSensitiveAnalyticsPropertyKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (lower === "statecode" || lower === "zipcode" || lower === "countrycode" || lower === "areacode") {
    return false;
  }
  if (lower === "code" || lower === "authcode" || /(^|_)code$/.test(lower)) return true;
  return /email|password|token|ssn|phone|secret|otp|authorization|cookie|credential|^notes?$/.test(lower);
}

function queryValueIsUnsafe(value: string): boolean {
  const decoded = decodeAnalyticsPart(value);
  if (decoded == null) return true;
  if (ANALYTICS_EMAIL.test(decoded) || /PRIVATE_/i.test(decoded)) return true;
  return /[?&#](?:code|auth_code|otp|password|access_token|refresh_token|email|q|query|search)=/i.test(decoded);
}

/** Second pass: email-shaped values, nested secrets, path emails, and undecodable text fail closed. */
export function hardenAnalyticsUrl(sanitized: string | undefined): string | undefined {
  if (!sanitized) return undefined;
  let url: URL;
  try {
    url = new URL(sanitized);
  } catch {
    return undefined;
  }
  const kept: string[] = [];
  for (const segment of url.pathname.split("/")) {
    if (segment === "") {
      kept.push("");
      continue;
    }
    const decoded = decodeAnalyticsPart(segment);
    if (decoded == null || ANALYTICS_EMAIL.test(decoded) || /PRIVATE_/i.test(decoded)) continue;
    kept.push(segment);
  }
  const path = kept.join("/") || "/";
  url.pathname = path.startsWith("/") ? path : `/${path}`;
  for (const key of [...url.searchParams.keys()]) {
    const decodedKey = decodeAnalyticsPart(key);
    const values = url.searchParams.getAll(key);
    if (
      decodedKey == null ||
      isSensitiveAnalyticsPropertyKey(decodedKey) ||
      values.some((value) => queryValueIsUnsafe(value))
    ) {
      url.searchParams.delete(key);
    }
  }
  url.hash = "";
  url.username = "";
  url.password = "";
  const href = `${url.origin}${url.pathname}${url.search}`;
  const decodedHref = decodeAnalyticsPart(href);
  if (
    decodedHref == null ||
    ANALYTICS_EMAIL.test(decodedHref) ||
    /PRIVATE_/i.test(decodedHref) ||
    /[?&](?:code|auth_code)=/i.test(decodedHref)
  ) {
    return `${url.origin}${url.pathname}`;
  }
  return href;
}

function attributeValueIsPrivate(value: string): boolean {
  return /private_|@/i.test(value) || ANALYTICS_EMAIL.test(value);
}

function scrubPrivateElementAttributes(properties: Record<string, unknown>): void {
  if (typeof properties.$elements_chain === "string") {
    properties.$elements_chain = properties.$elements_chain.replace(
      /attr__?[A-Za-z0-9_-]*="(?:[^"\\]|\\.)*"/g,
      (match) => {
        const parsed = /^attr__?([A-Za-z0-9_-]*)="((?:[^"\\]|\\.)*)"$/.exec(match);
        if (!parsed) return "";
        const name = parsed[1].toLowerCase();
        if (name.startsWith("data-") || name === "note" || name === "notes" || attributeValueIsPrivate(parsed[2])) {
          return "";
        }
        return match;
      },
    );
  }
  if (!Array.isArray(properties.$elements)) return;
  for (const element of properties.$elements) {
    if (!element || typeof element !== "object") continue;
    const record = element as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (!key.startsWith("attr")) continue;
      const name = key.replace(/^attr__?/, "").toLowerCase();
      const value = record[key];
      if (name.startsWith("data-") || name === "note" || name === "notes") {
        delete record[key];
        continue;
      }
      if (typeof value === "string" && attributeValueIsPrivate(value)) delete record[key];
    }
  }
}

function analyticsEndpoint(url: string): boolean {
  return /\/(?:flags|decide|e|capture|batch|engage|s)(?:\/|$|\?)|\/i\/v|\/array\//i.test(url);
}

function sanitizeOutboundValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sanitizeOutboundValue(item));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [childKey, child] of Object.entries(value as Record<string, unknown>)) {
      if (
        childKey === "token" ||
        childKey === "api_key" ||
        childKey === "distinct_id" ||
        childKey === "$device_id"
      ) {
        out[childKey] = child;
        continue;
      }
      if (!childKey.startsWith("$") && isSensitiveAnalyticsPropertyKey(childKey)) continue;
      const next = sanitizeOutboundValue(child);
      if (next !== undefined) out[childKey] = next;
    }
    return out;
  }
  if (typeof value === "string") {
    if (value.includes("://") || value.includes("?") || value.startsWith("/")) {
      return hardenAnalyticsUrl(sanitizeAnalyticsUrl(value) || value) || "";
    }
    if (ANALYTICS_EMAIL.test(value) || /PRIVATE_/i.test(value)) return "";
  }
  return value;
}

export function sanitizeAnalyticsRequestBody(body: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  let encoded: string;
  try {
    encoded = JSON.stringify(sanitizeOutboundValue(parsed));
  } catch {
    return null;
  }
  let decoded = encoded;
  try {
    decoded = decodeURIComponent(encoded);
  } catch {
    return null;
  }
  if (/PRIVATE_|qa@example|qa%40example|[?&](?:code|auth_code)=\d+/i.test(decoded)) return null;
  return encoded;
}

function finishBlockedRequest(xhr: XMLHttpRequest): void {
  queueMicrotask(() => {
    try {
      Object.defineProperty(xhr, "readyState", { configurable: true, get: () => 4 });
      Object.defineProperty(xhr, "status", { configurable: true, get: () => 200 });
      Object.defineProperty(xhr, "responseText", { configurable: true, get: () => "{}" });
      Object.defineProperty(xhr, "response", { configurable: true, get: () => "{}" });
      xhr.dispatchEvent(new Event("readystatechange"));
      xhr.dispatchEvent(new Event("load"));
      xhr.dispatchEvent(new Event("loadend"));
    } catch {
      /* The SDK already stopped this request. */
    }
  });
}

let analyticsTransportGuarded = false;

/** Sanitize or drop PostHog flags, config, and capture bodies before they leave the browser. */
export function installAnalyticsTransportGuard(): void {
  if (analyticsTransportGuarded || typeof window === "undefined") return;
  analyticsTransportGuarded = true;
  const originalFetch = window.fetch.bind(window);
  const patchedFetch: typeof window.fetch = (input, init) => {
    try {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const body = init && "body" in init ? init.body : undefined;
      if (analyticsEndpoint(url)) {
        if (typeof body === "string") {
          const next = sanitizeAnalyticsRequestBody(body);
          if (next == null) {
            return Promise.resolve(
              new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
            );
          }
          return originalFetch(input, { ...init, body: next });
        }
        if (body != null) {
          return Promise.resolve(
            new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
          );
        }
      }
    } catch {
      return Promise.resolve(new Response("{}", { status: 200, headers: { "content-type": "application/json" } }));
    }
    return originalFetch(input, init);
  };
  window.fetch = patchedFetch;
  const xhrProto = XMLHttpRequest.prototype;
  const originalOpen = xhrProto.open;
  const originalSend = xhrProto.send;
  xhrProto.open = function open(
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null,
  ): void {
    (this as XMLHttpRequest & { __trusthubUrl?: string }).__trusthubUrl = String(url ?? "");
    originalOpen.call(this, method, url, async ?? true, username ?? null, password ?? null);
  } as typeof xhrProto.open;
  xhrProto.send = function send(this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null): void {
    const url = (this as XMLHttpRequest & { __trusthubUrl?: string }).__trusthubUrl || "";
    if (analyticsEndpoint(url)) {
      if (typeof body !== "string") {
        finishBlockedRequest(this);
        return;
      }
      const next = sanitizeAnalyticsRequestBody(body);
      if (next == null) {
        finishBlockedRequest(this);
        return;
      }
      originalSend.call(this, next);
      return;
    }
    originalSend.call(this, body ?? null);
  } as typeof xhrProto.send;
  if (typeof navigator.sendBeacon === "function") {
    const originalBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => {
      const target = String(url);
      if (!analyticsEndpoint(target)) return originalBeacon(url, data);
      if (typeof data !== "string") return true;
      const next = sanitizeAnalyticsRequestBody(data);
      if (next == null) return true;
      return originalBeacon(url, next);
    };
  }
}
