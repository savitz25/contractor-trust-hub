import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const header = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'SiteHeader.tsx'), 'utf8');

test('My TrustHub account entry is visible on desktop, mobile, and in the drawer', () => {
  assert.equal(header.match(/const CANONICAL_ACCOUNT_HREF = "https:\/\/www\.asktrusthub\.com\/my\/sign-in"/g)?.length, 1);
  assert.equal(header.includes('ONE_ACCOUNT_PRESENTATION'), false);
  assert.equal(header.includes('MY_TRUSTHUB_ACCOUNT_HREF'), false);
  assert.equal(header.includes('https://www.asktrusthub.com/my"'), false);
  for (const path of ['header-my-trusthub"', 'header-my-trusthub-mobile"', 'header-my-trusthub-drawer"']) {
    assert.equal(header.includes(`data-entry-path="${path}`), true, path);
  }
  assert.match(header, /aria-label="My TrustHub"/);
  assert.match(header, /data-entry-path="header-my-trusthub-drawer"[\s\S]*onClick=\{\(\) => setOpen\(false\)\}/);
  assert.match(header, /e\.key === "Escape"\) setOpen\(false\)/);
});

test('local Contractor account and My Contractor stay labeled and separate', () => {
  assert.match(header, /item\.href === "\/account" && item\.label === "Account"/);
  assert.match(header, /label: "Contractor account"/);
  assert.match(header, /Optional local sign-in\. Not My TrustHub\./);
  assert.match(header, /item\.href === "\/my-contractor" && item\.label === "Saved contractors"/);
  assert.match(header, /label: "My Contractor"/);
  assert.match(header, /Local workspace on this device\./);
  assert.match(header, /MOBILE_GROUPS\.map/);
  assert.match(header, /href="\/verify"/);
});
