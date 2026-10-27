import assert from "node:assert/strict";
import test from "node:test";
import {
  chunkSitemapEntries,
  createSitemapShardPlan,
  isTransientSitemapFailure,
  nonContractorSitemapEntries,
  renderUrlSetXml,
  SITEMAP_MAX_URLS_PER_CHILD,
  type SitemapUrlEntry,
} from "../lib/seo/sitemap-data";
import { createSitemapRouteHandlers } from "../lib/seo/sitemap-handlers";

const xmlLocs = (xml: string) =>
  [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) =>
    match[1]
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&"),
  );

function assertWellFormedXml(xml: string, rootName: string) {
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  const tokens = xml.match(/<[^>]+>|[^<]+/g) ?? [];
  const stack: string[] = [];
  for (const token of tokens) {
    if (token.startsWith("<?")) continue;
    if (token.startsWith("</")) {
      const name = token.slice(2, -1).trim();
      assert.equal(stack.pop(), name, `mismatched close tag ${name}`);
    } else if (token.startsWith("<")) {
      const name = /^<([A-Za-z][A-Za-z0-9:]*)\b[^>]*>$/.exec(token)?.[1];
      assert.ok(name, `invalid XML tag ${token}`);
      if (!token.endsWith("/>")) stack.push(name!);
    } else {
      assert.doesNotMatch(token, /&(?!amp;|lt;|gt;|quot;|apos;)/);
    }
  }
  assert.deepEqual(stack, []);
  assert.match(xml, new RegExp(`^<\\?xml[^>]+\\?>\\s*<${rootName}\\b`));
  assert.match(xml, new RegExp(`</${rootName}>\\s*$`));
}

function fixturePlan() {
  const staticEntries: SitemapUrlEntry[] = [
    { loc: "https://www.contractortrusthub.com/", priority: 1 },
    { loc: "https://www.contractortrusthub.com/verify", priority: 0.9 },
  ];
  const pages: SitemapUrlEntry[][] = [
    [
      { loc: "https://www.contractortrusthub.com/contractors/a", stableId: "c-1" },
      { loc: "https://www.contractortrusthub.com/contractors/b", stableId: "c-2" },
    ],
    [
      { loc: "https://www.contractortrusthub.com/contractors/c", stableId: "c-3" },
      { loc: "https://www.contractortrusthub.com/contractors/d", stableId: "c-4" },
    ],
  ];
  return createSitemapShardPlan({
    staticEntries,
    chunkSize: 4,
    maxChildren: 50,
    profilePageHasRows: async (id) => Boolean(pages[id]?.length),
    profileEntries: async (id) => pages[id] ?? [],
  });
}

test("index invokes every listed child; children are valid, nonempty, bounded, and unique", async () => {
  const handlers = createSitemapRouteHandlers(fixturePlan);
  const index = await handlers.index();
  assert.equal(index.status, 200);
  const indexXml = await index.text();
  assertWellFormedXml(indexXml, "sitemapindex");
  const children = xmlLocs(indexXml);
  assert.deepEqual(children, [
    "https://www.contractortrusthub.com/sitemap/0.xml",
    "https://www.contractortrusthub.com/sitemap/1.xml",
  ]);

  const allLocs: string[] = [];
  const firstGeneration = new Map<string, string>();
  firstGeneration.set("index", indexXml);
  for (const child of children) {
    const id = new URL(child).pathname.match(/\/(\d+)\.xml$/)?.[1];
    assert.ok(id);
    const response = await handlers.child(id!);
    assert.equal(response.status, 200, child);
    const xml = await response.text();
    assertWellFormedXml(xml, "urlset");
    const locs = xmlLocs(xml);
    assert.ok(locs.length > 0, child);
    assert.ok(locs.length <= SITEMAP_MAX_URLS_PER_CHILD, child);
    assert.equal(new Set(locs).size, locs.length, `duplicate within ${child}`);
    allLocs.push(...locs);
    firstGeneration.set(child, xml);
  }
  assert.equal(new Set(allLocs).size, allLocs.length, "duplicate across children");

  const indexAgain = await handlers.index();
  assert.equal(indexAgain.status, 200);
  assert.equal(await indexAgain.text(), firstGeneration.get("index"));
  for (const child of children) {
    const id = new URL(child).pathname.match(/\/(\d+)\.xml$/)?.[1];
    const response = await handlers.child(id!);
    assert.equal(response.status, 200, child);
    assert.equal(await response.text(), firstGeneration.get(child));
  }

  const missing = await handlers.child("2");
  assert.equal(missing.status, 404);
  assert.equal(children.some((child) => child.endsWith("/2.xml")), false);
  assert.match(index.headers.get("cache-control") ?? "", /s-maxage=3600/);
});

test("identical URL input produces identical child IDs, membership, and ordering", async () => {
  const input = [
    { loc: "https://www.contractortrusthub.com/z", stableId: "id-z" },
    { loc: "https://www.contractortrusthub.com/a", stableId: "id-a" },
    { loc: "https://www.contractortrusthub.com/m", stableId: "id-m" },
  ];
  const first = chunkSitemapEntries(input, 2);
  const second = chunkSitemapEntries([...input].reverse(), 2);
  assert.equal(first.length, second.length);
  assert.deepEqual(first, second);
  assert.deepEqual(first.map((chunk) => chunk.map((entry) => entry.loc)), [
    ["https://www.contractortrusthub.com/a", "https://www.contractortrusthub.com/m"],
    ["https://www.contractortrusthub.com/z"],
  ]);
});

test("exact 50,000 URL chunk boundaries never create an empty trailing child", () => {
  for (const count of [0, 1, 49_999, 50_000, 50_001, 100_000]) {
    const entries = Array.from({ length: count }, (_, id) => ({
      loc: `https://www.contractortrusthub.com/item/${String(id).padStart(6, "0")}`,
      stableId: String(id),
    }));
    const chunks = chunkSitemapEntries(entries, SITEMAP_MAX_URLS_PER_CHILD);
    assert.equal(chunks.length, Math.ceil(count / SITEMAP_MAX_URLS_PER_CHILD), `${count} URLs`);
    assert.ok(chunks.every((chunk) => chunk.length > 0 && chunk.length <= 50_000));
    assert.equal(chunks.flat().length, count);
  }
});

test("stable unique tie-break picks the same primary-location row regardless of input order", () => {
  const a = { loc: "https://www.contractortrusthub.com/same", stableId: "a", lastmod: "2026-01-01" };
  const b = { loc: "https://www.contractortrusthub.com/same", stableId: "b", lastmod: "2026-02-01" };
  assert.deepEqual(chunkSitemapEntries([b, a], 10), chunkSitemapEntries([a, b], 10));
  assert.equal(chunkSitemapEntries([b, a], 10)[0]?.[0]?.stableId, "a");
});

const PROBE_TIMEOUT = new Error("canceling statement due to statement timeout");
const PROGRAMMING_ERROR = new Error('relation "contractors" does not exist');

async function withSitemapLogs(run: () => Promise<void>): Promise<string[]> {
  const lines: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    lines.push(args.map((arg) => String(arg)).join(" "));
  };
  try {
    await run();
  } finally {
    console.error = original;
  }
  return lines;
}

test("a later-shard timeout does not turn a valid index into 503", async () => {
  const logs = await withSitemapLogs(async () => {
    const handlers = createSitemapRouteHandlers(() => createSitemapShardPlan({
      staticEntries: [{ loc: "https://www.contractortrusthub.com/florida" }],
      chunkSize: 2,
      profilePageHasRows: async (id) => {
        if (id === 2) throw PROBE_TIMEOUT;
        return id === 1;
      },
      profileEntries: async (id) => [
        {
          loc: `https://www.contractortrusthub.com/contractors/shard-${id}`,
          stableId: `shard-${id}`,
          lastmod: "2026-04-02T12:00:00.000Z",
        },
      ],
    }));
    const index = await handlers.index();
    assert.equal(index.status, 200);
    assert.equal(index.headers.get("cache-control"), "no-store");
    const indexXml = await index.text();
    assertWellFormedXml(indexXml, "sitemapindex");
    assert.deepEqual(xmlLocs(indexXml), [
      "https://www.contractortrusthub.com/sitemap/0.xml",
      "https://www.contractortrusthub.com/sitemap/1.xml",
    ]);

    const child = await handlers.child("0");
    assert.equal(child.status, 200);
    const childXml = await child.text();
    assertWellFormedXml(childXml, "urlset");
    assert.ok(xmlLocs(childXml).includes("https://www.contractortrusthub.com/florida"));
    assert.ok(xmlLocs(childXml).includes("https://www.contractortrusthub.com/contractors/shard-0"));
    assert.match(childXml, /<lastmod>2026-04-02T12:00:00\.000Z<\/lastmod>/);
    assert.equal((await handlers.child("1")).status, 200);
    const unavailableChild = await handlers.child("2");
    assert.equal(unavailableChild.status, 503);
    assert.equal(unavailableChild.headers.get("cache-control"), "no-store");
  });
  assert.match(logs.join("\n"), /later shard 2 probe failed/);
});

test("a child re-probe timeout for a shard in a cached index returns retryable 503, not ghost-shard 404", async () => {
  const cachedIndex = await createSitemapShardPlan({
    staticEntries: [{ loc: "https://www.contractortrusthub.com/florida" }],
    chunkSize: 2,
    maxChildren: 4,
    profilePageHasRows: async (id) => id >= 1 && id <= 3,
    profileEntries: async (id) => [{
      loc: `https://www.contractortrusthub.com/contractors/shard-${id}`,
      stableId: `shard-${id}`,
    }],
  });
  assert.deepEqual(cachedIndex.childIds, [0, 1, 2, 3]);

  const childHandlers = createSitemapRouteHandlers(() => createSitemapShardPlan({
    staticEntries: [{ loc: "https://www.contractortrusthub.com/florida" }],
    chunkSize: 2,
    maxChildren: 4,
    profilePageHasRows: async (id) => {
      if (id === 3) throw PROBE_TIMEOUT;
      return id === 1 || id === 2;
    },
    profileEntries: async (id) => [{
      loc: `https://www.contractortrusthub.com/contractors/shard-${id}`,
      stableId: `shard-${id}`,
    }],
  }));
  let childResponse: Response | undefined;
  await withSitemapLogs(async () => {
    childResponse = await childHandlers.child("3");
  });
  assert.equal(childResponse?.status, 503);
  assert.equal(childResponse?.headers.get("cache-control"), "no-store");
});

test("a persistently empty shard is omitted from the sitemap index", async () => {
  const handlers = createSitemapRouteHandlers(() => createSitemapShardPlan({
    staticEntries: [{ loc: "https://www.contractortrusthub.com/florida" }],
    chunkSize: 2,
    maxChildren: 4,
    profilePageHasRows: async (id) => id === 1 || id === 2,
    profileEntries: async (id) => [{
      loc: `https://www.contractortrusthub.com/contractors/shard-${id}`,
      stableId: `shard-${id}`,
    }],
  }));
  const index = await handlers.index();
  assert.equal(index.status, 200);
  assert.deepEqual(xmlLocs(await index.text()), [
    "https://www.contractortrusthub.com/sitemap/0.xml",
    "https://www.contractortrusthub.com/sitemap/1.xml",
    "https://www.contractortrusthub.com/sitemap/2.xml",
  ]);
});

test("a later-shard programming error stays a 503", async () => {
  const handlers = createSitemapRouteHandlers(() => createSitemapShardPlan({
    staticEntries: [{ loc: "https://www.contractortrusthub.com/florida" }],
    profilePageHasRows: async () => {
      throw PROGRAMMING_ERROR;
    },
    profileEntries: async () => [],
  }));
  const index = await handlers.index();
  assert.equal(index.status, 503);
  assert.equal(index.headers.get("cache-control"), "no-store");
  const child = await handlers.child("0");
  assert.equal(child.status, 503);
});

test("shard 0 profile timeout keeps static output and drops unverified profiles", async () => {
  const logs = await withSitemapLogs(async () => {
    const handlers = createSitemapRouteHandlers(() => createSitemapShardPlan({
      staticEntries: [
        { loc: "https://www.contractortrusthub.com/florida" },
        { loc: "https://www.contractortrusthub.com/verify?state=or" },
        { loc: "https://www.contractortrusthub.com/account" },
      ],
      profilePageHasRows: async () => false,
      profileEntries: async () => {
        throw PROBE_TIMEOUT;
      },
    }));
    const index = await handlers.index();
    assert.equal(index.status, 200);
    const child = await handlers.child("0");
    assert.equal(child.status, 200);
    assert.equal(child.headers.get("cache-control"), "no-store");
    const xml = await child.text();
    assertWellFormedXml(xml, "urlset");
    assert.deepEqual(xmlLocs(xml), ["https://www.contractortrusthub.com/florida"]);
  });
  assert.match(logs.join("\n"), /shard 0 profiles unavailable/);
});

test("shard 0 programming error is not replaced with a fallback page", async () => {
  const handlers = createSitemapRouteHandlers(() => createSitemapShardPlan({
    staticEntries: [{ loc: "https://www.contractortrusthub.com/florida" }],
    profilePageHasRows: async () => false,
    profileEntries: async () => {
      throw PROGRAMMING_ERROR;
    },
  }));
  assert.equal((await handlers.child("0")).status, 503);
});

test("published sitemap URLs stay canonical and lastmod values stay valid", () => {
  for (const entry of nonContractorSitemapEntries()) {
    const url = new URL(entry.loc);
    assert.equal(url.protocol, "https:");
    assert.equal(url.host, "www.contractortrusthub.com");
    assert.equal(url.search, "");
    assert.equal(url.hash, "");
    assert.equal(["/account", "/watch", "/compare"].includes(url.pathname), false);
  }
  const xml = renderUrlSetXml([
    { loc: "https://www.contractortrusthub.com/contractors/good", lastmod: "2026-04-02T12:00:00.000Z" },
    { loc: "https://www.contractortrusthub.com/contractors/undated", lastmod: "not-a-date" },
    { loc: "https://www.contractortrusthub.com/contractors/broken?x=1", lastmod: "2026-04-02T12:00:00.000Z" },
    { loc: "https://www.contractortrusthub.com/account" },
    { loc: "https://evil.example/contractors/off-host" },
  ]);
  assert.deepEqual(xmlLocs(xml), [
    "https://www.contractortrusthub.com/contractors/good",
    "https://www.contractortrusthub.com/contractors/undated",
  ]);
  assert.match(xml, /<lastmod>2026-04-02T12:00:00\.000Z<\/lastmod>/);
  assert.equal(xml.match(/<lastmod>/g)?.length, 1);
  assert.equal(isTransientSitemapFailure(PROBE_TIMEOUT), true);
  assert.equal(isTransientSitemapFailure(new Error("timeout exceeded when trying to connect")), true);
  assert.equal(isTransientSitemapFailure(new Error("MaxClientsInSessionMode")), true);
  assert.equal(isTransientSitemapFailure(PROGRAMMING_ERROR), false);
  assert.equal(isTransientSitemapFailure(new TypeError("timeout is not a function")), false);
});

test("zero URL manifest has no children and no placeholder shard", async () => {
  const plan = await createSitemapShardPlan({
    staticEntries: [],
    profilePageHasRows: async () => false,
    profileEntries: async () => [],
  });
  assert.deepEqual(plan.childIds, []);
  assert.deepEqual(await plan.entriesForChild(0), []);
});
