import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import * as Sentry from "@sentry/nextjs";
import type { ErrorEvent } from "@sentry/nextjs";
import {
  readSqlState,
  reportDatabaseError,
  reportRequestError,
  scrubSentryEvent,
  serverSentryOptions,
  setSentryTestSink,
} from "../lib/observability/sentry";

const TIMEOUT_BODY = {
  error: "search took too long — try a more specific name or license number",
};

function statementTimeout(routeFile = "app/api/plan/match/route.ts"): Error {
  const error = new Error("canceling statement due to statement timeout");
  (error as Error & { code: string }).code = "57014";
  error.stack = `${error.stack ?? ""}\n    at POST (/agent/repos/contractor-trust-hub/${routeFile}:36:20)`;
  return error;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git" || entry === "data" || entry === "artifacts" || entry === "docs" || entry === "public" || entry === "ingest") continue;
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx)$/.test(entry)) out.push(full);
  }
  return out;
}

test("sentry stays server-only and does not change the database pool", () => {
  assert.equal(existsSync("instrumentation-client.ts"), false);
  assert.equal(existsSync("sentry.client.config.ts"), false);
  assert.equal(existsSync("app/global-error.tsx"), false);

  const nextConfig = readFileSync("next.config.ts", "utf8");
  assert.equal(nextConfig.includes("withSentryConfig"), false);
  assert.equal(nextConfig.includes("tunnelRoute"), false);
  assert.match(nextConfig, /serverExternalPackages:\s*\["pg"\]/);

  const db = readFileSync("lib/db.ts", "utf8");
  assert.match(db, /port:\s+5432\s+\(Session — not Transaction :6543\)/);
  assert.match(db, /connectionString: connectionStringForPool\(rawConnectionString\)/);
  assert.match(db, /connectionTimeoutMillis: CONNECT_TIMEOUT_MS/);
  assert.match(db, /ssl: needsSsl \? \{ rejectUnauthorized: false \} : undefined/);
  assert.match(db, /reportDatabaseError\(err\)/);
  assert.match(db, /reportDatabaseError\(err2\)/);

  const sentrySource = readFileSync("lib/observability/sentry.ts", "utf8");
  assert.equal(sentrySource.includes("replayIntegration"), false);
  assert.match(sentrySource, /tracesSampleRate: 0/);
  assert.match(sentrySource, /sendDefaultPii: false/);

  for (const file of walk(".")) {
    const text = readFileSync(file, "utf8");
    if (!text.startsWith('"use client"') && !text.startsWith("'use client'")) continue;
    assert.equal(text.includes("@sentry/nextjs"), false, file);
    assert.equal(text.includes("lib/observability/sentry"), false, file);
  }

  const options = serverSentryOptions("https://public@o0.ingest.sentry.io/1");
  assert.equal(options.tracesSampleRate, 0);
  assert.equal(options.sendDefaultPii, false);
  assert.equal(options.dataCollection?.userInfo, false);
  assert.equal(options.dataCollection?.cookies, false);
  assert.equal(options.dataCollection?.httpHeaders, false);
  assert.equal(options.dataCollection?.urlQueryParams, false);
  assert.deepEqual(options.dataCollection?.httpBodies, []);
  assert.equal(typeof options.integrations, "function");
  if (typeof options.integrations === "function") {
    const kept = options.integrations([
      { name: "Replay" },
      { name: "Postgres" },
      { name: "Console" },
      { name: "Http" },
    ] as never);
    assert.deepEqual(
      kept.map((integration) => integration.name),
      ["Http"],
    );
  }
});

test("beforeSend removes headers, cookies, and query strings", () => {
  const event = {
    type: undefined,
    message: "scrub",
    request: {
      url: "https://www.contractortrusthub.com/api/plan/match?zip=33101&token=secret",
      headers: { cookie: "sid=abc", authorization: "Bearer secret" },
      cookies: { sid: "abc" },
      query_string: "zip=33101&token=secret",
      data: { password: "nope" },
    },
    user: { email: "person@example.com", ip_address: "203.0.113.8" },
    transaction: "POST /api/plan/match?token=secret",
    tags: { route: "/api/plan/match?token=secret" },
    breadcrumbs: [
      {
        data: {
          url: "https://example.com/search?q=secret",
          headers: { cookie: "sid=abc" },
          cookies: { sid: "abc" },
        },
      },
    ],
    extra: { database_url: "postgres://user:password@localhost/db", note: "ok" },
    exception: {
      values: [
        {
          value: "failed https://example.com/path?token=secret",
          stacktrace: { frames: [{ filename: "app/api/plan/match/route.ts?token=secret", vars: { email: "a" } }] },
        },
      ],
    },
  } as ErrorEvent;

  const scrubbed = scrubSentryEvent(event);
  const encoded = JSON.stringify(scrubbed);
  assert.equal(scrubbed.request?.headers, undefined);
  assert.equal(scrubbed.request?.cookies, undefined);
  assert.equal(scrubbed.request?.query_string, undefined);
  assert.equal(scrubbed.request?.data, undefined);
  assert.equal(scrubbed.request?.url, "https://www.contractortrusthub.com/api/plan/match");
  assert.equal(scrubbed.user, undefined);
  assert.equal(scrubbed.transaction, "POST /api/plan/match");
  assert.equal(scrubbed.tags?.route, "/api/plan/match");
  assert.equal(scrubbed.breadcrumbs?.[0]?.data?.url, "https://example.com/search");
  assert.equal(scrubbed.breadcrumbs?.[0]?.data?.headers, undefined);
  assert.equal(scrubbed.breadcrumbs?.[0]?.data?.cookies, undefined);
  assert.equal(scrubbed.extra?.database_url, undefined);
  assert.equal(scrubbed.extra?.note, "ok");
  assert.equal(scrubbed.exception?.values?.[0]?.value, "failed https://example.com/path");
  assert.equal(scrubbed.exception?.values?.[0]?.stacktrace?.frames?.[0]?.vars, undefined);
  assert.equal(encoded.includes("secret"), false);
  assert.equal(encoded.includes("sid=abc"), false);
  assert.equal(encoded.includes("password"), false);
  assert.equal(encoded.includes("person@example.com"), false);
});

test("beforeSend strips query strings from relative URLs in exceptions, messages, and breadcrumbs", () => {
  const event = {
    type: undefined,
    message: "request failed /api/search?token=secret",
    request: { url: "/api/search?token=secret" },
    breadcrumbs: [
      {
        message: "GET /api/search?token=secret",
        data: { url: "/api/search?token=secret" },
      },
    ],
    extra: { note: "see /api/search?token=secret" },
    contexts: { app: { app_start_time: "ctx /api/search?token=secret" } },
    exception: {
      values: [
        { value: "/api/search?token=secret" },
        { value: "Error: /api/search?token=secret" },
      ],
    },
  } as ErrorEvent;

  const scrubbed = scrubSentryEvent(event);
  assert.equal(scrubbed.exception?.values?.[0]?.value, "/api/search");
  assert.equal(scrubbed.exception?.values?.[1]?.value, "Error: /api/search");
  assert.equal(scrubbed.message, "request failed /api/search");
  assert.equal(scrubbed.breadcrumbs?.[0]?.message, "GET /api/search");
  assert.equal(scrubbed.breadcrumbs?.[0]?.data?.url, "/api/search");
  assert.equal(scrubbed.request?.url, "/api/search");
  assert.equal(scrubbed.extra?.note, "see /api/search");
  const encoded = JSON.stringify(scrubbed);
  assert.equal(encoded.includes("?token="), false);
  assert.equal(encoded.includes("token=secret"), false);
});

test("server capture no-ops without a DSN, tags 57014, and leaves the response unchanged", async () => {
  const previous = process.env.SENTRY_DSN;
  const events: ErrorEvent[] = [];
  setSentryTestSink((event) => {
    events.push(event);
  });

  delete process.env.SENTRY_DSN;
  reportDatabaseError(statementTimeout());
  reportRequestError(
    statementTimeout(),
    {
      path: "/api/plan/match?zip=33101&token=secret",
      method: "POST",
      headers: { cookie: "sid=secret", authorization: "Bearer secret" },
    },
    { routerKind: "App Router", routePath: "/api/plan/match", routeType: "route" },
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(events.length, 0);

  process.env.SENTRY_DSN = "https://public@o0.ingest.sentry.io/1";
  const otelFlag = process.env.NEXT_OTEL_FETCH_DISABLED;

  function respond(report: boolean): Response {
    const error = statementTimeout();
    try {
      throw error;
    } catch (err) {
      if (report) {
        reportDatabaseError(err);
        reportRequestError(
          err,
          {
            path: "/api/plan/match?zip=33101&token=secret",
            method: "POST",
            headers: { cookie: "sid=secret", authorization: "Bearer secret" },
          },
          { routerKind: "App Router", routePath: "/api/plan/match", routeType: "route" },
        );
      }
      return Response.json(TIMEOUT_BODY, { status: 503, headers: { "cache-control": "no-store" } });
    }
  }

  const unchanged = respond(false);
  const reported = respond(true);
  assert.equal(reported.status, unchanged.status);
  assert.equal(reported.status, 503);
  assert.equal(reported.headers.get("cache-control"), "no-store");
  assert.equal(unchanged.headers.get("cache-control"), "no-store");
  assert.deepEqual(await reported.json(), TIMEOUT_BODY);
  assert.deepEqual(await unchanged.json(), TIMEOUT_BODY);
  assert.equal(process.env.NEXT_OTEL_FETCH_DISABLED, otelFlag);
  await Sentry.flush(2000);

  assert.equal(events.length, 1);
  const event = events[0];
  assert.ok(event);
  assert.equal(event.tags?.hub, "contractor");
  assert.equal(event.tags?.route, "/api/plan/match");
  assert.equal(event.tags?.sqlstate, "57014");
  assert.equal(readSqlState(statementTimeout()), "57014");
  const encoded = JSON.stringify(event);
  assert.equal(encoded.includes("token=secret"), false);
  assert.equal(encoded.includes("sid=secret"), false);
  assert.equal(encoded.includes("Bearer"), false);
  assert.equal(event.request?.headers, undefined);
  assert.equal(event.request?.cookies, undefined);
  assert.equal(event.request?.query_string, undefined);
  if (typeof event.request?.url === "string") assert.equal(event.request.url.includes("?"), false);

  const other = new Error("canceling statement due to statement timeout");
  reportDatabaseError(other);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(events.length, 1);

  delete process.env.SENTRY_DSN;
  reportRequestError(statementTimeout(), { path: "/api/x", method: "GET", headers: {} }, {
    routerKind: "App Router",
    routePath: "/api/x",
    routeType: "route",
  });
  reportDatabaseError(statementTimeout());
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(events.length, 1);

  if (previous === undefined) delete process.env.SENTRY_DSN;
  else process.env.SENTRY_DSN = previous;
  setSentryTestSink(null);
});
