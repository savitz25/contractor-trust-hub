import assert from "node:assert/strict";
import test from "node:test";
import {
  leadingNonEmptyShardCount,
  nonContractorSitemapEntries,
  renderSitemapIndexXml,
} from "../lib/seo/sitemap-data";

test("the sitemap index lists only a leading run of non-empty shards", () => {
  assert.equal(leadingNonEmptyShardCount([true]), 1);
  assert.equal(leadingNonEmptyShardCount([true, true, false]), 2);
  assert.equal(leadingNonEmptyShardCount([true, false, true]), 1);
  assert.equal(leadingNonEmptyShardCount([]), 1);

  const index = renderSitemapIndexXml(1);
  assert.equal(index.match(/<loc>/g)?.length, 1);
  assert.match(index, /\/sitemap\/0\.xml/);
  assert.doesNotMatch(index, /\/sitemap\/1\.xml/);
  assert.doesNotMatch(index, /\/sitemap\/2\.xml/);
  assert.doesNotMatch(index, /\/sitemap\/3\.xml/);
});

test("non-profile sitemap URLs stay on the canonical host and under the shard cap", () => {
  const entries = nonContractorSitemapEntries();
  assert.ok(entries.length > 0);
  assert.ok(entries.length < 50_000);
  const paths = new Set<string>();
  for (const entry of entries) {
    const url = new URL(entry.loc);
    assert.equal(url.protocol, "https:");
    assert.equal(url.host, "www.contractortrusthub.com");
    paths.add(url.pathname);
  }
  assert.equal(paths.has("/account"), false);
  assert.equal(paths.has("/watch"), false);
  assert.equal(paths.has("/compare"), false);
  assert.equal(paths.has("/florida"), true);
  assert.equal(paths.has("/verify"), true);
});
