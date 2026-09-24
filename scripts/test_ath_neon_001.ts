import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("ATH-NEON-001: contractor profile uses one public-state fetch and honors cache", () => {
  const page = readFileSync("app/contractors/[slug]/page.tsx", "utf8");
  const fetchState = readFileSync("lib/business-profile/fetch-public-state.ts", "utf8");
  const profileFetch = readFileSync("lib/business-profile/fetch-public.ts", "utf8");
  const replyFetch = readFileSync("lib/business-replies/fetch-public.ts", "utf8");
  assert.match(page, /getPublicContractorState/);
  assert.doesNotMatch(page, /Promise\.all\(\[\s*getPublicBusinessProfile/);
  assert.match(fetchState, /public-state/);
  // ATH-CLAIM-V2-001R4: short shared window (first approval must not be hidden for hours), still a cache.
  assert.match(fetchState, /export const ASK_PUBLIC_REVALIDATE_S = 60;/);
  assert.match(fetchState, /revalidate: ASK_PUBLIC_REVALIDATE_S/);
  assert.match(profileFetch, /revalidate: ASK_PUBLIC_REVALIDATE_S/);
  assert.match(replyFetch, /revalidate:ASK_PUBLIC_REVALIDATE_S/);
  for (const src of [fetchState, profileFetch, replyFetch]) assert.doesNotMatch(src, /revalidate:s*21600/);
  assert.doesNotMatch(fetchState, /cache:\s*["']no-store["']/);
  assert.doesNotMatch(profileFetch, /cache:\s*["']no-store["']/);
  assert.doesNotMatch(replyFetch, /cache:\s*["']no-store["']/);
});

test("ATH-NEON-001: search cards do not prefetch contractor profiles", () => {
  const card = readFileSync("components/search/ResultCard.tsx", "utf8");
  assert.match(card, /prefetch=\{false\}/);
});
