import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MY_TRUSTHUB_ACCOUNT_HREF, ONE_ACCOUNT_PRESENTATION } from "../lib/my-trusthub/one-account";
import { CONTRACTOR_CANARY_ACTIVE, CONTRACTOR_PARENT_SYNC_BROAD, productionParentGate } from "../lib/my-trusthub/parent-adapter";

const HREF = "https://www.asktrusthub.com/my";

function region(text: string, start: string, end: string): string {
  const i = text.indexOf(start);
  const j = text.indexOf(end, i + start.length);
  assert.ok(i >= 0 && j > i, `${start} -> ${end}`);
  return text.slice(i, j);
}

test("neutral My TrustHub link is in desktop, mobile header, and mobile drawer", () => {
  assert.equal(process.env.NEXT_PUBLIC_MY_TRUSTHUB_ONE_ACCOUNT, undefined);
  assert.equal(ONE_ACCOUNT_PRESENTATION, false);
  assert.equal(MY_TRUSTHUB_ACCOUNT_HREF, HREF);
  const header = readFileSync("components/layout/SiteHeader.tsx", "utf8");
  const desktop = region(header, 'className="th-header-actions"', 'className="th-header-mobile-actions"');
  const mobile = region(header, 'className="th-header-mobile-actions"', "{open ?");
  const drawer = region(header, 'role="dialog"', 'variant="embedded"');
  for (const [name, block] of [["desktop", desktop], ["mobile-header", mobile], ["drawer", drawer]] as const) {
    assert.equal(block.split('data-mth-neutral-account="true"').length - 1, 1, name);
    assert.match(block, /href=\{MY_TRUSTHUB_ACCOUNT_HREF\}/, name);
    assert.doesNotMatch(block, /Sign up|Sign in|public signup|cross-hub/i, name);
  }
  assert.match(desktop, /ONE_ACCOUNT_PRESENTATION \? \(/);
  assert.match(desktop, /data-entry-path="header-my-trusthub"/);
  assert.match(desktop, /data-mth-neutral-account="true"[\s\S]*?>\s*My TrustHub\s*</);
  assert.match(mobile, /aria-label="My TrustHub"/);
  assert.match(mobile, /className="th-btn-icon"/);
  assert.match(drawer, /data-mth-neutral-account="true"[\s\S]*?>\s*My TrustHub\s*</);
  assert.match(drawer, /className="th-drawer-link"/);
  assert.equal(header.split('data-mth-neutral-account="true"').length - 1, 3);
  assert.equal(header.split("href={MY_TRUSTHUB_ACCOUNT_HREF}").length - 1, 4);
});

test("contractor account routes and parent sync stay closed", () => {
  assert.equal(CONTRACTOR_PARENT_SYNC_BROAD, false);
  assert.equal(CONTRACTOR_CANARY_ACTIVE, false);
  assert.deepEqual(productionParentGate(), { broad: false, canary: false });
  const account = readFileSync("lib/my-trusthub/one-account.ts", "utf8");
  assert.match(account, /export const ONE_ACCOUNT_PRESENTATION = process\.env\.NEXT_PUBLIC_MY_TRUSTHUB_ONE_ACCOUNT === "1"/);
  const nav = readFileSync("lib/nav/header-nav.ts", "utf8");
  assert.match(nav, /href: MY_CONTRACTOR_PATH/);
  assert.match(nav, /href: "\/account"/);
  assert.match(readFileSync("app/account/page.tsx", "utf8"), /AccountClient/);
  assert.match(readFileSync("app/my-contractor/page.tsx", "utf8"), /\/my-contractor/);
});
