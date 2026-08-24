import assert from "node:assert/strict";
import fs from "node:fs";

const db = fs.readFileSync(new URL("../lib/db.ts", import.meta.url), "utf8");
const florida = fs.readFileSync(
  new URL("../lib/discovery/florida-list.ts", import.meta.url),
  "utf8"
);
const unavailable = fs.readFileSync(
  new URL("../app/florida/error.tsx", import.meta.url),
  "utf8"
);

assert.match(db, /Transaction pooler/);
assert.match(db, /port:  6543/);
assert.match(db, /const max = process\.env\.VERCEL \|\| isBuild \|\| process\.env\.CI \? 1 : 5/);
assert.doesNotMatch(db, /client\.query\s*\(\s*\{[^}]*name\s*:/s);
assert.doesNotMatch(db, /SET SESSION|LISTEN|NOTIFY|CREATE TEMP|TEMPORARY TABLE|pg_advisory/i);
assert.match(db, /SET LOCAL statement_timeout/);
assert.match(db, /const CONNECT_TIMEOUT_MS = 60_000/);
assert.match(db, /logDbError\("query", err, text\);\s+throw err/);
assert.doesNotMatch(db, /query_retry|retryDelayMs/);
assert.doesNotMatch(florida, /listFloridaBrowse failed:[\s\S]{0,160}return empty/);
assert.doesNotMatch(florida, /listFloridaCities failed:[\s\S]{0,160}return \[\]/);
assert.match(unavailable, /data-discovery-state="temporarily-unavailable"/);
assert.match(unavailable, /not a verified zero-result search/);

console.log("serverless DB assertions: PASS");
