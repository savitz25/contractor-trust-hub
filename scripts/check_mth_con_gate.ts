import assert from "node:assert/strict";
import { CONTRACTOR_CANARIES, productionParentGate, gateAllows, parentSyncMode, prepareParentSave, parentStatus, type AdapterDeps } from "../lib/my-trusthub/parent-adapter";

// Run against the frozen activation head with `active`, or its actual shutoff
// child with `shutoff`. No database, signing key or network is used.
async function main() {
  const expected = process.argv[2];
  assert.ok(expected === "active" || expected === "shutoff", "specify active or shutoff");
  const active = expected === "active";
  const gate = productionParentGate();
  const slug = "ccc057187-a-r-roofing-inc";
  assert.deepEqual(gate, {broad: false, canary: active});
  assert.deepEqual(CONTRACTOR_CANARIES, [{slug, externalKey: "CCC057187"}]);
  assert.equal(gateAllows(slug, gate), active);
  for (const other of ["cgc1517216-abaco-construction-inc", "cfc1427249-a-sunny-plumbing-company", "unknown"]) assert.equal(gateAllows(other, gate), false);
  for (const flag of [undefined, "", "1"]) {
    const mode = parentSyncMode({VERCEL_ENV: "production", NEXT_PUBLIC_MY_TRUSTHUB_CONTRACTOR_SYNC: flag, MY_TRUSTHUB_CONTRACTOR_SYNC_MODE: "dry_run"});
    assert.equal(mode, active ? "gated" : "off");
    if (!active) {
      const forbidden = async (): Promise<never> => { throw new Error("Shutoff must not read, sign or send"); };
      const deps: AdapterDeps = {mode, gate, reader: {bySlug: forbidden, slugsForFloridaCredential: forbidden}, parent: forbidden, key: null, acks: {read: forbidden, record: forbidden}, now: () => { throw new Error("Shutoff must not stage"); }};
      for (const intent of ["save", "save_signin", "unsave"]) assert.deepEqual(await prepareParentSave(deps, slug, intent, "b".repeat(43)), {state: "unavailable", localCopy: "keep"});
      assert.equal(await parentStatus(deps, "r".repeat(43), "b".repeat(43)), "unavailable");
    }
  }
  console.log(`PASS: ${expected}; one-profile list preserved; broad false; browser flag cannot change server gate`);
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
