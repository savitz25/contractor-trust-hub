import assert from "node:assert/strict";
import test from "node:test";
import { poolMaxForRuntime } from "../lib/db";

const session = "postgresql://postgres.ref:secret@aws-0-ca-central-1.pooler.supabase.com:5432/postgres";
const transaction = "postgresql://postgres.ref:secret@aws-0-ca-central-1.pooler.supabase.com:6543/postgres";

test("Vercel session pooler retains the one-client safety limit", () => {
  assert.equal(poolMaxForRuntime(session, { vercel: true, build: false, ci: false }), 1);
});

test("Vercel transaction pooler can serve two concurrent profile reads", () => {
  assert.equal(poolMaxForRuntime(transaction, { vercel: true, build: false, ci: false }), 2);
  assert.equal(poolMaxForRuntime(`${transaction}?sslmode=require`, { vercel: true, build: false, ci: false }), 2);
});

test("build and CI keep one client regardless of pooler mode", () => {
  assert.equal(poolMaxForRuntime(transaction, { vercel: true, build: true, ci: false }), 1);
  assert.equal(poolMaxForRuntime(transaction, { vercel: true, build: false, ci: true }), 1);
});

test("local development and other Vercel endpoints retain existing limits", () => {
  assert.equal(poolMaxForRuntime(session, { vercel: false, build: false, ci: false }), 5);
  assert.equal(poolMaxForRuntime("postgresql://localhost:6543/postgres", { vercel: true, build: false, ci: false }), 1);
});
