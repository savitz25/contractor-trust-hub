// Run after `npm run build`; all database and companion-service responses are local fixtures.
const assert = require("node:assert/strict");
const http = require("node:http");
const { after, test } = require("node:test");

const pg = require("pg");
let fixtureMode = "missing";
const fixtureProfile = {
  id: "c3-published-fixture-id",
  slug: "c3-published-fixture",
  display_name: "C3 Published Fixture Contractor",
  legal_name: null,
  dba_name: null,
  primary_city: "Tampa",
  primary_county: "Hillsborough",
  home_state: "FL",
  is_thin_profile: true,
};

// Controlled client responses make confirmed absence distinct from transport
// and statement failures while exercising the real built Next.js handlers.
pg.Pool.prototype.connect = async function connectFixture() {
  if (fixtureMode === "connect-timeout") {
    throw Object.assign(new Error("connect ETIMEDOUT"), { code: "ETIMEDOUT" });
  }

  return {
    async query(query, params) {
      const sql = typeof query === "string" ? query : query.text;
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql) || sql.startsWith("SET LOCAL")) {
        return { rows: [], rowCount: 0 };
      }
      if (/FROM contractors\s+WHERE slug = \$1/i.test(sql)) {
        if (fixtureMode === "statement-timeout") {
          throw Object.assign(
            new Error("canceling statement due to statement timeout"),
            { code: "57014" },
          );
        }
        const published =
          fixtureMode === "published" && params?.[0] === fixtureProfile.slug;
        return { rows: published ? [fixtureProfile] : [], rowCount: Number(published) };
      }
      return { rows: [], rowCount: 0 };
    },
    release() {},
  };
};

process.env.DATABASE_URL = "postgresql://fixture:fixture@127.0.0.1:5432/fixture";
process.env.NEXT_PUBLIC_SITE_URL = "https://www.contractortrusthub.com";
process.env.NEXT_TELEMETRY_DISABLED = "1";

const next = require("next");
let app;
let nextServer;
let originServer;
let nextPort;

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve(server.address().port);
    });
  });
}

function close(server) {
  if (!server?.listening) return Promise.resolve();
  server.closeAllConnections?.();
  return new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

async function request(pathname) {
  const response = await fetch(`http://127.0.0.1:${nextPort}${pathname}`, {
    headers: { accept: "text/html" },
  });
  return { status: response.status, body: await response.text() };
}

function headOf(body) {
  const end = body.indexOf("</head>");
  assert.notEqual(end, -1, "response contains a complete document head");
  return body.slice(0, end + "</head>".length);
}

function meta(head, attribute, value) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`<meta[^>]*${attribute}="${escaped}"[^>]*>`, "i").exec(head)?.[0] ?? null;
}

async function startRuntime() {
  originServer = http.createServer((_request, response) => {
    response.writeHead(404, { "content-type": "application/json" });
    response.end("{}");
  });
  const originPort = await listen(originServer);
  process.env.ATH_PUBLIC_PROFILE_ORIGIN = `http://127.0.0.1:${originPort}`;

  app = next({ dev: false, dir: process.cwd() });
  await app.prepare();
  nextServer = http.createServer(app.getRequestHandler());
  nextPort = await listen(nextServer);
}

after(async () => {
  await close(nextServer);
  await app?.close();
  await close(originServer);
});

test("built Next runtime streams a generic 404 without inherited social metadata", async () => {
  await startRuntime();

  const response = await request("/c3-generic-missing-route");
  const head = headOf(response.body);
  const stream = response.body.slice(response.body.indexOf("</head>") + "</head>".length);

  assert.equal(response.status, 404);
  assert.match(head, /<meta name="robots" content="noindex"/i);
  assert.match(head, /<meta name="googlebot" content="noindex, follow"/i);
  assert.doesNotMatch(head, /<meta name="robots" content="index(?:,|\s)/i);
  assert.doesNotMatch(head, /<link[^>]+rel="canonical"[^>]+contractortrusthub\.com\//i);
  assert.equal(meta(head, "property", "og:title")?.includes("Page not found"), true);
  assert.equal(meta(head, "property", "og:description")?.includes("That URL is not in Contractor Trust Hub."), true);
  assert.equal(meta(head, "property", "og:url"), null);
  assert.equal(meta(head, "name", "twitter:title")?.includes("Page not found"), true);
  assert.equal(meta(head, "name", "twitter:card")?.includes("summary"), true);
  assert.equal(meta(head, "name", "twitter:image"), null);
  assert.doesNotMatch(head, /<meta (?:property="og:title"|name="twitter:title") content="Contractor Trust Hub/);
  assert.doesNotMatch(response.body, /opengraph-image\?v=20260903share004b-final/);
  assert.doesNotMatch(response.body, /opengraph-image\?[0-9a-f]{16}/i);
  assert.doesNotMatch(response.body, /Contractor Trust Hub — Before you hire, verify/);
  assert.doesNotMatch(response.body, /Independent contractor license and registration research with official board evidence and state-specific depth\. Not a marketplace — research before you hire\./);
  assert.doesNotMatch(response.body, /summary_large_image/);
  assert.match(stream, /Page not found/);
  assert.match(stream, /noindex/);
  assert.doesNotMatch(stream, /og:image|twitter:image|og:url/);
  assert.match(response.body, /That URL is not in Contractor Trust Hub\./);
  assert.match(response.body, /Verify a contractor/);
});

test("confirmed missing Contractor uses the same isolated 404 social metadata", async () => {
  fixtureMode = "missing";
  const response = await request("/contractors/c3-missing-fixture");
  const head = headOf(response.body);
  const stream = response.body.slice(response.body.indexOf("</head>") + "</head>".length);

  assert.equal(response.status, 404);
  assert.match(head, /<meta name="robots" content="noindex"/i);
  assert.match(head, /<meta name="googlebot" content="noindex, follow"/i);
  assert.doesNotMatch(head, /<meta name="robots" content="index(?:,|\s)/i);
  assert.equal(meta(head, "property", "og:url"), null);
  assert.equal(meta(head, "property", "og:title")?.includes("Page not found"), true);
  assert.equal(meta(head, "property", "og:description")?.includes("That URL is not in Contractor Trust Hub."), true);
  assert.equal(meta(head, "name", "twitter:title")?.includes("Page not found"), true);
  assert.equal(meta(head, "name", "twitter:card")?.includes("summary"), true);
  assert.equal(meta(head, "name", "twitter:image"), null);
  assert.match(stream, /Page not found|Contractor not found/);
  assert.doesNotMatch(stream, /og:image|twitter:image|og:url/);
  assert.doesNotMatch(response.body, /summary_large_image|opengraph-image\?v=20260903share004b-final|Contractor Trust Hub — Before you hire, verify/);
});

test("published Contractor retains business-specific indexable social metadata", async () => {
  fixtureMode = "published";
  const response = await request("/contractors/c3-published-fixture");
  const head = headOf(response.body);
  const self = "https://www.contractortrusthub.com/contractors/c3-published-fixture";

  assert.equal(response.status, 200);
  assert.match(head, /<meta name="robots" content="index, follow"/i);
  assert.match(head, new RegExp(`<link rel="canonical" href="${self}"`));
  assert.match(head, new RegExp(`<meta property="og:url" content="${self}"`));
  assert.match(head, /C3 Published Fixture Contractor/);
  assert.match(head, /<meta name="twitter:card" content="summary_large_image"/i);
  assert.match(head, /c3-published-fixture\/share-og/);
  assert.match(response.body, /C3 Published Fixture Contractor/);
});

test("database connect and statement timeouts are not converted to 404", async () => {
  fixtureMode = "connect-timeout";
  const connectFailure = await request("/contractors/c3-connect-timeout-fixture");
  assert.equal(connectFailure.status, 500);
  assert.notEqual(connectFailure.status, 404);

  fixtureMode = "statement-timeout";
  const queryFailure = await request("/contractors/c3-statement-timeout-fixture");
  assert.equal(queryFailure.status, 500);
  assert.notEqual(queryFailure.status, 404);
});
