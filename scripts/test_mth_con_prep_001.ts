import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

// Device storage shim, installed before the store is used. Any network call fails the test.
const device = new Map<string, string>();
const g = globalThis as unknown as Record<string, unknown>;
g.window = Object.assign(new EventTarget(), {});
g.localStorage = {
  getItem: (k: string) => device.get(k) ?? null,
  setItem: (k: string, v: string) => { device.set(k, v); },
  removeItem: (k: string) => { device.delete(k); },
};
g.Event = Event;
let networkCalls = 0;
g.fetch = async () => { networkCalls++; throw new Error("no network in a device Save"); };

import { SAVED_STORAGE_KEY, isContractorSaved, listSavedContractors, saveContractor, unsaveContractor } from "../lib/saved/store";
import { PROJECTS_KEY, isWatching, listWatches, watchContractor } from "../lib/projects/store";
import { PARENT_READY_CREDENTIAL_SOURCES, bindingMatchesIdentity, deviceSaveAllowed, parentSaveReadiness } from "../lib/my-trusthub/profile-identity";
import { DISABLED_PARENT_PORT, nextSyncState, parentSyncMode, planSync } from "../lib/my-trusthub/parent-adapter";
import { MY_TRUSTHUB_ACCOUNT_HREF, ONE_ACCOUNT_PRESENTATION, workspaceSyncCopy } from "../lib/my-trusthub/one-account";
import type { ContractorDetail, LicenseDetail } from "../lib/contractors/types";

const ID = "0001ac38-0c96-4e2f-8bf6-9ab243f7b79b";
const license = (sourceSystem: string, externalKey: string, state: string | null = "FL"): LicenseDetail => ({
  id: "l-" + externalKey, externalKey, occupationCode: "CCC", licenseNumber: externalKey.replace(/\D/g, ""), statusNormalized: null, primaryStatus: null, secondaryStatus: null,
  originalLicensureDate: null, effectiveDate: null, expirationDate: null, addressLine1: null, city: null, state, postalCode: null, countyName: null, boardNumber: null,
  lastVerifiedAt: null, sourceSystem });
const contractor = (patch: Partial<ContractorDetail> = {}): ContractorDetail => ({
  id: ID, slug: "acme-roofing-inc-ccc1332036", displayName: "Acme Roofing Inc", legalName: "ACME ROOFING INC", dbaName: null, primaryCity: null, primaryCounty: null,
  homeState: "FL", isThinProfile: false, licenses: [license("fl_dbpr", "CCC1332036")], entities: [], discipline: [], ...patch });

test("device Save toggle: Save -> Saved -> Save -> Saved, one row, no network", () => {
  device.clear(); networkCalls = 0;
  const slug = "acme-roofing-inc-ccc1332036";
  assert.equal(isContractorSaved(slug), false);
  const first = saveContractor({ slug, name: "Acme Roofing Inc", profileId: ID });
  assert.equal(isContractorSaved(slug), true);
  assert.deepEqual({ ...first, savedAt: "" }, { slug, name: "Acme Roofing Inc", profileId: ID, profileClass: "contractor_profile", savedAt: "", sync: "device" });
  unsaveContractor(slug);
  assert.equal(isContractorSaved(slug), false); assert.deepEqual(listSavedContractors(), []);
  saveContractor({ slug, name: "Acme Roofing Inc", profileId: ID });
  // Repeated Save is idempotent: the existing row is kept, never duplicated.
  const again = saveContractor({ slug, name: "Acme Roofing Inc (again)", profileId: ID });
  assert.equal(listSavedContractors().length, 1); assert.equal(again?.name, "Acme Roofing Inc");
  // Unsave of something not saved, and malformed slugs, change nothing.
  unsaveContractor("not-saved"); assert.equal(saveContractor({ slug: "../x", name: "x" }), null); assert.equal(saveContractor({ slug: "Has Space", name: "x" }), null);
  assert.equal(listSavedContractors().length, 1);
  // Duplicates or junk already in storage are not surfaced twice.
  device.set(SAVED_STORAGE_KEY, JSON.stringify([listSavedContractors()[0], listSavedContractors()[0], { slug: 7 }, null]));
  assert.equal(listSavedContractors().length, 1);
  assert.equal(networkCalls, 0);
});

test("Save is not Watch: neither store touches the other", () => {
  device.clear();
  watchContractor({ slug: "watched-co", name: "Watched Co", licenseKey: "CGC1", licenseStatus: "active" });
  const watchesBefore = device.get(PROJECTS_KEY);
  saveContractor({ slug: "acme-roofing-inc-ccc1332036", name: "Acme Roofing Inc", profileId: ID });
  unsaveContractor("acme-roofing-inc-ccc1332036");
  saveContractor({ slug: "acme-roofing-inc-ccc1332036", name: "Acme Roofing Inc", profileId: ID });
  assert.equal(device.get(PROJECTS_KEY), watchesBefore, "the watch/projects store is byte-for-byte unchanged by Save and Unsave");
  assert.equal(isWatching("acme-roofing-inc-ccc1332036"), false); assert.equal(listWatches().length, 1);
  // And a Watch does not create a Save.
  assert.equal(isContractorSaved("watched-co"), false);
  for (const file of ["lib/saved/store.ts", "components/contractor/SaveContractorToggle.tsx", "components/saved/SavedContractorsClient.tsx"]) {
    const source = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(source, /from "@\/lib\/projects\/store"|watchContractor|unwatchContractor|fetch\(/, file);
  }
});

test("the Trust Report Save control is one toggle with pressed-state semantics and no separate Unsave", () => {
  const toggle = fs.readFileSync("components/contractor/SaveContractorToggle.tsx", "utf8");
  assert.equal(toggle.split("<button").length - 1, 1);
  assert.match(toggle, /aria-pressed=\{mounted \? saved : undefined\}/);
  assert.match(toggle, /\{saved \? "Saved" : "Save"\}/);
  assert.doesNotMatch(toggle, />\s*Unsave\s*</);
  assert.match(toggle, /onClick=\{toggle\}/);
  const page = fs.readFileSync("app/contractors/[slug]/page.tsx", "utf8");
  assert.match(page, /deviceSaveAllowed\(contractor\) \? \(\s*<SaveContractorToggle slug=\{contractor\.slug\} name=\{contractor\.displayName\} profileId=\{contractor\.id\} \/>/);
  // The credential detail page (a different identity grain) has no Save control.
  assert.doesNotMatch(fs.readFileSync("app/credentials/[id]/page.tsx", "utf8"), /SaveContractorToggle/);
  // Compare and Watch controls are still wired on the Trust Report.
  assert.match(page, /<CompareToggle slug=\{contractor\.slug\} \/>/); assert.match(page, /<TrustReportActions/);
  // Exactly one control on the profile reads Save: the compare shortlist toggle
  // (previously also labelled Save / Saved) now reads Compare / Comparing. Its
  // behaviour and storage are untouched.
  const compare = fs.readFileSync("components/compare/CompareToggle.tsx", "utf8");
  assert.match(compare, /\{selected \? "Comparing" : full \? "Compare full" : "Compare"\}/);
  assert.doesNotMatch(compare, /"Saved"|: "Save"\}/);
  assert.match(compare, /toggleCompareSlug\(slug\)/);
});

test("profile classes: device Save only for exact, non-thin Trust Reports", () => {
  assert.equal(deviceSaveAllowed(contractor()), true);
  assert.equal(deviceSaveAllowed(contractor({ isThinProfile: true })), false);
  assert.equal(deviceSaveAllowed(contractor({ id: "" })), false);
  assert.equal(deviceSaveAllowed(contractor({ id: "acme-roofing" })), false);
  assert.equal(deviceSaveAllowed(contractor({ slug: "" })), false);
  // A profile outside the reviewed parent sources is still device-saveable.
  assert.equal(deviceSaveAllowed(contractor({ homeState: "CA", licenses: [license("ca_cslb", "1012345", "CA")] })), true);
});

test("parent readiness: exact identity for reviewed credential sources, fail closed otherwise", () => {
  const ready = parentSaveReadiness(contractor({ licenses: [license("fl_dbpr", "CGC1500001"), license("fl_dbpr", "CCC1332036"), license("fl_dbpr", "CCC1332036")] }));
  assert.deepEqual(ready, { ready: true, identity: { hub: "contractor", profileClass: "contractor_profile", nativeId: ID, canonicalSlug: "acme-roofing-inc-ccc1332036",
    returnPath: "/contractors/acme-roofing-inc-ccc1332036", credentials: [
      { namespace: "fl.dbpr.license", jurisdiction: "FL", sourceSystem: "fl_dbpr", externalKey: "CCC1332036" },
      { namespace: "fl.dbpr.license", jurisdiction: "FL", sourceSystem: "fl_dbpr", externalKey: "CGC1500001" }] } });
  const nj = parentSaveReadiness(contractor({ homeState: "NJ", licenses: [license("nj_dca", "13VH01234500", "NJ")] }));
  assert.equal(nj.ready && nj.identity.credentials[0]!.namespace, "nj.dca.license");
  assert.deepEqual(Object.keys(PARENT_READY_CREDENTIAL_SOURCES), ["FL", "NJ"]);
  const not = (patch: Partial<ContractorDetail>) => { const r = parentSaveReadiness(contractor(patch)); return r.ready ? "ready" : r.reason; };
  assert.equal(not({ isThinProfile: true }), "thin_profile");
  assert.equal(not({ id: "" }), "missing_profile_id");
  assert.equal(not({ id: "Acme Roofing Inc" }), "missing_profile_id");
  assert.equal(not({ slug: "" }), "missing_slug");
  assert.equal(not({ licenses: [] }), "no_reviewed_credential");
  // Sources not yet reviewed, entity-only evidence, blank or malformed keys: not parent-ready.
  for (const source of ["ca_cslb", "tx_tdlr", "wa_lni", "az_roc", "or_ccb", "co_dora", "la_lslbc", "ms_sbc", "ky_dhbc", "fl_sunbiz"])
    assert.equal(not({ licenses: [license(source, "X123", null)] }), "no_reviewed_credential", source);
  assert.equal(not({ licenses: [license("fl_dbpr", "   ")] }), "no_reviewed_credential");
  assert.equal(not({ licenses: [license("fl_dbpr", "CCC 1332036 ; drop")] }), "no_reviewed_credential");
  // Reviewed credentials in two jurisdictions: unresolved, never guessed.
  assert.equal(not({ licenses: [license("fl_dbpr", "CCC1332036"), license("nj_dca", "13VH01234500", "NJ")] }), "ambiguous_jurisdiction");
});

test("a parent binding matches only on the exact grain", () => {
  const r = parentSaveReadiness(contractor()); assert.ok(r.ready); if (!r.ready) return;
  const binding = { hub: "contractor", specialistEntityType: "contractor_profile", specialistEntityId: ID, identifierNamespace: "fl.dbpr.license", sourceIdentifier: "CCC1332036", jurisdiction: "FL", status: "accepted" };
  assert.equal(bindingMatchesIdentity(r.identity, binding), true);
  for (const patch of [{ status: "review_required" }, { status: "superseded" }, { hub: "move" }, { specialistEntityType: "mover" }, { specialistEntityId: "11111111-1111-4111-8111-111111111111" },
    { specialistEntityId: "acme-roofing-inc-ccc1332036" }, { identifierNamespace: "nj.dca.license" }, { sourceIdentifier: "CCC0000000" }, { sourceIdentifier: "Acme Roofing Inc" }, { jurisdiction: "NJ" }, { jurisdiction: null }])
    assert.equal(bindingMatchesIdentity(r.identity, { ...binding, ...patch }), false, JSON.stringify(patch));
});

test("parent sync is OFF: no environment turns it on, nothing is staged, a Save stays device-only", async () => {
  for (const env of [{}, { MY_TRUSTHUB_CONTRACTOR_SAVE_ENABLED: "true" }, { NEXT_PUBLIC_MY_TRUSTHUB_ONE_ACCOUNT: "1" }, { MY_TRUSTHUB_CONTRACTOR_PARENT_SYNC_MODE: "production" }, { VERCEL_ENV: "production" }])
    assert.equal(parentSyncMode(env), "off");
  const r = parentSaveReadiness(contractor()); assert.ok(r.ready); if (!r.ready) return;
  assert.deepEqual(planSync({ mode: parentSyncMode(), onCanonicalProfile: true, identity: r.identity, intent: "save" }), { kind: "device_only", reason: "sync_off" });
  assert.deepEqual(planSync({ mode: parentSyncMode(), onCanonicalProfile: true, identity: r.identity, intent: "unsave" }), { kind: "device_only", reason: "sync_off" });
  assert.equal(await DISABLED_PARENT_PORT.resolvePublication(r.identity), null);
  assert.equal(await DISABLED_PARENT_PORT.acceptedBinding(r.identity), null);
  assert.equal(await DISABLED_PARENT_PORT.stage(r.identity, "save"), null);
  assert.equal(await DISABLED_PARENT_PORT.acknowledged("t".repeat(43)), false);
  // Acknowledgement rules the future runtime must keep: only a confirmed outcome changes the account belief.
  assert.equal(nextSyncState("device", "save", "confirmed"), "synced");
  assert.equal(nextSyncState("device", "save", "not_confirmed"), "device");
  assert.equal(nextSyncState("device", "save", "unknown"), "pending");
  assert.equal(nextSyncState("synced", "unsave", "confirmed"), "device");
  assert.equal(nextSyncState("synced", "unsave", "not_confirmed"), "synced");
  assert.equal(nextSyncState("synced", "unsave", "unknown"), "synced");
  // The adapter prep contains no transport, origin, secret or request.
  const adapter = fs.readFileSync("lib/my-trusthub/parent-adapter.ts", "utf8") + fs.readFileSync("lib/my-trusthub/profile-identity.ts", "utf8");
  assert.doesNotMatch(adapter, /fetch\(|https?:\/\/|process\.env\.[A-Z_]*SECRET|Authorization/);
});

test("one-account presentation is prepared and off by default; existing surfaces are not removed", () => {
  assert.equal(ONE_ACCOUNT_PRESENTATION, false);
  assert.equal(MY_TRUSTHUB_ACCOUNT_HREF, "https://www.asktrusthub.com/my");
  assert.equal(workspaceSyncCopy(false).linkLabel, "Optional account");
  assert.doesNotMatch(JSON.stringify(workspaceSyncCopy(true)), /account/i);
  for (const route of ["app/account/page.tsx", "app/watch/page.tsx", "app/projects/page.tsx", "app/compare/page.tsx", "app/passport/page.tsx", "app/tools/page.tsx", "app/my-contractor/page.tsx",
    "app/api/auth/request-link/route.ts", "app/api/account/sync/route.ts", "app/api/account/import-local/route.ts"]) assert.ok(fs.existsSync(route), route);
  const header = fs.readFileSync("components/layout/SiteHeader.tsx", "utf8");
  assert.match(header, /\{ONE_ACCOUNT_PRESENTATION \? \(\s*<a\s+href=\{MY_TRUSTHUB_ACCOUNT_HREF\}/);
  // The legacy single-profile hand-off control is untouched and still behind its own flag.
  assert.match(fs.readFileSync("components/contractor/MyTrustHubSave.tsx", "utf8"), /MY_TRUSTHUB_CONTRACTOR_SAVE_ENABLED !== "true"/);
});
