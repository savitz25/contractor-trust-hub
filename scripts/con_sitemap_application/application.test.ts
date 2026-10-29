import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import test from "node:test";
import { Pool, type QueryResultRow } from "pg";
import { GET as getSitemapIndex } from "../../app/sitemap.xml/route";
import { GET as getGenerationChild } from "../../app/sitemap/g/[generationId]/[shardNo]/route";
import { listSearchableContractorSlugs } from "../../lib/contractors/queries";
import {
  getSitemapShardPlan,
  renderUrlSetXml,
  SITEMAP_MAX_URLS_PER_CHILD,
  type SitemapUrlEntry,
} from "../../lib/seo/sitemap-data";
import {
  SITEMAP_GENERATION_MAX_COMPRESSED_BYTES,
  SITEMAP_GENERATION_MAX_XML_BYTES,
} from "../../lib/seo/sitemap-generation-reader";

const TEST_ONLY_ADVISORY_LOCK = [20261029, 1] as const;
const FIXTURE_LOGIN = "cth_sitemap_reader_test";
const FIXTURE_PASSWORD = "cth_sitemap_reader_test_only";
const FIXTURE_HOST = "https://www.contractortrusthub.com";
const ADMIN_URL = process.env.TEST_ADMIN_DATABASE_URL;
assert.ok(ADMIN_URL, "TEST_ADMIN_DATABASE_URL must point to the disposable PostgreSQL service");
assert.ok(process.env.DATABASE_URL, "DATABASE_URL must use the test-only sitemap reader login");

const admin = new Pool({ connectionString: ADMIN_URL, max: 2 });
const sqlQuery = async <T extends QueryResultRow>(
  sql: string,
  values?: unknown[],
  _options?: { statementTimeoutMs?: number },
): Promise<T[]> => (await admin.query<T>(sql, values as unknown[])).rows;

function extractLocations(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) =>
    (match[1] ?? "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&"),
  );
}

function assertUrlSet(xml: string, expectedCount: number): void {
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(xml, /<\/urlset>\s*$/);
  const locations = extractLocations(xml);
  assert.equal(locations.length, expectedCount);
  assert.equal(new Set(locations).size, locations.length);
  for (const location of locations) {
    const url = new URL(location);
    assert.equal(url.origin, FIXTURE_HOST);
    assert.equal(url.search, "");
    assert.equal(url.hash, "");
  }
}

async function callGenerationChild(generationId: string, shardNo: string): Promise<Response> {
  return getGenerationChild(new Request(`${FIXTURE_HOST}/sitemap/g/${generationId}/${shardNo}.xml`), {
    params: Promise.resolve({ generationId, shardNo }),
  });
}

function countUrlElements(xml: string): number {
  return [...xml.matchAll(/<url>/g)].length;
}

async function buildRealFloridaEntries(): Promise<SitemapUrlEntry[]> {
  const loadRows = (options: Parameters<typeof listSearchableContractorSlugs>[0]) =>
    listSearchableContractorSlugs(options, { query: sqlQuery });
  const plan = await getSitemapShardPlan(loadRows);
  return plan.entriesForChild(0);
}

async function publishFixtureGeneration(
  payloads: Buffer[],
  forcedUrlCounts?: readonly number[],
): Promise<string> {
  const generationId = randomUUID();
  const client = await admin.connect();
  let transactionOpen = false;
  let roleSet = false;
  await client.query("SELECT pg_advisory_lock($1, $2)", TEST_ONLY_ADVISORY_LOCK);
  try {
    await client.query("SET ROLE cth_sitemap_publisher");
    roleSet = true;
    await client.query("BEGIN");
    transactionOpen = true;
    const pointer = await client.query<{
      pointer_epoch: number;
      current_generation_id: string | null;
    }>(
      "SELECT pointer_epoch, current_generation_id::text FROM sitemap_private.publication WHERE singleton",
    );
    assert.equal(pointer.rowCount, 1);
    const oldEpoch = Number(pointer.rows[0]?.pointer_epoch);
    const oldGeneration = pointer.rows[0]?.current_generation_id ?? null;
    await client.query(
      "INSERT INTO sitemap_private.generation(generation_id,state) VALUES($1,'building')",
      [generationId],
    );

    const hashes: Buffer[] = [];
    let urlCount = 0;
    let byteCount = 0;
    for (const [shardNo, payload] of payloads.entries()) {
      const xml = forcedUrlCounts ? "" : gunzipSync(payload).toString("utf8");
      const urls = forcedUrlCounts?.[shardNo] ?? countUrlElements(xml);
      assert.ok(urls > 0 && urls <= SITEMAP_MAX_URLS_PER_CHILD);
      const checksum = createHash("sha256").update(payload).digest();
      hashes.push(checksum);
      urlCount += urls;
      byteCount += payload.byteLength;
      await client.query(
        `INSERT INTO sitemap_private.shard
         (generation_id,shard_no,url_count,compressed_payload,payload_sha256)
         VALUES($1,$2,$3,$4,$5)`,
        [generationId, shardNo, urls, payload, checksum],
      );
    }
    const manifest = createHash("sha256")
      .update(hashes.map((hash) => hash.toString("hex")).join(""), "ascii")
      .digest();
    await client.query(
      `UPDATE sitemap_private.generation
       SET state='sealed', sealed_at=clock_timestamp(), shard_count=$2, url_count=$3,
           compressed_bytes=$4, manifest_sha256=$5
       WHERE generation_id=$1`,
      [generationId, payloads.length, urlCount, byteCount, manifest],
    );
    if (oldGeneration) {
      const retired = await client.query(
        `UPDATE sitemap_private.generation SET retired_at=clock_timestamp()
         WHERE generation_id=$1 AND state='sealed' AND retired_at IS NULL`,
        [oldGeneration],
      );
      assert.equal(retired.rowCount, 1);
    }
    const changed = await client.query(
      `UPDATE sitemap_private.publication
       SET pointer_epoch=$1,current_generation_id=$2
       WHERE singleton AND pointer_epoch=$3
         AND current_generation_id IS NOT DISTINCT FROM $4`,
      [oldEpoch + 1, generationId, oldEpoch, oldGeneration],
    );
    assert.equal(changed.rowCount, 1);
    await client.query("COMMIT");
    transactionOpen = false;
    return generationId;
  } catch (error) {
    if (transactionOpen) {
      await client.query("ROLLBACK");
      transactionOpen = false;
    }
    throw error;
  } finally {
    if (transactionOpen) await client.query("ROLLBACK");
    if (roleSet) await client.query("RESET ROLE");
    const released = await client.query("SELECT pg_advisory_unlock($1, $2) AS released", TEST_ONLY_ADVISORY_LOCK);
    assert.equal(released.rows[0]?.released, true, "rollback/commit must precede session lock release");
    client.release();
  }
}

async function withShardTriggerDisabled<T>(fn: () => Promise<T>): Promise<T> {
  await admin.query("ALTER TABLE sitemap_private.shard DISABLE TRIGGER shard_freeze");
  try {
    return await fn();
  } finally {
    await admin.query("ALTER TABLE sitemap_private.shard ENABLE TRIGGER shard_freeze");
  }
}

test("generation sitemap application handlers fail closed and preserve immutable generations", async (t) => {
  process.env.NEXT_PUBLIC_SITE_URL = FIXTURE_HOST;
  process.env.SITEMAP_GENERATION_READER_ENABLED = "false";
  const contract = readFileSync("scripts/con_sitemap_phase0/contract.sql", "utf8").replace(
    "INSERT INTO sitemap_private.publication(singleton,pointer_epoch,current_generation_id) VALUES(true,0,NULL);",
    "-- publication fixture row inserted after contract installation",
  );
  await admin.query(contract);
  // The contract only permits pointer UPDATEs after initialization. Seed its
  // pre-publication NULL pointer as disposable fixture state with guards paused.
  await admin.query("ALTER TABLE sitemap_private.publication DISABLE TRIGGER ALL");
  await admin.query(
    "INSERT INTO sitemap_private.publication(singleton,pointer_epoch,current_generation_id) VALUES(true,0,NULL)",
  );
  await admin.query("ALTER TABLE sitemap_private.publication ENABLE TRIGGER ALL");
  await admin.query(`
    CREATE ROLE ${FIXTURE_LOGIN} LOGIN PASSWORD '${FIXTURE_PASSWORD}';
    GRANT cth_sitemap_reader TO ${FIXTURE_LOGIN};
    CREATE TABLE public.contractors (
      id uuid PRIMARY KEY,
      slug text,
      updated_at timestamptz,
      is_thin_profile boolean NOT NULL DEFAULT false,
      home_state char(2)
    );
    CREATE TABLE public.licenses (
      id uuid PRIMARY KEY,
      contractor_id uuid NOT NULL,
      source_system text NOT NULL,
      state char(2)
    );
    GRANT SELECT ON public.contractors, public.licenses TO cth_sitemap_reader;
  `);
  await admin.query(
    `INSERT INTO public.contractors(id,slug,updated_at,is_thin_profile,home_state) VALUES
      ('10000000-0000-4000-8000-000000000001','fixture-fl-home','2026-10-20T12:00:00Z',false,'FL'),
      ('10000000-0000-4000-8000-000000000002','fixture-fl-license','2026-10-21T12:00:00Z',false,'GA'),
      ('10000000-0000-4000-8000-000000000003','fixture-fl-thin','2026-10-22T12:00:00Z',true,'FL'),
      ('10000000-0000-4000-8000-000000000004','fixture-tx-only','2026-10-23T12:00:00Z',false,'TX')`
  );
  await admin.query(
    `INSERT INTO public.licenses(id,contractor_id,source_system,state) VALUES
      ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','fl_dbpr','FL'),
      ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000004','tx_tdlr','TX')`,
  );

  await t.test("legacy routes remain the default and the versioned child stays disabled", async () => {
    const index = await getSitemapIndex();
    assert.equal(index.status, 200);
    assert.match(index.headers.get("cache-control") ?? "", /s-maxage=3600/);
    assert.ok((await index.text()).includes("/sitemap/0.xml"));
    assert.equal((await callGenerationChild(randomUUID(), "0")).status, 404);
  });

  process.env.SITEMAP_GENERATION_READER_ENABLED = "true";
  await t.test("index before first publication is 503 no-store, not an empty 200", async () => {
    const index = await getSitemapIndex();
    assert.equal(index.status, 503);
    assert.equal(index.headers.get("cache-control"), "no-store");
  });

  await t.test("real Florida query and serializer create the stored sitemap XML", async () => {
    const rows = await listSearchableContractorSlugs(
      { stateSlug: "fl", limit: 100, offset: 0 },
      { query: sqlQuery },
    );
    assert.deepEqual(rows.map((row) => row.slug), ["fixture-fl-home", "fixture-fl-license"]);
    assert.equal(rows.find((row) => row.slug === "fixture-fl-home")?.updatedAt, "2026-10-20T12:00:00.000Z");

    const entries = await buildRealFloridaEntries();
    const locations = entries.map((entry) => entry.loc);
    assert.ok(locations.includes(`${FIXTURE_HOST}/contractors/fixture-fl-home`));
    assert.ok(locations.includes(`${FIXTURE_HOST}/contractors/fixture-fl-license`));
    assert.ok(!locations.includes(`${FIXTURE_HOST}/contractors/fixture-fl-thin`));
    assert.ok(!locations.includes(`${FIXTURE_HOST}/contractors/fixture-tx-only`));
    assert.ok(!locations.some((loc) => new URL(loc).pathname === "/account"));
    assert.ok(!locations.some((loc) => new URL(loc).pathname === "/compare"));
    assert.ok(entries.find((entry) => entry.loc.endsWith("/fixture-fl-home"))?.lastmod);

    const actualXml = renderUrlSetXml(entries);
    assertUrlSet(actualXml, entries.length);
    assert.ok(actualXml.includes("<lastmod>2026-10-20T12:00:00.000Z</lastmod>"));
    assert.ok(gzipSync(Buffer.from(actualXml)).byteLength > 0);
  });

  const entriesA = await buildRealFloridaEntries();
  const splitA = Math.ceil(entriesA.length / 2);
  const payloadsA = [entriesA.slice(0, splitA), entriesA.slice(splitA)]
    .filter((entries) => entries.length > 0)
    .map((entries) => gzipSync(Buffer.from(renderUrlSetXml(entries)), { mtime: 0 }));
  const generationA = await publishFixtureGeneration(payloadsA);

  await t.test("current index and generation-specific XML have contract headers and complete payloads", async () => {
    const index = await getSitemapIndex();
    assert.equal(index.status, 200);
    assert.equal(index.headers.get("content-type"), "application/xml; charset=utf-8");
    assert.equal(index.headers.get("cache-control"), "no-store");
    const indexXml = await index.text();
    const children = extractLocations(indexXml);
    assert.deepEqual(children, payloadsA.map((_, shardNo) => `${FIXTURE_HOST}/sitemap/g/${generationA}/${shardNo}.xml`));

    for (const [shardNo, payload] of payloadsA.entries()) {
      const response = await callGenerationChild(generationA, String(shardNo));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "application/xml; charset=utf-8");
      assert.equal(response.headers.get("content-encoding"), "gzip");
      assert.match(response.headers.get("cache-control") ?? "", /max-age=31536000.*immutable/);
      const body = Buffer.from(await response.arrayBuffer());
      assert.deepEqual(body, payload);
      const xml = gunzipSync(body).toString("utf8");
      const count = countUrlElements(xml);
      assertUrlSet(xml, count);
    }
  });

  await t.test("confirmed unknown generations and out-of-range shards are 404 no-store", async () => {
    const missing = await callGenerationChild(randomUUID(), "0");
    assert.equal(missing.status, 404);
    assert.equal(missing.headers.get("cache-control"), "no-store");
    const outOfRange = await callGenerationChild(generationA, String(payloadsA.length));
    assert.equal(outOfRange.status, 404);
    assert.equal(outOfRange.headers.get("cache-control"), "no-store");
  });

  await admin.query(
    `INSERT INTO public.contractors(id,slug,updated_at,is_thin_profile,home_state)
     VALUES('10000000-0000-4000-8000-000000000005','fixture-fl-new','2026-10-25T12:00:00Z',false,'FL')`,
  );
  const entriesB = await buildRealFloridaEntries();
  const splitB = Math.ceil(entriesB.length / 2);
  const payloadsB = [entriesB.slice(0, splitB), entriesB.slice(splitB)]
    .filter((entries) => entries.length > 0)
    .map((entries) => gzipSync(Buffer.from(renderUrlSetXml(entries)), { mtime: 0 }));
  const generationB = await publishFixtureGeneration(payloadsB);

  await t.test("index follows only current publication while retained child URLs stay generation-bound", async () => {
    const index = await getSitemapIndex();
    const locations = extractLocations(await index.text());
    assert.ok(locations.length > 0);
    assert.ok(locations.every((loc) => loc.includes(`/sitemap/g/${generationB}/`)));
    assert.ok(!locations.some((loc) => loc.includes(`/sitemap/g/${generationA}/`)));

    const retained = await callGenerationChild(generationA, "0");
    assert.equal(retained.status, 200);
    assert.deepEqual(Buffer.from(await retained.arrayBuffer()), payloadsA[0]);
    const current = await callGenerationChild(generationB, "0");
    assert.equal(current.status, 200);
    const currentXml = gunzipSync(Buffer.from(await current.arrayBuffer())).toString("utf8");
    assert.ok(currentXml.includes("/contractors/fixture-fl-new"));
  });

  await t.test("a missing required shard makes index and existing children unavailable, not partial", async () => {
    assert.ok(payloadsB.length >= 2);
    await withShardTriggerDisabled(async () => {
      await admin.query("DELETE FROM sitemap_private.shard WHERE generation_id=$1 AND shard_no=1", [generationB]);
    });
    const index = await getSitemapIndex();
    assert.equal(index.status, 503);
    assert.equal(index.headers.get("cache-control"), "no-store");
    const child = await callGenerationChild(generationB, "0");
    assert.equal(child.status, 503);
    assert.equal(child.headers.get("cache-control"), "no-store");
    await withShardTriggerDisabled(async () => {
      const xmlEntries = entriesB.slice(Math.ceil(entriesB.length / 2));
      const payload = payloadsB[1]!;
      await admin.query(
        `INSERT INTO sitemap_private.shard
         (generation_id,shard_no,url_count,compressed_payload,payload_sha256)
         VALUES($1,1,$2,$3,$4)`,
        [generationB, xmlEntries.length, payload, createHash("sha256").update(payload).digest()],
      );
    });
  });

  await t.test("bad manifest checksums and corrupt compressed bodies return 503 no-store", async () => {
    const originalHash = await admin.query<{ payload_sha256: Buffer }>(
      "SELECT payload_sha256 FROM sitemap_private.shard WHERE generation_id=$1 AND shard_no=0",
      [generationB],
    );
    await withShardTriggerDisabled(async () => {
      await admin.query(
        "UPDATE sitemap_private.shard SET payload_sha256=decode(repeat('0',64),'hex') WHERE generation_id=$1 AND shard_no=0",
        [generationB],
      );
    });
    const checksumFailure = await callGenerationChild(generationB, "0");
    assert.equal(checksumFailure.status, 503);
    assert.equal(checksumFailure.headers.get("cache-control"), "no-store");
    await withShardTriggerDisabled(async () => {
      await admin.query(
        "UPDATE sitemap_private.shard SET payload_sha256=$2 WHERE generation_id=$1 AND shard_no=0",
        [generationB, originalHash.rows[0]?.payload_sha256],
      );
    });

    const originalBody = Buffer.from(payloadsB[0]!);
    const corruptBody = Buffer.from(originalBody);
    corruptBody[0] = (corruptBody[0] ?? 0) ^ 0xff;
    await withShardTriggerDisabled(async () => {
      await admin.query(
        "UPDATE sitemap_private.shard SET compressed_payload=$3 WHERE generation_id=$1 AND shard_no=$2",
        [generationB, 0, corruptBody],
      );
    });
    const bodyFailure = await callGenerationChild(generationB, "0");
    assert.equal(bodyFailure.status, 503);
    assert.equal(bodyFailure.headers.get("cache-control"), "no-store");
    await withShardTriggerDisabled(async () => {
      await admin.query(
        "UPDATE sitemap_private.shard SET compressed_payload=$3 WHERE generation_id=$1 AND shard_no=$2",
        [generationB, 0, originalBody],
      );
    });
  });

  await t.test("failed reader queries return retryable 503 rather than a false 404", async () => {
    await admin.query("REVOKE SELECT ON sitemap_private.shard FROM cth_sitemap_reader");
    try {
      const index = await getSitemapIndex();
      assert.equal(index.status, 503);
      assert.equal(index.headers.get("cache-control"), "no-store");
      const child = await callGenerationChild(generationB, "0");
      assert.equal(child.status, 503);
      assert.equal(child.headers.get("cache-control"), "no-store");
    } finally {
      await admin.query("GRANT SELECT ON sitemap_private.shard TO cth_sitemap_reader");
    }
  });

  await t.test("compressed and decompressed payload limits fail closed", async () => {
    const hugeXml = Buffer.from("x".repeat(SITEMAP_GENERATION_MAX_XML_BYTES + 1));
    const bomb = gzipSync(hugeXml, { mtime: 0 });
    const bombGeneration = await publishFixtureGeneration([bomb], [1]);
    const bombResponse = await callGenerationChild(bombGeneration, "0");
    assert.equal(bombResponse.status, 503);
    assert.equal(bombResponse.headers.get("cache-control"), "no-store");

    const largeCompressed = Buffer.alloc(SITEMAP_GENERATION_MAX_COMPRESSED_BYTES + 1, 0xa5);
    const oversizedGeneration = await publishFixtureGeneration([largeCompressed], [1]);
    const oversizedResponse = await callGenerationChild(oversizedGeneration, "0");
    assert.equal(oversizedResponse.status, 503);
    assert.equal(oversizedResponse.headers.get("cache-control"), "no-store");
  });

  await admin.end();
});
