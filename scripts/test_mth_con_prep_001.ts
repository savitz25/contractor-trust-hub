import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import fs from "node:fs";
import test from "node:test";

// Device storage shim, installed before the stores are used. Any network call fails the test.
const device = new Map<string, string>();
const g = globalThis as unknown as Record<string, unknown>;
g.window = Object.assign(new EventTarget(), {});
const storage = {
  getItem: (k: string) => device.get(k) ?? null,
  setItem: (k: string, v: string) => { device.set(k, v); },
  removeItem: (k: string) => { device.delete(k); },
};
g.localStorage = storage;
g.Event = Event;
let networkCalls = 0;
g.fetch = async () => { networkCalls++; throw new Error("no network in a device Save"); };

import { SAVED_STORAGE_KEY, isContractorSaved, listSavedContractors, saveContractor, unsaveContractor } from "../lib/saved/store";
import { PROJECTS_KEY, isWatching, listWatches, watchContractor } from "../lib/projects/store";
import { FL_DBPR, bindingMatchesIdentity, deviceSaveAllowed, isFloridaIdentityInput, parentSaveReadiness } from "../lib/my-trusthub/profile-identity";
import { resolveByIdentity, resolveBySlug, type ProfileReader } from "../lib/my-trusthub/publication";
import { MANIFEST_VERSION, buildManifest, isManifest, manifestBytes, manifestDigest, manifestSigningKey, signManifest, verifyManifest, type SaveManifest } from "../lib/my-trusthub/manifest";
import { DISABLED_PARENT_PORT, PARENT_FORM_TARGET, parentStatus, parentSyncMode, prepareParentSave, type AdapterDeps, type ContractorParentPort, type ParentSyncMode } from "../lib/my-trusthub/parent-adapter";
import { COOKIE_NAME, ENDPOINT_PATH, handleContractorProfileSave } from "../lib/my-trusthub/profile-save-http";
import { handoffTargetAllowed, parentSync, resumeDirect, startDirect, type DirectPorts } from "../lib/my-trusthub/direct-save-client";
import { MY_TRUSTHUB_ACCOUNT_HREF, ONE_ACCOUNT_PRESENTATION, workspaceSyncCopy } from "../lib/my-trusthub/one-account";
import type { ContractorDetail, LicenseDetail } from "../lib/contractors/types";

const UUID = "0001ac38-0c96-4e2f-8bf6-9ab243f7b79b";
const license = (sourceSystem: string, externalKey: string, state: string | null = "FL"): LicenseDetail => ({
  id: "l-" + externalKey, externalKey, occupationCode: externalKey.replace(/\d/g, ""), licenseNumber: externalKey.replace(/\D/g, ""), statusNormalized: null, primaryStatus: null, secondaryStatus: null,
  originalLicensureDate: null, effectiveDate: null, expirationDate: null, addressLine1: null, city: null, state, postalCode: null, countyName: null, boardNumber: null,
  lastVerifiedAt: null, sourceSystem });
const contractor = (patch: Partial<ContractorDetail> = {}): ContractorDetail => ({
  id: UUID, slug: "ccc057187-a-r-roofing-inc", displayName: "A & R ROOFING INC", legalName: "A & R ROOFING INC", dbaName: null, primaryCity: null, primaryCounty: null,
  homeState: "FL", isThinProfile: false, licenses: [license("fl_dbpr", "CCC057187")], entities: [], discipline: [], ...patch });

// Fixture publication source: the profiles the Trust Report read would return.
const PROFILES: ContractorDetail[] = [
  contractor(),
  contractor({ id: "11111111-1111-4111-8111-111111111111", slug: "cfc1427249-a-sunny-plumbing-company", displayName: "A SUNNY PLUMBING COMPANY", licenses: [license("fl_dbpr", "CFC1427249")] }),
  contractor({ id: "22222222-2222-4222-8222-222222222222", slug: "cgc1506243-abs-contracting-inc", displayName: "ABS CONTRACTING INC", licenses: [license("fl_dbpr", "CGC1506243")] }),
  contractor({ id: "33333333-3333-4333-8333-333333333333", slug: "fixture-no-credential", licenses: [] }),
  contractor({ id: "44444444-4444-4444-8444-444444444444", slug: "fixture-thin", isThinProfile: true, licenses: [license("fl_dbpr", "CRC1330009")] }),
  contractor({ id: "55555555-5555-4555-8555-555555555555", slug: "fixture-nj", homeState: "NJ", licenses: [license("nj_dca", "13VH01234500", "NJ")] }),
  contractor({ id: "66666666-6666-4666-8666-666666666666", slug: "fixture-ca", homeState: "CA", licenses: [license("ca_cslb", "1012345", "CA")] }),
  contractor({ id: "77777777-7777-4777-8777-777777777777", slug: "fixture-fl-and-nj", licenses: [license("fl_dbpr", "CGC1500001"), license("nj_dca", "13VH09999900", "NJ")] }),
  contractor({ id: "88888888-8888-4888-8888-888888888888", slug: "fixture-two-fl-licenses", licenses: [license("fl_dbpr", "CGC1500002"), license("fl_dbpr", "CCC1300002")] }),
  contractor({ id: "99999999-9999-4999-8999-999999999999", slug: "fixture-shared-key-a", licenses: [license("fl_dbpr", "CBC1250003")] }),
  contractor({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", slug: "fixture-shared-key-b", licenses: [license("fl_dbpr", "CBC1250003")] }),
  contractor({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", slug: "fixture-bad-key", licenses: [license("fl_dbpr", "CCC 13 ; drop")] }),
];
function source(rows = PROFILES) {
  const reads: string[] = [];
  const reader: ProfileReader = {
    bySlug: async (slug) => { reads.push("slug:" + slug); return rows.find((row) => row.slug === slug) ?? null; },
    slugsForFloridaCredential: async (key) => { reads.push("key:" + key); return rows.filter((row) => row.licenses.some((l) => l.sourceSystem === "fl_dbpr" && l.externalKey === key)).map((row) => row.slug).slice(0, 3); },
  };
  return { reader, reads };
}
const keys = () => { const pair = generateKeyPairSync("ed25519"); return {
  priv: { kid: "contractor-test", pem: pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString() },
  pub: { kid: "contractor-test", pem: pair.publicKey.export({ type: "spki", format: "pem" }).toString() } }; };
const BROWSER = "b".repeat(43);
const IDENTITY = { hub: "contractor", profileClass: "contractor_profile", identifierNamespace: "fl.dbpr.license", sourceIdentifier: "CCC057187", jurisdiction: "FL",
  canonicalSlug: "ccc057187-a-r-roofing-inc", returnPath: "/contractors/ccc057187-a-r-roofing-inc" } as const;
const deps = (mode: ParentSyncMode, patch: Partial<AdapterDeps> = {}): AdapterDeps => ({ mode, reader: source().reader, key: null, port: DISABLED_PARENT_PORT, now: Date.now, ...patch });

test("F/G/H. device Save toggle: Save -> Saved -> Save -> Saved, one row, no network", () => {
  device.clear(); networkCalls = 0;
  const slug = "ccc057187-a-r-roofing-inc";
  assert.equal(isContractorSaved(slug), false);
  const first = saveContractor({ slug, name: "A & R ROOFING INC", profileId: UUID });
  assert.equal(isContractorSaved(slug), true);
  assert.deepEqual({ ...first, savedAt: "" }, { slug, name: "A & R ROOFING INC", profileId: UUID, profileClass: "contractor_profile", savedAt: "", sync: "device" });
  unsaveContractor(slug);
  assert.equal(isContractorSaved(slug), false); assert.deepEqual(listSavedContractors(), []);
  saveContractor({ slug, name: "A & R ROOFING INC", profileId: UUID });
  const again = saveContractor({ slug, name: "renamed", profileId: UUID });
  assert.equal(listSavedContractors().length, 1); assert.equal(again?.name, "A & R ROOFING INC");
  unsaveContractor("not-saved"); assert.equal(saveContractor({ slug: "../x", name: "x" }), null); assert.equal(saveContractor({ slug: "Has Space", name: "x" }), null);
  assert.equal(listSavedContractors().length, 1);
  device.set(SAVED_STORAGE_KEY, JSON.stringify([listSavedContractors()[0], listSavedContractors()[0], { slug: 7 }, null]));
  assert.equal(listSavedContractors().length, 1);
  assert.equal(networkCalls, 0);
});

test("I. Save is not Watch: neither store touches the other", () => {
  device.clear();
  watchContractor({ slug: "watched-co", name: "Watched Co", licenseKey: "CGC1", licenseStatus: "active" });
  const watchesBefore = device.get(PROJECTS_KEY);
  saveContractor({ slug: "ccc057187-a-r-roofing-inc", name: "A & R ROOFING INC", profileId: UUID });
  unsaveContractor("ccc057187-a-r-roofing-inc");
  saveContractor({ slug: "ccc057187-a-r-roofing-inc", name: "A & R ROOFING INC", profileId: UUID });
  assert.equal(device.get(PROJECTS_KEY), watchesBefore, "the watch/projects store is byte-for-byte unchanged by Save and Unsave");
  assert.equal(isWatching("ccc057187-a-r-roofing-inc"), false); assert.equal(listWatches().length, 1);
  assert.equal(isContractorSaved("watched-co"), false);
  for (const file of ["lib/saved/store.ts", "components/contractor/SaveContractorToggle.tsx", "components/saved/SavedContractorsClient.tsx", "lib/my-trusthub/direct-save-client.ts",
    "lib/my-trusthub/parent-adapter.ts", "lib/my-trusthub/manifest.ts", "lib/my-trusthub/publication.ts", "lib/my-trusthub/profile-save-http.ts"]) {
    assert.doesNotMatch(fs.readFileSync(file, "utf8"), /from "@\/lib\/projects\/store"|watchContractor|unwatchContractor|consumer_watch/, file);
  }
});

test("J/K. one toggle on the Trust Report; Compare, Watch and My Contractor are unchanged", () => {
  const toggle = fs.readFileSync("components/contractor/SaveContractorToggle.tsx", "utf8");
  assert.equal(toggle.split("<button").length - 1, 1);
  assert.match(toggle, /aria-pressed=\{mounted \? saved : undefined\}/);
  assert.match(toggle, /\{saved \? "Saved" : "Save"\}/);
  assert.doesNotMatch(toggle, />\s*Unsave\s*<|Keep this in My TrustHub|Confirm Save/);
  // Parent sync UI is off unless the build flag is set, and only on the canonical profile of an eligible profile.
  assert.match(toggle, /PARENT_SYNC_UI = process\.env\.NEXT_PUBLIC_MY_TRUSTHUB_CONTRACTOR_SYNC === "1"/);
  assert.match(toggle, /const direct = PARENT_SYNC_UI && syncEligible && pathname === "\/contractors\/" \+ slug/);
  // Device change always precedes any hand-off.
  assert.ok(toggle.indexOf("saveContractor({ slug, name, profileId })") < toggle.indexOf('await handOff("save")'));
  assert.ok(toggle.indexOf("unsaveContractor(slug);") < toggle.indexOf('await handOff("unsave")'));
  const page = fs.readFileSync("app/contractors/[slug]/page.tsx", "utf8");
  assert.match(page, /deviceSaveAllowed\(contractor\) \? \(\s*<SaveContractorToggle slug=\{contractor\.slug\} name=\{contractor\.displayName\} profileId=\{contractor\.id\} syncEligible=\{parentSaveReadiness\(contractor\)\.ready\} \/>/);
  assert.doesNotMatch(fs.readFileSync("app/credentials/[id]/page.tsx", "utf8"), /SaveContractorToggle/);
  assert.match(page, /<CompareToggle slug=\{contractor\.slug\} \/>/); assert.match(page, /<TrustReportActions/);
  const compare = fs.readFileSync("components/compare/CompareToggle.tsx", "utf8");
  assert.match(compare, /\{selected \? "Comparing" : full \? "Compare full" : "Compare"\}/); assert.match(compare, /toggleCompareSlug\(slug\)/);
  assert.match(fs.readFileSync("components/projects/WatchButton.tsx", "utf8"), /\{watching \? "Watching" : "Watch this contractor"\}/);
  const workspace = fs.readFileSync("app/my-contractor/page.tsx", "utf8");
  for (const href of ["/watch", "/compare", "/projects", "/passport", "/property", "/verify", "/tools"]) assert.ok(workspace.includes(`href: "${href}"`), href);
  assert.match(workspace, /<SavedContractorsClient \/>/);
});

test("identity: Florida DBPR license key is the native identity; the contractor UUID never is", () => {
  const ready = parentSaveReadiness(contractor());
  assert.deepEqual(ready, { ready: true, identity: IDENTITY });
  // The UUID changing (a re-ingest) does not change the identity at all.
  assert.deepEqual(parentSaveReadiness(contractor({ id: "ffffffff-ffff-4fff-8fff-ffffffffffff" })), ready);
  assert.doesNotMatch(JSON.stringify(ready), new RegExp(UUID));
  assert.deepEqual(FL_DBPR, { sourceSystem: "fl_dbpr", namespace: "fl.dbpr.license", jurisdiction: "FL" });
  const not = (patch: Partial<ContractorDetail>) => { const r = parentSaveReadiness(contractor(patch)); return r.ready ? "ready" : r.reason; };
  assert.equal(not({ licenses: [] }), "no_fl_dbpr_credential");                                    // B
  assert.equal(not({ isThinProfile: true }), "thin_profile");                                       // C
  assert.equal(not({ homeState: "NJ", licenses: [license("nj_dca", "13VH01234500", "NJ")] }), "not_florida");  // D wrong state
  assert.equal(not({ homeState: null }), "not_florida");
  for (const other of ["nj_dca", "ca_cslb", "tx_tdlr", "tx_tsbpe", "wa_lni", "az_roc", "or_ccb", "co_dora", "la_lslbc", "ms_sbc", "ky_dhbc"])
    assert.equal(not({ licenses: [license(other, "X12345", null)] }), "multi_jurisdiction", other);  // D wrong source
  assert.equal(not({ licenses: [license("fl_dbpr", "CGC1500001"), license("nj_dca", "13VH09999900", "NJ")] }), "multi_jurisdiction");  // E
  assert.equal(not({ licenses: [license("fl_dbpr", "CGC1500002"), license("fl_dbpr", "CCC1300002")] }), "multiple_fl_credentials");
  assert.equal(not({ licenses: [license("fl_dbpr", "CCC 13 ; drop")] }), "invalid_credential_key");
  assert.equal(not({ licenses: [license("fl_dbpr", "   ")] }), "invalid_credential_key");
  assert.equal(not({ slug: "" }), "missing_slug");
  // The same key listed twice is one credential.
  assert.equal(not({ licenses: [license("fl_dbpr", "CCC057187"), license("fl_dbpr", "CCC057187")] }), "ready");
  // Device Save is wider than parent readiness: real non-thin Trust Reports only.
  assert.equal(deviceSaveAllowed(contractor({ homeState: "CA", licenses: [license("ca_cslb", "1012345", "CA")] })), true);
  assert.equal(deviceSaveAllowed(contractor({ isThinProfile: true })), false);
  const binding = { hub: "contractor", specialistEntityType: "contractor_profile", identifierNamespace: "fl.dbpr.license", sourceIdentifier: "CCC057187", jurisdiction: "FL", status: "accepted" };
  assert.equal(bindingMatchesIdentity(IDENTITY, binding), true);
  for (const patch of [{ status: "review_required" }, { hub: "move" }, { specialistEntityType: "mover" }, { identifierNamespace: "nj.dca.license" }, { sourceIdentifier: "CCC0000000" },
    { sourceIdentifier: "A & R ROOFING INC" }, { sourceIdentifier: UUID }, { jurisdiction: "NJ" }, { jurisdiction: null }])
    assert.equal(bindingMatchesIdentity(IDENTITY, { ...binding, ...patch }), false, JSON.stringify(patch));
});

test("A–E. publication: exact slug in, exact credential identity out; everything else is device only", async () => {
  const { reader, reads } = source();
  assert.deepEqual(await resolveBySlug(reader, "ccc057187-a-r-roofing-inc"), { eligible: true, identity: IDENTITY });                         // A
  for (const [slug, key] of [["cfc1427249-a-sunny-plumbing-company", "CFC1427249"], ["cgc1506243-abs-contracting-inc", "CGC1506243"]] as const) {
    const r = await resolveBySlug(reader, slug); assert.equal(r.eligible && r.identity.sourceIdentifier, key); assert.equal(r.eligible && r.identity.returnPath, "/contractors/" + slug);
  }
  const reason = async (slug: unknown) => { const r = await resolveBySlug(reader, slug); return r.eligible ? "eligible" : r.reason; };
  assert.equal(await reason("fixture-no-credential"), "no_fl_dbpr_credential");   // B
  assert.equal(await reason("fixture-thin"), "thin_profile");                     // C
  assert.equal(await reason("fixture-nj"), "not_florida");                        // D
  assert.equal(await reason("fixture-ca"), "not_florida");                        // D
  assert.equal(await reason("fixture-fl-and-nj"), "multi_jurisdiction");          // E
  assert.equal(await reason("fixture-two-fl-licenses"), "multiple_fl_credentials");
  assert.equal(await reason("fixture-shared-key-a"), "credential_not_unique");
  assert.equal(await reason("fixture-bad-key"), "invalid_credential_key");
  assert.equal(await reason("no-such-contractor"), "not_public");
  reads.length = 0;
  for (const bad of ["A & R ROOFING INC", "CCC057187", UUID.toUpperCase(), "../ccc057187-a-r-roofing-inc", "ccc057187-a-r-roofing-inc?x=1", "", null, 7, { slug: "x" }])
    assert.equal(await reason(bad), "missing_slug", String(bad));
  assert.deepEqual(reads, [], "malformed input never reaches the source");
  // An alias that resolves to a different canonical slug is not the profile.
  const alias: ProfileReader = { ...reader, bySlug: async () => contractor({ slug: "some-other-canonical-slug" }) };
  assert.deepEqual(await resolveBySlug(alias, "ccc057187-a-r-roofing-inc"), { eligible: false, reason: "not_public" });
  const down: ProfileReader = { bySlug: async () => { throw new Error("db"); }, slugsForFloridaCredential: async () => [] };
  assert.deepEqual(await resolveBySlug(down, "ccc057187-a-r-roofing-inc"), { eligible: false, reason: "source_unavailable" });
  // The parent's re-check takes the exact credential identity and nothing else.
  const asked = { hub: "contractor", profileClass: "contractor_profile", identifierNamespace: "fl.dbpr.license", sourceIdentifier: "CCC057187", jurisdiction: "FL" };
  assert.deepEqual(await resolveByIdentity(reader, asked), IDENTITY);
  for (const bad of [{ ...asked, sourceIdentifier: "CBC1250003" }, { ...asked, sourceIdentifier: "CCC9999999" }, { ...asked, sourceIdentifier: "A & R ROOFING INC" }, { ...asked, sourceIdentifier: UUID },
    { ...asked, jurisdiction: "NJ" }, { ...asked, identifierNamespace: "nj.dca.license" }, { ...asked, profileClass: "standalone_credential" }, { ...asked, hub: "move" },
    { ...asked, contractorId: UUID }, { ...asked, slug: "ccc057187-a-r-roofing-inc" }, "CCC057187", null])
    assert.equal(await resolveByIdentity(reader, bad), null, JSON.stringify(bad));
  assert.equal(isFloridaIdentityInput(asked), true);
});

test("signed manifest: exact credential identity, closed field set, no UUID or name, verifiable and tamper-evident", () => {
  const k = keys(), now = 1_800_000_000_000;
  const manifest = buildManifest(IDENTITY, "save", BROWSER, now);
  assert.deepEqual(Object.keys(manifest), ["version", "hub", "audience", "intent", "profile_class", "identifier_namespace", "source_identifier", "jurisdiction",
    "canonical_return_path", "browser", "nonce", "issued_at", "expires_at"]);
  assert.deepEqual({ ...manifest, browser: "", nonce: "" }, { version: MANIFEST_VERSION, hub: "contractor", audience: "ask", intent: "save", profile_class: "contractor_profile",
    identifier_namespace: "fl.dbpr.license", source_identifier: "CCC057187", jurisdiction: "FL", canonical_return_path: "/contractors/ccc057187-a-r-roofing-inc",
    browser: "", nonce: "", issued_at: 1_800_000_000, expires_at: 1_800_000_600 });
  const wire = manifestBytes(manifest).toString("utf8");
  assert.doesNotMatch(wire, new RegExp(UUID)); assert.doesNotMatch(wire, /A & R ROOFING INC|displayName|display_name|legal|email|contractor_id|network_entity/i); assert.doesNotMatch(wire, new RegExp(BROWSER));
  const token = signManifest(manifest, k.priv);
  assert.deepEqual(verifyManifest(token, k.pub, BROWSER, now), manifest);
  assert.equal(manifestDigest(manifest).length, 64);
  // Wrong key, wrong browser, expired, not yet valid, tampered payload, wrong key id.
  assert.equal(verifyManifest(token, keys().pub, BROWSER, now), null);
  assert.equal(verifyManifest(token, k.pub, "c".repeat(43), now), null);
  assert.equal(verifyManifest(token, k.pub, BROWSER, now + 601_000), null);
  assert.equal(verifyManifest(token, k.pub, BROWSER, now - 60_000), null);
  assert.equal(verifyManifest(token, { ...k.pub, kid: "other" }, BROWSER, now), null);
  const [h, , s] = token.split(".");
  for (const patch of [{ source_identifier: "CGC1506243" }, { jurisdiction: "NJ" }, { canonical_return_path: "/contractors/other" }, { intent: "unsave" }, { contractor_id: UUID }]) {
    const forged = Buffer.from(JSON.stringify({ ...manifest, ...patch })).toString("base64url");
    assert.equal(verifyManifest(`${h}.${forged}.${s}`, k.pub, BROWSER, now), null, JSON.stringify(patch));
  }
  // The closed shape refuses extra fields and anything outside the Florida grain.
  for (const patch of [{ contractor_id: UUID }, { display_name: "A & R" }, { identifier_namespace: "nj.dca.license" }, { jurisdiction: "NJ" }, { source_identifier: UUID },
    { source_identifier: "A & R ROOFING INC" }, { canonical_return_path: "https://evil.example/contractors/x" }, { canonical_return_path: "/contractors/../x" }, { hub: "move" }, { profile_class: "standalone_credential" }])
    assert.equal(isManifest({ ...manifest, ...patch }), false, JSON.stringify(patch));
  assert.throws(() => buildManifest(IDENTITY, "watch" as never, BROWSER)); assert.throws(() => buildManifest(IDENTITY, "save", "short"));
  // No signing key is configured anywhere today.
  assert.equal(manifestSigningKey({}), null); assert.equal(manifestSigningKey({ MY_TRUSTHUB_CONTRACTOR_KEY_ID: "k", MY_TRUSTHUB_CONTRACTOR_SIGNING_PRIVATE_KEY_PEM: "not a key" }), null);
  assert.deepEqual(manifestSigningKey({ MY_TRUSTHUB_CONTRACTOR_KEY_ID: "contractor-test", MY_TRUSTHUB_CONTRACTOR_SIGNING_PRIVATE_KEY_PEM: k.priv.pem }), k.priv);
});

test("A. adapter: an eligible Florida profile stages its exact identity; ineligible profiles stage nothing", async () => {
  const k = keys();
  // dry run: resolve + build + sign, then stop. Nobody is contacted.
  let staged = 0; const counting: ContractorParentPort = { stage: async () => { staged++; return null; }, acknowledged: async () => false };
  const dry = await prepareParentSave(deps("dry_run", { key: k.priv, port: counting }), "ccc057187-a-r-roofing-inc", "save", BROWSER);
  assert.equal(dry.state, "staged_dry_run");
  if (dry.state === "staged_dry_run") {
    assert.deepEqual(dry.identity, { profileClass: "contractor_profile", identifierNamespace: "fl.dbpr.license", sourceIdentifier: "CCC057187", jurisdiction: "FL", returnPath: "/contractors/ccc057187-a-r-roofing-inc" });
    assert.equal(dry.signed, true); assert.match(dry.manifestDigest, /^[a-f0-9]{64}$/); assert.doesNotMatch(JSON.stringify(dry), new RegExp(UUID));
  }
  assert.equal(staged, 0);
  for (const [slug, reason] of [["fixture-no-credential", "no_fl_dbpr_credential"], ["fixture-thin", "thin_profile"], ["fixture-nj", "not_florida"], ["fixture-ca", "not_florida"],
    ["fixture-fl-and-nj", "multi_jurisdiction"], ["fixture-two-fl-licenses", "multiple_fl_credentials"], ["fixture-shared-key-a", "credential_not_unique"], ["no-such-contractor", "not_public"]] as const)
    assert.deepEqual(await prepareParentSave(deps("dry_run", { key: k.priv, port: counting }), slug, "save", BROWSER), { state: "local_only", reason, localCopy: "keep" }, slug);
  assert.equal(staged, 0);
  // The shape of the eventual live path (no deployment can select it): the port
  // receives a manifest whose signature verifies and whose identity is exact.
  let seen: { manifest: SaveManifest; signed: string } | null = null;
  const live: ContractorParentPort = { stage: async (manifest, signed) => { seen = { manifest, signed }; return { ticket: "t".repeat(43), target: PARENT_FORM_TARGET, continuationRef: "c".repeat(43) }; }, acknowledged: async (ticket) => ticket === "t".repeat(43) };
  const liveDeps = deps("live" as ParentSyncMode, { key: k.priv, port: live });
  assert.deepEqual(await prepareParentSave(liveDeps, "cfc1427249-a-sunny-plumbing-company", "unsave", BROWSER),
    { state: "continue", ticket: "t".repeat(43), target: "https://www.asktrusthub.com/my/profile-save", fields: { continuationRef: "c".repeat(43) }, localCopy: "keep" });
  assert.ok(seen); const captured = seen as unknown as { manifest: SaveManifest; signed: string };
  assert.deepEqual(verifyManifest(captured.signed, k.pub, BROWSER), captured.manifest);
  assert.equal(captured.manifest.source_identifier, "CFC1427249"); assert.equal(captured.manifest.intent, "unsave"); assert.equal(captured.manifest.canonical_return_path, "/contractors/cfc1427249-a-sunny-plumbing-company");
  assert.equal(await parentStatus(liveDeps, "t".repeat(43), BROWSER), "parent_acknowledged"); assert.equal(await parentStatus(liveDeps, "x".repeat(43), BROWSER), "pending");
  // No key, no accepted binding, or a parent target other than the fixed Ask form: nothing continues.
  assert.equal((await prepareParentSave(deps("live" as ParentSyncMode, { port: live }), "ccc057187-a-r-roofing-inc", "save", BROWSER)).state, "unavailable");
  assert.deepEqual(await prepareParentSave(deps("live" as ParentSyncMode, { key: k.priv }), "ccc057187-a-r-roofing-inc", "save", BROWSER), { state: "local_only", reason: "no_accepted_binding", localCopy: "keep" });
  const elsewhere: ContractorParentPort = { ...live, stage: async () => ({ ticket: "t".repeat(43), target: "https://www.asktrusthub.com/my/saved", continuationRef: "c".repeat(43) }) };
  assert.equal((await prepareParentSave(deps("live" as ParentSyncMode, { key: k.priv, port: elsewhere }), "ccc057187-a-r-roofing-inc", "save", BROWSER)).state, "unavailable");
});

test("L. production parent sync is OFF: no environment enables it and the endpoint does nothing", async () => {
  for (const env of [{}, { VERCEL_ENV: "production" }, { VERCEL_ENV: "production", MY_TRUSTHUB_CONTRACTOR_SYNC_MODE: "dry_run" }, { VERCEL_ENV: "production", MY_TRUSTHUB_CONTRACTOR_SYNC_MODE: "live" },
    { VERCEL_ENV: "production", MY_TRUSTHUB_CONTRACTOR_SYNC_MODE: "production" }, { MY_TRUSTHUB_CONTRACTOR_SAVE_ENABLED: "true" }, { NEXT_PUBLIC_MY_TRUSTHUB_CONTRACTOR_SYNC: "1" },
    { MY_TRUSTHUB_CONTRACTOR_SYNC_MODE: "live" }, { MY_TRUSTHUB_CONTRACTOR_SYNC_MODE: "production" }]) assert.equal(parentSyncMode(env), "off", JSON.stringify(env));
  assert.equal(parentSyncMode({ VERCEL_ENV: "preview", MY_TRUSTHUB_CONTRACTOR_SYNC_MODE: "dry_run" }), "dry_run");
  const { reader, reads } = source();
  const off = deps("off", { reader, key: keys().priv });
  assert.deepEqual(await prepareParentSave(off, "ccc057187-a-r-roofing-inc", "save", BROWSER), { state: "unavailable", localCopy: "keep" });
  assert.equal(await parentStatus(off, "t".repeat(43), BROWSER), "unavailable");
  const origin = "https://www.contractortrusthub.com", url = origin + ENDPOINT_PATH;
  const post = (body: unknown, headers: Record<string, string> = {}, d: AdapterDeps = off) => handleContractorProfileSave(new Request(url, { method: "POST",
    headers: { origin, "sec-fetch-site": "same-origin", "content-type": "application/json", ...headers }, body: JSON.stringify(body) }), d, origin);
  for (const body of [{ action: "bootstrap" }, { action: "prepare", slug: "ccc057187-a-r-roofing-inc", intent: "save" }, { action: "status", ticket: "t".repeat(43) }]) {
    const response = await post(body); assert.equal(response.status, 503); assert.equal(response.headers.get("set-cookie"), null);
    assert.deepEqual(await response.json(), { state: "unavailable", localCopy: "keep" });
  }
  assert.deepEqual(reads, [], "with sync off the publication source is never read");
  assert.equal(await DISABLED_PARENT_PORT.stage(buildManifest(IDENTITY, "save", BROWSER), "x"), null);
  assert.equal(await DISABLED_PARENT_PORT.acknowledged("t".repeat(43), BROWSER), false);
  // Nothing on the server path can reach Ask: no transport exists in these modules.
  for (const file of ["lib/my-trusthub/parent-adapter.ts", "lib/my-trusthub/manifest.ts", "lib/my-trusthub/publication.ts", "lib/my-trusthub/publication-server.ts", "lib/my-trusthub/profile-save-http.ts",
    "lib/my-trusthub/profile-identity.ts", "app/api/my-trusthub/profile-save/route.ts"]) assert.doesNotMatch(fs.readFileSync(file, "utf8"), /fetch\(|Authorization|MY_TRUSTHUB_P13/, file);
  assert.match(fs.readFileSync("app/api/my-trusthub/profile-save/route.ts", "utf8"), /port: DISABLED_PARENT_PORT/);
});

test("endpoint (dry run): same-origin + CSRF bound; the browser can send a slug and an intent, never an identity", async () => {
  const origin = "http://localhost:3222", url = origin + ENDPOINT_PATH, k = keys();
  const d = deps("dry_run", { key: k.priv });
  const base = { origin, "sec-fetch-site": "same-origin", "content-type": "application/json" };
  const call = (body: unknown, headers: Record<string, string> = base) => handleContractorProfileSave(new Request(url, { method: "POST", headers, body: JSON.stringify(body) }), d, origin);
  const boot = await call({ action: "bootstrap" }); assert.equal(boot.status, 200);
  const { csrf } = await boot.json() as { csrf: string };
  assert.match(boot.headers.get("set-cookie") ?? "", new RegExp(`^${COOKIE_NAME}=${csrf}; Path=/api/my-trusthub/profile-save; HttpOnly; SameSite=Strict`));
  const auth = { ...base, cookie: `${COOKIE_NAME}=${csrf}`, "x-cth-csrf": csrf };
  const ok = await call({ action: "prepare", slug: "cgc1506243-abs-contracting-inc", intent: "save" }, auth);
  assert.equal(ok.status, 200);
  const staged = await ok.json() as { state: string; identity: { sourceIdentifier: string; returnPath: string } };
  assert.equal(staged.state, "staged_dry_run"); assert.equal(staged.identity.sourceIdentifier, "CGC1506243"); assert.equal(staged.identity.returnPath, "/contractors/cgc1506243-abs-contracting-inc");
  assert.equal((await (await call({ action: "prepare", slug: "fixture-thin", intent: "save" }, auth)).json() as { state: string }).state, "local_only");
  // Any browser-supplied identity field is refused outright.
  for (const extra of [{ sourceIdentifier: "CCC057187" }, { externalKey: "CCC057187" }, { contractorId: UUID }, { networkEntityId: UUID }, { name: "A & R ROOFING INC" }, { jurisdiction: "FL" }, { returnPath: "/contractors/x" }])
    assert.equal((await call({ action: "prepare", slug: "cgc1506243-abs-contracting-inc", intent: "save", ...extra }, auth)).status, 400, JSON.stringify(extra));
  assert.equal((await call({ action: "prepare", slug: "cgc1506243-abs-contracting-inc" }, auth)).status, 400);
  assert.equal((await (await call({ action: "prepare", slug: "cgc1506243-abs-contracting-inc", intent: "watch" }, auth)).json() as { state: string }).state, "unavailable");
  assert.equal((await (await call({ action: "prepare", slug: UUID, intent: "save" }, auth)).json() as { state: string }).state, "local_only");
  // No CSRF, wrong CSRF, cross-origin, cross-site, GET, query string, oversized body.
  assert.equal((await call({ action: "prepare", slug: "x", intent: "save" })).status, 403);
  assert.equal((await call({ action: "prepare", slug: "x", intent: "save" }, { ...auth, "x-cth-csrf": "z".repeat(43) })).status, 403);
  assert.equal((await call({ action: "bootstrap" }, { ...base, origin: "https://evil.example" })).status, 403);
  assert.equal((await call({ action: "bootstrap" }, { ...base, "sec-fetch-site": "cross-site" })).status, 403);
  assert.equal((await handleContractorProfileSave(new Request(url + "?x=1", { method: "POST", headers: base, body: "{}" }), d, origin)).status, 403);
  assert.equal((await handleContractorProfileSave(new Request(url, { method: "GET", headers: base }), d, origin)).status, 403);
  assert.equal((await call({ action: "bootstrap", pad: "x".repeat(5000) })).status, 503);
  assert.equal((await (await call({ action: "status", ticket: "t".repeat(43) }, auth)).json() as { state: string }).state, "pending");
});

/** Stand-in for the pair as the browser sees it: the same-origin endpoint and
 * the parent form. The parent acts only under a session and acknowledges only
 * what it did. */
function world() {
  const calls: string[] = [], submitted: Array<{ target: string; fields: Record<string, string> }> = [];
  const tickets = new Map<string, { continuationRef: string; acknowledged: boolean }>();
  const parent = { account: null as string | null, saved: new Set<string>(), up: true, statusUp: true, abandon: false, refuse: false, eligible: true, dryRun: false };
  let n = 0; const ref = () => Buffer.from(String(++n).padStart(32, "0")).toString("base64url").slice(0, 43);
  const ports: DirectPorts = {
    async post(body, csrf) {
      const b = body as { action: string; slug?: string; intent?: string; ticket?: string };
      calls.push(b.action); assert.deepEqual(Object.keys(b).sort().join(), b.action === "bootstrap" ? "action" : b.action === "prepare" ? "action,intent,slug" : "action,ticket");
      if (!parent.up) throw new Error("unavailable");
      if (b.action === "bootstrap") return { csrf: "c".repeat(43) };
      assert.equal(csrf, "c".repeat(43));
      if (b.action === "prepare") {
        if (!parent.eligible) return { state: "local_only", reason: "multi_jurisdiction", localCopy: "keep" };
        if (parent.dryRun) return { state: "staged_dry_run", localCopy: "keep" };
        const ticket = ref(), continuationRef = ref(); tickets.set(ticket, { continuationRef, acknowledged: false });
        return { state: "continue", ticket, target: PARENT_FORM_TARGET, fields: { continuationRef }, localCopy: "keep" };
      }
      if (!parent.statusUp) throw new Error("unavailable");
      return { state: tickets.get(b.ticket!)?.acknowledged ? "parent_acknowledged" : "pending", localCopy: "keep" };
    },
    submit(target, fields) {
      submitted.push({ target, fields });
      const stage = [...tickets.values()].find((t) => t.continuationRef === fields.continuationRef);
      if (!stage || parent.abandon || !parent.account) return;
      const row = parent.account + ":fl.dbpr.license:CCC057187";
      if (fields.intent === "unsave") { if (parent.refuse) return; parent.saved.delete(row); stage.acknowledged = true; }
      else { parent.saved.add(row); stage.acknowledged = true; }
    },
    local: storage,
  };
  return { ports, parent, calls, submitted, pending: () => device.has("cth-mth-direct:ccc057187-a-r-roofing-inc") };
}
const SLUG = "ccc057187-a-r-roofing-inc";

test("hand-off client: Save and Unsave are reported only on the parent's acknowledgement; abandoned hand-offs stay recoverable", async () => {
  device.clear(); let w = world(); w.parent.account = "owner-a";
  saveContractor({ slug: SLUG, name: "A & R ROOFING INC", profileId: UUID });
  assert.equal(await startDirect(w.ports, SLUG, "save"), "navigating");
  assert.deepEqual(w.submitted.map((s) => [s.target, Object.keys(s.fields).sort().join(), s.fields.intent]), [["https://www.asktrusthub.com/my/profile-save", "continuationRef,intent", "save"]]);
  assert.deepEqual(await resumeDirect(w.ports, SLUG), { intent: "save", outcome: "confirmed" });
  assert.equal(parentSync(storage, SLUG), "synced"); assert.equal(w.parent.saved.size, 1); assert.equal(await resumeDirect(w.ports, SLUG), null);
  // Repeated Save: still one parent row.
  await startDirect(w.ports, SLUG, "save"); await resumeDirect(w.ports, SLUG); assert.equal(w.parent.saved.size, 1);
  // Unsave abandoned mid-chain (the Move production failure): device row gone, account row kept, not reported as removed, retry completes it.
  unsaveContractor(SLUG); w.parent.abandon = true;
  assert.equal(await startDirect(w.ports, SLUG, "unsave"), "navigating"); assert.equal(w.pending(), true);
  assert.deepEqual(await resumeDirect(w.ports, SLUG), { intent: "unsave", outcome: "not_confirmed" });
  assert.equal(parentSync(storage, SLUG), "synced"); assert.equal(w.parent.saved.size, 1); assert.equal(isContractorSaved(SLUG), false);
  w.parent.abandon = false;
  assert.equal(await startDirect(w.ports, SLUG, "unsave"), "navigating");
  assert.deepEqual(await resumeDirect(w.ports, SLUG), { intent: "unsave", outcome: "confirmed" });
  assert.equal(parentSync(storage, SLUG), null); assert.equal(w.parent.saved.size, 0);
  // Refused by the account (filed in a Project) or signed out: never claimed.
  for (const fault of ["refuse", "signed_out", "status_down"] as const) {
    device.clear(); w = world(); w.parent.account = "owner-a";
    await startDirect(w.ports, SLUG, "save"); await resumeDirect(w.ports, SLUG);
    if (fault === "refuse") w.parent.refuse = true; if (fault === "signed_out") w.parent.account = null;
    await startDirect(w.ports, SLUG, "unsave"); if (fault === "status_down") w.parent.statusUp = false;
    assert.equal((await resumeDirect(w.ports, SLUG))!.outcome, fault === "status_down" ? "unknown" : "not_confirmed"); assert.equal(parentSync(storage, SLUG), "synced", fault);
  }
  // Signed out Save: device only, nothing claimed.
  device.clear(); w = world();
  assert.equal(await startDirect(w.ports, SLUG, "save"), "navigating");
  assert.deepEqual(await resumeDirect(w.ports, SLUG), { intent: "save", outcome: "not_confirmed" }); assert.equal(parentSync(storage, SLUG), null); assert.equal(w.parent.saved.size, 0);
  // Not eligible, dry run, endpoint down, user already left: nothing navigates, nothing pending.
  for (const [setup, expected] of [[(x: ReturnType<typeof world>) => { x.parent.eligible = false; }, "not_eligible"], [(x: ReturnType<typeof world>) => { x.parent.dryRun = true; }, "dry_run"],
    [(x: ReturnType<typeof world>) => { x.parent.up = false; }, "unavailable"]] as const) {
    device.clear(); w = world(); setup(w);
    assert.equal(await startDirect(w.ports, SLUG, "save"), expected); assert.equal(w.submitted.length, 0); assert.equal(w.pending(), false); assert.equal(parentSync(storage, SLUG), null);
  }
  device.clear(); w = world(); w.parent.account = "owner-a";
  assert.equal(await startDirect(w.ports, SLUG, "save", () => false), "unavailable"); assert.equal(w.submitted.length, 0); assert.equal(w.pending(), false);
  // The browser is only ever handed to the production Ask form (or a local/test host).
  assert.equal(handoffTargetAllowed("https://www.asktrusthub.com/my/profile-save"), true);
  for (const bad of ["https://www.asktrusthub.com/my/handoff/start", "https://www.asktrusthub.com/my/saved", "https://asktrusthub.com/my/profile-save", "https://www.asktrusthub.com/my/profile-save?x=1",
    "https://www.asktrusthub.com.evil.example/my/profile-save", "https://evil.vercel.app/my/profile-save", "javascript:alert(1)", "", null]) assert.equal(handoffTargetAllowed(bad), false, String(bad));
});

test("legacy hand-off is not used or extended; one-account presentation stays off", () => {
  const legacy = fs.readFileSync("components/contractor/MyTrustHubSave.tsx", "utf8"), issue = fs.readFileSync("app/api/my-trusthub/issue/route.ts", "utf8");
  assert.match(legacy, /@deprecated LEGACY/); assert.match(issue, /@deprecated LEGACY/);
  assert.match(legacy, /MY_TRUSTHUB_CONTRACTOR_SAVE_ENABLED !== "true"/); assert.match(issue, /MY_TRUSTHUB_CONTRACTOR_SAVE_ENABLED !== "true"/);
  for (const file of fs.readdirSync("lib/my-trusthub").map((f) => "lib/my-trusthub/" + f).concat(["components/contractor/SaveContractorToggle.tsx", "app/api/my-trusthub/profile-save/route.ts"])) {
    const text = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(text, /MyTrustHubSave|my\/handoff\/start|my\/handoff\/arrive|handoff\/issue|MY_TRUSTHUB_P13_CONTRACTOR_SECRET|MY_TRUSTHUB_CONTRACTOR_SAVE_ENABLED/, file);
  }
  assert.equal(ONE_ACCOUNT_PRESENTATION, false);
  assert.equal(MY_TRUSTHUB_ACCOUNT_HREF, "https://www.asktrusthub.com/my");
  assert.equal(workspaceSyncCopy(false).linkLabel, "Optional account");
  for (const route of ["app/account/page.tsx", "app/watch/page.tsx", "app/projects/page.tsx", "app/compare/page.tsx", "app/passport/page.tsx", "app/tools/page.tsx", "app/my-contractor/page.tsx",
    "app/api/auth/request-link/route.ts", "app/api/account/sync/route.ts", "app/api/account/import-local/route.ts"]) assert.ok(fs.existsSync(route), route);
});
