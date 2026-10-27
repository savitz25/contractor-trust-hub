import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { PoolClient } from "pg";
import { assertContractorExistsBeforeStreaming } from "../app/contractors/[slug]/layout";
import { query, withDbClient } from "../lib/db";
import type { ContractorDetail } from "../lib/contractors/types";
import {
  isTransientProfileDbError,
  metadataAfterProfileLookupError,
} from "../lib/seo/profile-lookup";
import { trustReportMetadata } from "../lib/seo/trust-report-seo";

process.env.DATABASE_URL = "invalid";
delete process.env.POSTGRES_URL;

function fakeClient(onSql?: (text: string) => void) {
  const sql: string[] = [];
  let releases = 0;
  const client = {
    async query(text: string) {
      sql.push(text);
      onSql?.(text);
      if (text.startsWith("SELECT")) return { rows: [{ n: sql.filter((s) => s.startsWith("SELECT")).length }] };
      return { rows: [] };
    },
    release() {
      releases += 1;
    },
  };
  return {
    client: client as unknown as PoolClient,
    sql,
    releases: () => releases,
  };
}

test("profile reads share one session client and do not reconnect", async () => {
  const outer = fakeClient();
  const inner = fakeClient();
  const rows = await withDbClient(outer.client, async () => {
    const first = await query<{ n: number }>("SELECT 1 AS n");
    const second = await withDbClient(inner.client, () => query<{ n: number }>("SELECT 2 AS n"));
    return [first[0]?.n, second[0]?.n];
  });

  assert.deepEqual(rows, [1, 2]);
  assert.deepEqual(
    outer.sql.filter((sql) => sql.startsWith("SELECT")),
    ["SELECT 1 AS n", "SELECT 2 AS n"],
  );
  assert.equal(inner.sql.length, 0);
  assert.equal(outer.releases(), 0);
  assert.equal(outer.sql.filter((sql) => sql === "BEGIN").length, 2);
  assert.equal(outer.sql.filter((sql) => sql === "COMMIT").length, 2);
});

test("a session does not open a second connection after a capacity error", async () => {
  let selects = 0;
  const bound = fakeClient((sql) => {
    if (sql.startsWith("SELECT")) {
      selects += 1;
      throw new Error("EMAXCONNSESSION");
    }
  });

  await assert.rejects(
    () => withDbClient(bound.client, () => query("SELECT 1")),
    /EMAXCONNSESSION/,
  );
  assert.equal(selects, 1);
  assert.ok(bound.sql.includes("ROLLBACK"));
  assert.equal(bound.releases(), 0);
});

test("an unbound query refuses an invalid database url without connecting", { timeout: 5_000 }, async () => {
  await assert.rejects(() => query("SELECT 1"), /DATABASE_URL is missing or invalid/);
});

test("transient profile database errors are not turned into noindex metadata", () => {
  const timeout = new Error("canceling statement due to statement timeout");
  const connect = new Error("timeout exceeded when trying to connect");
  const capacity = new Error("MaxClientsInSessionMode");
  const programming = new Error('relation "contractors" does not exist');

  assert.equal(isTransientProfileDbError(timeout), true);
  assert.equal(isTransientProfileDbError(connect), true);
  assert.equal(isTransientProfileDbError(capacity), true);
  assert.equal(isTransientProfileDbError(programming), false);
  assert.equal(isTransientProfileDbError(null), false);

  assert.throws(() => metadataAfterProfileLookupError(timeout), (err) => err === timeout);
  assert.throws(() => metadataAfterProfileLookupError(connect), (err) => err === connect);
  assert.throws(() => metadataAfterProfileLookupError(capacity), (err) => err === capacity);

  const soft = metadataAfterProfileLookupError(programming);
  const robots = soft.robots as { index?: boolean; follow?: boolean };
  assert.equal(robots.index, false);
  assert.equal(robots.follow, true);
});

test("a missing profile still uses notFound and only transient failures rethrow", () => {
  const page = readFileSync("app/contractors/[slug]/page.tsx", "utf8");
  const queries = readFileSync("lib/contractors/queries.ts", "utf8");

  assert.match(page, /title: "Contractor not found"/);
  assert.match(page, /if \(!contractor\) notFound\(\)/);
  assert.match(page, /if \(isTransientProfileDbError\(e\)\) throw e/);
  assert.match(page, /return metadataAfterProfileLookupError\(error\)/);
  assert.match(page, /await withDbSession\(async \(\) =>/);
  assert.match(queries, /return withDbSession\(\(\) => getContractorBySlugUncached\(slug, stateSlug\)\)/);
});

test("missing profile is rejected before the route loading boundary", async () => {
  const layout = readFileSync("app/contractors/[slug]/layout.tsx", "utf8");
  assert.match(layout, /await assertContractorExistsBeforeStreaming\(decodeURIComponent\(raw\)\)/);
  await assert.rejects(
    () => assertContractorExistsBeforeStreaming("b1-genuinely-missing", async () => null),
    (error: unknown) =>
      typeof error === "object" && error !== null &&
      "digest" in error && error.digest === "NEXT_HTTP_ERROR_FALLBACK;404",
  );
});

test("a valid profile passes the early guard and keeps indexable metadata", async () => {
  const profile = {
    id: "profile-test-id",
    slug: "b1-valid-regression-profile",
    displayName: "Valid Regression Profile",
    legalName: null,
    dbaName: null,
    primaryCity: null,
    primaryCounty: null,
    homeState: "FL",
    isThinProfile: true,
    licenses: [],
    entities: [],
    discipline: [],
  } satisfies ContractorDetail;
  const found = await assertContractorExistsBeforeStreaming(
    profile.slug,
    async () => profile,
  );

  assert.equal(found, profile);
  const metadata = trustReportMetadata(found!);
  assert.deepEqual(metadata.robots, { index: true, follow: true });
  assert.match(
    String((metadata.alternates as { canonical: string }).canonical),
    /b1-valid-regression-profile/,
  );
});
