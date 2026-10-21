import assert from "node:assert/strict";
import test from "node:test";
import {
  chunkSitemapEntries,
  createSitemapShardPlan,
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

test("zero URL manifest has no children and no placeholder shard", async () => {
  const plan = await createSitemapShardPlan({
    staticEntries: [],
    profilePageHasRows: async () => false,
    profileEntries: async () => [],
  });
  assert.deepEqual(plan.childIds, []);
  assert.deepEqual(await plan.entriesForChild(0), []);
});
