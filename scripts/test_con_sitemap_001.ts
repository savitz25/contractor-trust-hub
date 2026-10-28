import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isLiveProfileState } from "../lib/contractors/queries";
import {
  boundedSitemapCount,
  chunkSitemapEntries,
  createSitemapShardPlan,
  directShardDecision,
  formatSitemapTiming,
  isTransientSitemapFailure,
  lookupSitemapChild,
  monotonePageStates,
  nonContractorSitemapEntries,
  probeProfileShardPrefix,
  renderUrlSetXml,
  SITEMAP_MAX_URLS_PER_CHILD,
  type PageProbeState,
  type SitemapChildLookup,
  type SitemapUrlEntry,
} from "../lib/seo/sitemap-data";
import { createSitemapRouteHandlers } from "../lib/seo/sitemap-handlers";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

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

const STATIC_FIXTURE: SitemapUrlEntry[] = [
  { loc: "https://www.contractortrusthub.com/florida" },
  { loc: "https://www.contractortrusthub.com/verify?state=or" },
  { loc: "https://www.contractortrusthub.com/account" },
];

const PROFILE_FIXTURE: SitemapUrlEntry[][] = [
  [
    {
      loc: "https://www.contractortrusthub.com/contractors/alpha",
      stableId: "c-1",
      lastmod: "2026-04-02T12:00:00.000Z",
    },
    { loc: "https://evil.example/contractors/off-host", stableId: "off" },
  ],
  [
    { loc: "https://www.contractortrusthub.com/contractors/bravo", stableId: "c-2" },
    { loc: "https://www.contractortrusthub.com/contractors/bravo?x=1", stableId: "query" },
  ],
  [
    { loc: "https://www.contractortrusthub.com/contractors/charlie", stableId: "c-3" },
    { loc: "https://www.contractortrusthub.com/account", stableId: "account" },
  ],
];

function publishableCount(entries: readonly SitemapUrlEntry[]): number {
  const locs = new Set(
    entries
      .map((entry) => entry.loc)
      .filter((loc) => {
        try {
          const url = new URL(loc);
          return url.protocol === "https:"
            && url.host === "www.contractortrusthub.com"
            && url.search === ""
            && url.hash === ""
            && !["/account", "/watch", "/compare"].includes(url.pathname);
        } catch {
          return false;
        }
      }),
  );
  return locs.size;
}

function directHandlers(
  loadChild: (id: number) => Promise<SitemapChildLookup>,
  planCalls: { n: number },
) {
  return createSitemapRouteHandlers(async () => {
    planCalls.n += 1;
    throw new Error("child sitemap rebuilt the shard plan");
  }, loadChild);
}

test("before child 2 the index probes shards 1, 2, and 3; the child probes shard 2 once", async () => {
  const planProbes: number[] = [];
  const plan = await createSitemapShardPlan({
    staticEntries: STATIC_FIXTURE,
    chunkSize: 2,
    profilePageHasRows: async (id) => {
      planProbes.push(id);
      return id === 1 || id === 2;
    },
    profileEntries: async (id) => PROFILE_FIXTURE[id] ?? [],
  });
  assert.deepEqual(planProbes, [1, 2, 3]);
  assert.deepEqual(plan.childIds, [0, 1, 2]);

  const childProbes: number[] = [];
  let fetches = 0;
  const lookup = await lookupSitemapChild({
    staticEntries: STATIC_FIXTURE,
    probePrefix: async (id) => {
      childProbes.push(id);
      return monotonePageStates(id, id <= 2 ? "present" : "absent");
    },
    profileEntries: async (id) => {
      fetches += 1;
      return PROFILE_FIXTURE[id] ?? [];
    },
  }, 2);
  assert.deepEqual(childProbes, [2]);
  assert.equal(fetches, 1);
  assert.equal(lookup.status, 200);
  assert.equal(lookup.retry, false);
  assert.deepEqual(
    lookup.entries.map((entry) => entry.loc),
    ["https://www.contractortrusthub.com/contractors/charlie"],
  );
  assert.equal(lookup.entries.length, publishableCount(PROFILE_FIXTURE[2] ?? []));
});

test("index children stay valid under direct lookup, and an empty shard stays 404", async () => {
  const plan = await createSitemapShardPlan({
    staticEntries: STATIC_FIXTURE,
    chunkSize: 2,
    profilePageHasRows: async (id) => id === 1 || id === 2,
    profileEntries: async (id) => PROFILE_FIXTURE[id] ?? [],
  });
  assert.deepEqual(plan.childIds, [0, 1, 2]);

  const fetches: number[] = [];
  const probes: number[] = [];
  const source = {
    staticEntries: STATIC_FIXTURE,
    probePrefix: async (id: number) => {
      probes.push(id);
      return monotonePageStates(id, id <= 2 ? "present" : "absent");
    },
    profileEntries: async (id: number) => {
      fetches.push(id);
      return PROFILE_FIXTURE[id] ?? [];
    },
  };

  const shard0 = await lookupSitemapChild(source, 0);
  assert.equal(shard0.status, 200);
  assert.equal(shard0.retry, false);
  assert.deepEqual(probes, []);
  assert.deepEqual(fetches, [0]);
  assert.deepEqual(shard0.entries.map((entry) => entry.loc), [
    "https://www.contractortrusthub.com/contractors/alpha",
    "https://www.contractortrusthub.com/florida",
  ]);
  assert.deepEqual(
    shard0.entries.map((entry) => entry.loc),
    (await plan.entriesForChild(0)).map((entry) => entry.loc),
  );

  for (const id of plan.childIds) {
    if (id === 0) continue;
    const beforeFetches = fetches.length;
    const lookup = await lookupSitemapChild(source, id);
    assert.equal(lookup.status, 200, `advertised shard ${id}`);
    assert.equal(lookup.retry, false);
    assert.equal(fetches.length, beforeFetches + 1);
    assert.deepEqual(
      lookup.entries.map((entry) => entry.loc),
      (await plan.entriesForChild(id)).map((entry) => entry.loc),
    );
    assert.ok(lookup.entries.every((entry) => entry.loc.startsWith("https://www.contractortrusthub.com/")));
    assert.equal(lookup.entries.length, publishableCount(PROFILE_FIXTURE[id] ?? []));
  }

  const empty = await lookupSitemapChild(source, 3);
  assert.equal(empty.status, 404);
  assert.equal(empty.retry, false);
  assert.deepEqual(empty.entries, []);
  assert.equal(fetches.includes(3), false);
  assert.deepEqual(probes, [1, 2, 3]);
});

test("an observed upstream gap is 404 and does not read the page body", async () => {
  let fetches = 0;
  const lookup = await lookupSitemapChild({
    staticEntries: STATIC_FIXTURE,
    probePrefix: async () => {
      const pages: PageProbeState[] = [];
      pages[1] = "absent";
      pages[2] = "present";
      return pages;
    },
    profileEntries: async () => {
      fetches += 1;
      return PROFILE_FIXTURE[2] ?? [];
    },
  }, 2);
  assert.equal(lookup.status, 404);
  assert.equal(lookup.retry, false);
  assert.equal(fetches, 0);
  assert.equal(directShardDecision(2, lookupPages(1, "absent", 2, "present")), "absent");
});

test("an observed upstream timeout is 503 and does not read the page body", async () => {
  let fetches = 0;
  const pages: PageProbeState[] = [];
  pages[1] = "transient";
  pages[2] = "present";
  const planCalls = { n: 0 };
  let lookupFetches = 0;
  const logs = await withSitemapLogs(async () => {
    const lookup = await lookupSitemapChild({
      staticEntries: STATIC_FIXTURE,
      probePrefix: async () => pages,
      profileEntries: async () => {
        fetches += 1;
        return PROFILE_FIXTURE[2] ?? [];
      },
    }, 2);
    assert.equal(lookup.status, 503);
    assert.equal(lookup.retry, true);
    assert.equal(fetches, 0);
    assert.equal(directShardDecision(2, pages), "unverified");

    const handlers = directHandlers((id) => lookupSitemapChild({
      staticEntries: STATIC_FIXTURE,
      probePrefix: async () => pages,
      profileEntries: async () => {
        lookupFetches += 1;
        return PROFILE_FIXTURE[id] ?? [];
      },
    }, id), planCalls);
    const response = await handlers.child("2");
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("content-type"), "text/plain; charset=utf-8");
    assert.equal(await response.text(), "Sitemap temporarily unavailable");
  });
  assert.equal(lookupFetches, 0);
  assert.equal(planCalls.n, 0);
  assert.match(logs.join("\n"), /shard 2 prefix unverified; refusing the page body/);
});

test("a timed-out requested page stays 503 when earlier pages were present", async () => {
  let fetches = 0;
  const pages: PageProbeState[] = [];
  pages[1] = "present";
  pages[2] = "transient";
  const lookup = await lookupSitemapChild({
    staticEntries: STATIC_FIXTURE,
    probePrefix: async () => pages,
    profileEntries: async () => {
      fetches += 1;
      return PROFILE_FIXTURE[2] ?? [];
    },
  }, 2);
  assert.equal(lookup.status, 503);
  assert.equal(lookup.retry, true);
  assert.equal(fetches, 0);
  assert.equal(directShardDecision(2, pages), "unverified");
});

test("a confirmed-empty requested page is 404 even when earlier pages were not probed", async () => {
  let fetches = 0;
  const lookup = await lookupSitemapChild({
    staticEntries: STATIC_FIXTURE,
    probePrefix: async (id) => monotonePageStates(id, "absent"),
    profileEntries: async () => {
      fetches += 1;
      return PROFILE_FIXTURE[2] ?? [];
    },
  }, 2);
  assert.equal(lookup.status, 404);
  assert.equal(fetches, 0);
  assert.equal(directShardDecision(2, monotonePageStates(2, "absent")), "absent");
  assert.equal(directShardDecision(2, monotonePageStates(2, "transient")), "unverified");
  assert.equal(directShardDecision(2, monotonePageStates(2, "present")), "serve");
});

test("a profile read timeout after a present prefix is 503 with no urlset", async () => {
  const planCalls = { n: 0 };
  const logs = await withSitemapLogs(async () => {
    const handlers = directHandlers((id) => lookupSitemapChild({
      staticEntries: STATIC_FIXTURE,
      probePrefix: async (requested) => monotonePageStates(requested, "present"),
      profileEntries: async () => {
        throw PROBE_TIMEOUT;
      },
    }, id), planCalls);
    const response = await handlers.child("2");
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = await response.text();
    assert.equal(body.includes("<urlset"), false);
    assert.equal(body.includes("contractors/"), false);
  });
  assert.equal(planCalls.n, 0);
  assert.match(logs.join("\n"), /shard 2 profile read failed after a present prefix/);
});

test("direct shard 0 keeps static URLs when the profile read times out", async () => {
  const planCalls = { n: 0 };
  let probes = 0;
  const logs = await withSitemapLogs(async () => {
    const handlers = directHandlers((id) => lookupSitemapChild({
      staticEntries: STATIC_FIXTURE,
      probePrefix: async () => {
        probes += 1;
        return monotonePageStates(1, "present");
      },
      profileEntries: async () => {
        throw PROBE_TIMEOUT;
      },
    }, id), planCalls);
    const response = await handlers.child("0");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.match(response.headers.get("content-type") ?? "", /application\/xml/);
    const xml = await response.text();
    assertWellFormedXml(xml, "urlset");
    assert.deepEqual(xmlLocs(xml), ["https://www.contractortrusthub.com/florida"]);
  });
  assert.equal(probes, 0);
  assert.equal(planCalls.n, 0);
  assert.match(logs.join("\n"), /shard 0 profiles unavailable/);
});

test("direct lookup does not replace a programming error with a fallback page", async () => {
  const planCalls = { n: 0 };
  const handlers = directHandlers((id) => lookupSitemapChild({
    staticEntries: id === 0 ? [] : STATIC_FIXTURE,
    probePrefix: async (requested) => monotonePageStates(requested, "present"),
    profileEntries: async () => {
      throw PROGRAMMING_ERROR;
    },
  }, id), planCalls);
  const shard0 = await handlers.child("0");
  assert.equal(shard0.status, 503);
  assert.equal(shard0.headers.get("cache-control"), "no-store");
  assert.equal((await shard0.text()).includes("<urlset"), false);
  const later = await handlers.child("2");
  assert.equal(later.status, 503);
  assert.equal(later.headers.get("cache-control"), "no-store");
  assert.equal((await later.text()).includes("<urlset"), false);
  assert.equal(planCalls.n, 0);
});

test("direct child URLs stay on the canonical host and match the publishable count", async () => {
  const planCalls = { n: 0 };
  const handlers = directHandlers((id) => lookupSitemapChild({
    staticEntries: STATIC_FIXTURE,
    probePrefix: async (requested) => monotonePageStates(requested, "present"),
    profileEntries: async () => PROFILE_FIXTURE[1] ?? [],
  }, id), planCalls);
  const response = await handlers.child("1.xml");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") ?? "", /s-maxage=3600/);
  const xml = await response.text();
  assertWellFormedXml(xml, "urlset");
  const locs = xmlLocs(xml);
  assert.deepEqual(locs, ["https://www.contractortrusthub.com/contractors/bravo"]);
  assert.equal(locs.length, publishableCount(PROFILE_FIXTURE[1] ?? []));
  for (const loc of locs) {
    const url = new URL(loc);
    assert.equal(url.protocol, "https:");
    assert.equal(url.host, "www.contractortrusthub.com");
    assert.equal(url.search, "");
  }
  assert.equal(planCalls.n, 0);
});

test("publication gating skips the probe when the profile state is not live", async () => {
  assert.equal(isLiveProfileState("fl"), true);
  assert.equal(isLiveProfileState("va"), false);
  assert.equal(isLiveProfileState("not-a-state"), false);

  let liveProbes = 0;
  const live = await probeProfileShardPrefix(2, {
    stateSlug: "fl",
    probe: async () => {
      liveProbes += 1;
      return "present";
    },
  });
  assert.equal(liveProbes, 1);
  assert.equal(directShardDecision(2, live), "serve");

  let unpublishedProbes = 0;
  const unpublished = await probeProfileShardPrefix(2, {
    stateSlug: "not-a-state",
    probe: async () => {
      unpublishedProbes += 1;
      return "present";
    },
  });
  assert.equal(unpublishedProbes, 0);
  assert.equal(directShardDecision(2, unpublished), "absent");

  let fetches = 0;
  const hidden = await lookupSitemapChild({
    staticEntries: STATIC_FIXTURE,
    probePrefix: async (id) => probeProfileShardPrefix(id, {
      stateSlug: "va",
      probe: async () => "present",
    }),
    profileEntries: async () => {
      fetches += 1;
      return PROFILE_FIXTURE[2] ?? [];
    },
  }, 2);
  assert.equal(hidden.status, 404);
  assert.equal(fetches, 0);

  const logs = await withSitemapLogs(async () => {
    const timedOut = await probeProfileShardPrefix(2, {
      probe: async () => {
        throw PROBE_TIMEOUT;
      },
    });
    assert.equal(directShardDecision(2, timedOut), "unverified");
    assert.equal(timedOut[1], undefined);
    assert.equal(timedOut[2], "transient");
  });
  assert.match(logs.join("\n"), /shard 2 direct probe failed; prefix is unverified/);
  await assert.rejects(
    () => probeProfileShardPrefix(2, {
      probe: async () => {
        throw PROGRAMMING_ERROR;
      },
    }),
    /relation "contractors" does not exist/,
  );
});

test("child timing log records status and stage durations without row contents", async () => {
  const lines: string[] = [];
  const original = console.info;
  console.info = (...args: unknown[]) => {
    lines.push(args.map((arg) => String(arg)).join(" "));
  };
  const planCalls = { n: 0 };
  try {
    const handlers = directHandlers((id) => lookupSitemapChild({
      staticEntries: [],
      probePrefix: async (requested) => monotonePageStates(requested, "present"),
      profileEntries: async () => [{
        loc: "https://www.contractortrusthub.com/contractors/secret-slug",
        stableId: "secret-row",
      }],
    }, id), planCalls);
    const response = await handlers.child("4");
    assert.equal(response.status, 200);
    const body = await response.text();
    const line = lines.find((item) => item.includes("route=child id=4"));
    assert.ok(line);
    assert.match(line ?? "", /\[sitemap\] route=child id=4 status=200 bytes=\d+ probe_ms=\d+ fetch_ms=\d+ filter_ms=\d+ xml_ms=\d+/);
    assert.equal(line?.includes("secret-slug"), false);
    assert.equal(line?.includes("secret-row"), false);
    assert.equal(Number(line?.match(/bytes=(\d+)/)?.[1]), new TextEncoder().encode(body).byteLength);
  } finally {
    console.info = original;
  }
  assert.equal(planCalls.n, 0);
  assert.match(formatSitemapTiming({
    route: "index",
    status: 200,
    bytes: Number.NaN,
    probeMs: -4,
    fetchMs: 10.4,
    filterMs: 9_999_999,
    xmlMs: 3,
  }), /route=index id=- status=200 bytes=0 probe_ms=0 fetch_ms=10 filter_ms=600000 xml_ms=3/);
  assert.equal(boundedSitemapCount(-1), 0);
  assert.equal(boundedSitemapCount(9_000_000), 5_000_000);
});

test("an out of range child id is 404 and does not probe", async () => {
  let probes = 0;
  const lookup = await lookupSitemapChild({
    staticEntries: STATIC_FIXTURE,
    probePrefix: async () => {
      probes += 1;
      return monotonePageStates(1, "present");
    },
    profileEntries: async () => PROFILE_FIXTURE[0] ?? [],
  }, 50);
  assert.equal(lookup.status, 404);
  assert.equal(probes, 0);
  const negative = await lookupSitemapChild({
    staticEntries: STATIC_FIXTURE,
    probePrefix: async () => {
      probes += 1;
      return [];
    },
    profileEntries: async () => [],
  }, -1);
  assert.equal(negative.status, 404);
  assert.equal(probes, 0);
});

test("child route uses direct lookup and the index route keeps the shard plan", () => {
  const childRoute = readFileSync(join(repoRoot, "app/sitemap/[id]/route.ts"), "utf8");
  const indexRoute = readFileSync(join(repoRoot, "app/sitemap.xml/route.ts"), "utf8");
  const data = readFileSync(join(repoRoot, "lib/seo/sitemap-data.ts"), "utf8");
  assert.match(childRoute, /getSitemapChild/);
  assert.match(childRoute, /child sitemap must not rebuild the shard plan/);
  assert.doesNotMatch(childRoute, /getSitemapShardPlan/);
  assert.match(indexRoute, /getSitemapShardPlan/);
  assert.doesNotMatch(indexRoute, /getSitemapChild/);

  const childStart = data.indexOf("export async function getSitemapChild");
  assert.ok(childStart >= 0);
  const childFn = data.slice(childStart, data.indexOf("\nfunction ", childStart));
  assert.match(childFn, /lookupSitemapChild/);
  assert.match(childFn, /probeProfileShardPrefix/);
  assert.doesNotMatch(childFn, /createSitemapShardPlan/);
  assert.doesNotMatch(childFn, /profilePageHasRows/);
});

function lookupPages(
  firstId: number,
  first: PageProbeState,
  secondId: number,
  second: PageProbeState,
): PageProbeState[] {
  const pages: PageProbeState[] = [];
  pages[firstId] = first;
  pages[secondId] = second;
  return pages;
}
