import * as Sentry from "@sentry/nextjs";
import type { ErrorEvent, EventHint, NodeOptions } from "@sentry/nextjs";
import { after } from "next/server";

/**
 * Server and edge error capture for Contractor Trust Hub.
 *
 * No client SDK, no session replay, and no performance traces are sent.
 * When SENTRY_DSN is unset this module does not initialize Sentry.
 * SDK 11 stores privacy in dataCollection; sendDefaultPii: false is still set.
 */

const SQLSTATE = /^[0-9A-Z]{5}$/;
const STATEMENT_TIMEOUT = "57014";

export type ServerSentryOptions = NodeOptions & { sendDefaultPii: false };

const reported = new WeakSet<object>();
const pendingStatementTimeouts = new WeakMap<object, { route?: string }>();
let testSink: ((event: ErrorEvent) => void) | null = null;
let initAttempted = false;

export function readSqlState(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  if (typeof code !== "string" || !SQLSTATE.test(code)) return undefined;
  return code;
}

/** Path only. Query strings and fragments are never tags. */
export function routeTag(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  let path = value.trim();
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) {
    try {
      path = new URL(path).pathname;
    } catch {
      path = path.replace(/^https?:\/\/[^/]+/i, "");
    }
  }
  path = path.split("#", 1)[0] ?? "";
  path = path.split("?", 1)[0] ?? "";
  path = path.trim();
  if (!path) return undefined;
  if (!path.startsWith("/")) path = `/${path}`;
  path = path.replace(/\/(route|page|layout|loading|error)$/, "");
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.length > 180) path = path.slice(0, 180);
  return path || "/";
}

export function routeFromStack(error: unknown): string | undefined {
  if (!(error instanceof Error) || !error.stack) return undefined;
  const frames = [
    ...error.stack.matchAll(
      /(?:^|[\s(])(?:\/[\w.@+-]+)*\/app\/([^\s:?)]+?)\.(?:tsx|ts|jsx|js)\b/g,
    ),
  ];
  const preferred = frames.find((match) => /\/(route|page)$/.test(match[1] ?? "")) ?? frames[0];
  return routeTag(preferred?.[1]);
}

function stripQuery(value: string): string {
  const withoutHash = value.split("#", 1)[0] ?? value;
  return withoutHash.split("?", 1)[0] ?? withoutHash;
}

/**
 * Remove query strings and fragments from absolute URLs (https://host/path?q)
 * and relative URLs (/api/search?token=secret, app/api/route.ts?token=secret)
 * without cutting off text that follows the URL.
 */
function scrubUrlText(text: string): string {
  return text.replace(
    /(?:https?:\/\/[^\s?#]*|[^\s?#]*\/[^\s?#]*)(?:\?[^\s#]*)?(?:#[^\s]*)?/gi,
    (match) => (match.includes("?") || match.includes("#") ? stripQuery(match) : match),
  );
}

const SENSITIVE_KEY =
  /^(cookie|cookies|set-cookie|header|headers|authorization|proxy-authorization|query|query_string|querystring|password|passwd|secret|token|dsn|database_url|postgres_url|connection_string)$/i;

function scrubRecord(record: Record<string, unknown>, depth: number): void {
  if (depth > 6) return;
  for (const key of Object.keys(record)) {
    if (SENSITIVE_KEY.test(key)) {
      delete record[key];
      continue;
    }
    record[key] = scrubValue(record[key], depth + 1);
  }
}

function scrubValue(value: unknown, depth: number): unknown {
  if (depth > 6 || value == null) return value;
  if (typeof value === "string") return scrubUrlText(value);
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth + 1));
  if (typeof value === "object") {
    scrubRecord(value as Record<string, unknown>, depth);
    return value;
  }
  return value;
}

/** Drops headers, cookies, and query strings before an event can leave the process. */
export function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    delete event.request.headers;
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.env;
    delete event.request.query_string;
    if (typeof event.request.url === "string") event.request.url = scrubUrlText(event.request.url);
  }
  delete event.user;
  if (typeof event.message === "string") event.message = scrubUrlText(event.message);
  if (typeof event.logentry?.message === "string") event.logentry.message = scrubUrlText(event.logentry.message);
  if (typeof event.transaction === "string") event.transaction = scrubUrlText(event.transaction);
  if (event.tags) {
    for (const [key, value] of Object.entries(event.tags)) {
      if (typeof value === "string") event.tags[key] = scrubUrlText(value);
    }
  }
  if (event.breadcrumbs) {
    for (const crumb of event.breadcrumbs) {
      if (crumb.data && typeof crumb.data === "object") scrubRecord(crumb.data as Record<string, unknown>, 0);
      if (typeof crumb.message === "string") crumb.message = scrubUrlText(crumb.message);
    }
  }
  if (event.extra && typeof event.extra === "object") scrubRecord(event.extra as Record<string, unknown>, 0);
  if (event.contexts && typeof event.contexts === "object") {
    scrubRecord(event.contexts as Record<string, unknown>, 0);
  }
  const metadata = event.sdkProcessingMetadata as
    | { normalizedRequest?: { headers?: unknown; cookies?: unknown; query_string?: unknown; url?: string } }
    | undefined;
  if (metadata?.normalizedRequest) {
    delete metadata.normalizedRequest.headers;
    delete metadata.normalizedRequest.cookies;
    delete metadata.normalizedRequest.query_string;
    if (typeof metadata.normalizedRequest.url === "string") {
      metadata.normalizedRequest.url = scrubUrlText(metadata.normalizedRequest.url);
    }
  }
  if (event.exception?.values) {
    for (const value of event.exception.values) {
      if (typeof value.value === "string") value.value = scrubUrlText(value.value);
      const frames = value.stacktrace?.frames;
      if (!frames) continue;
      for (const frame of frames) {
        if (typeof frame.filename === "string") frame.filename = scrubUrlText(frame.filename);
        if (typeof frame.abs_path === "string") frame.abs_path = scrubUrlText(frame.abs_path);
        delete frame.vars;
      }
    }
  }
  return event;
}

function deliver(event: ErrorEvent): ErrorEvent | null {
  const scrubbed = scrubSentryEvent(event);
  if (testSink) {
    testSink(scrubbed);
    return null;
  }
  return scrubbed;
}

export function serverSentryOptions(dsn: string): ServerSentryOptions {
  return {
    dsn,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    includeLocalVariables: false,
    enableOpenTelemetrySetup: false,
    enhanceFetchErrorMessages: false,
    tracePropagationTargets: [],
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      stackFrameVariables: false,
      genAI: { inputs: false, outputs: false },
      mcp: { inputs: false, outputs: false },
    },
    integrations(integrations) {
      return integrations.filter((integration) => {
        const name = integration.name.toLowerCase();
        return (
          name !== "console" &&
          !name.includes("replay") &&
          !name.includes("postgres") &&
          !name.includes("prisma") &&
          !name.includes("localvariables")
        );
      });
    },
    beforeSend(event: ErrorEvent, _hint: EventHint) {
      return deliver(event);
    },
  };
}

export function sentryDsn(): string | undefined {
  const dsn = process.env.SENTRY_DSN;
  if (typeof dsn !== "string") return undefined;
  const trimmed = dsn.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function initServerSentry(): void {
  const dsn = sentryDsn();
  if (!dsn || initAttempted || Sentry.getClient()) return;
  initAttempted = true;
  try {
    Sentry.init(serverSentryOptions(dsn) as NodeOptions);
  } catch {
    // A bad DSN must not change request handling.
  }
}

/** Test-only recorder. When set, events are scrubbed, recorded, and not sent. */
export function setSentryTestSink(sink: ((event: ErrorEvent) => void) | null): void {
  testSink = sink;
}

function scheduleAfterResponse(fn: () => void): void {
  try {
    after(fn);
  } catch {
    if (typeof setImmediate === "function") setImmediate(fn);
    else queueMicrotask(fn);
  }
}

export function captureServerError(error: unknown, context?: { route?: string }): void {
  if (!sentryDsn()) return;
  try {
    initServerSentry();
    if (!Sentry.getClient()) return;
    if (error && typeof error === "object") {
      if (reported.has(error)) return;
      reported.add(error);
    }
    const sqlstate = readSqlState(error);
    const route = routeTag(context?.route) ?? routeFromStack(error);
    Sentry.withScope((scope) => {
      scope.setTag("hub", "contractor");
      if (route) scope.setTag("route", route);
      if (sqlstate) scope.setTag("sqlstate", sqlstate);
      scope.setUser(null);
      Sentry.captureException(error);
    });
  } catch {
    // Reporting must not change the HTTP response.
  }
}

/**
 * Postgres statement timeouts (SQLSTATE 57014), including ones a route catches.
 * Deferred so an unhandled error can be reported once, with the framework route.
 */
export function reportDatabaseError(error: unknown): void {
  if (!sentryDsn() || readSqlState(error) !== STATEMENT_TIMEOUT) return;
  try {
    if (!error || typeof error !== "object") {
      captureServerError(error);
      return;
    }
    if (reported.has(error) || pendingStatementTimeouts.has(error)) return;
    pendingStatementTimeouts.set(error, { route: routeFromStack(error) });
    scheduleAfterResponse(() => {
      const pending = pendingStatementTimeouts.get(error);
      if (!pending) return;
      pendingStatementTimeouts.delete(error);
      captureServerError(error, { route: pending.route });
      void Sentry.flush(2000);
    });
  } catch {
    // Reporting must not change the HTTP response.
  }
}

type RequestInfo = {
  path: string;
  method: string;
  headers: Record<string, string | string[] | undefined>;
};

type ErrorContext = {
  routerKind: string;
  routePath: string;
  routeType: string;
};

/** Next.js onRequestError hook for unhandled server component and route errors. */
export function reportRequestError(error: unknown, request: RequestInfo, context: ErrorContext): void {
  if (!sentryDsn()) return;
  try {
    initServerSentry();
    if (!Sentry.getClient()) return;
    if (error && typeof error === "object") {
      pendingStatementTimeouts.delete(error);
      if (reported.has(error)) return;
      reported.add(error);
    }
    const route = routeTag(context.routePath) ?? routeTag(request.path);
    const sqlstate = readSqlState(error);
    Sentry.withScope((scope) => {
      scope.setTag("hub", "contractor");
      if (route) scope.setTag("route", route);
      if (sqlstate) scope.setTag("sqlstate", sqlstate);
      scope.setUser(null);
      Sentry.captureRequestError(error, request, context);
    });
  } catch {
    // Next.js already produced the HTTP response. Swallow reporter failures.
  }
}
