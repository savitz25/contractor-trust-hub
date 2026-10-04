import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, randomBytes } from "node:crypto";
import fs from "node:fs";
import test from "node:test";

// Device storage shim, installed before the stores are used. Any real network call fails the test.
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
g.fetch = async () => { networkCalls++; throw new Error("no real network in tests"); };

import { SAVED_STORAGE_KEY, isContractorSaved, listSavedContractors, saveContractor, unsaveContractor } from "../lib/saved/store";
import { PROJECTS_KEY, isWatching, listWatches, watchContractor } from "../lib/projects/store";
import { FL_DBPR, bindingMatchesIdentity, deviceSaveAllowed, parentSaveReadiness } from "../lib/my-trusthub/profile-identity";
import { resolveByProfile, resolveBySlug, type ProfileReader } from "../lib/my-trusthub/publication";
import { CONTRACTOR_ORIGIN, PARENT_API_PATH, PARENT_FORM_PATH, PARENT_ORIGIN, RUNTIME_VERSION, SOURCE_PATH, TRANSFER_VERSION_V3, contractorManifest, contractorNativeId,
  isContractorManifest, manifestDigest, parseContractorNativeId, type ContractorManifest } from "../lib/my-trusthub/manifest";
import { ASSERTION_HEADER, ASSERTION_TTL_SECONDS, CONTRACTOR_PRODUCTION_PINS, signContractorAssertion, verifyContractorAssertion, type AssertionKey, type NonceStore } from "../lib/my-trusthub/contractor-assertion";
import { memoryAckStore } from "../lib/my-trusthub/ack-store";
import { CONTRACTOR_CANARIES, CONTRACTOR_CANARY_ACTIVE, CONTRACTOR_PARENT_SYNC_BROAD, gateAllows, parentStatus, parentSyncMode, prepareParentSave, productionHandoffDeps,
  productionParentGate, type AdapterDeps, type ParentTransport } from "../lib/my-trusthub/parent-adapter";
import { COOKIE_NAME, ENDPOINT_PATH, handleContractorProfileSave } from "../lib/my-trusthub/profile-save-http";
import { contractorPublication, handleContractorSource } from "../lib/my-trusthub/source-callback";
import { handoffTargetAllowed, parentSync, resumeDirect, startDirect, type DirectIntent, type DirectPorts } from "../lib/my-trusthub/direct-save-client";
import { MY_TRUSTHUB_ACCOUNT_HREF, ONE_ACCOUNT_PRESENTATION, workspaceSyncCopy } from "../lib/my-trusthub/one-account";
import type { ContractorDetail, LicenseDetail } from "../lib/contractors/types";

const UUID = "0001ac38-0c96-4e2f-8bf6-9ab243f7b79b";
const sha = (v: string) => createHash("sha256").update(v).digest("hex");
const ref = () => randomBytes(32).toString("base64url");
const license = (sourceSystem: string, externalKey: string, state: string | null = "FL"): LicenseDetail => ({
  id: "l-" + externalKey, externalKey, occupationCode: externalKey.replace(/\d/g, ""), licenseNumber: externalKey.replace(/\D/g, ""), statusNormalized: null, primaryStatus: null, secondaryStatus: null,
  originalLicensureDate: null, effectiveDate: null, expirationDate: null, addressLine1: null, city: null, state, postalCode: null, countyName: null, boardNumber: null,
  lastVerifiedAt: null, sourceSystem });
const contractor = (patch: Partial<ContractorDetail> = {}): ContractorDetail => ({
  id: UUID, slug: "ccc057187-a-r-roofing-inc", displayName: "A & R ROOFING INC", legalName: "A & R ROOFING INC", dbaName: null, primaryCity: null, primaryCounty: null,
  homeState: "FL", isThinProfile: false, licenses: [license("fl_dbpr", "CCC057187")], entities: [], discipline: [], ...patch });

// Fixture publication source: what the Trust Report read would return.
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
  contractor({ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", slug: "fixture-eligible-not-canary", licenses: [license("fl_dbpr", "CMC1249999")] }),
];
function source(rows = PROFILES) {
  const reads: string[] = [];
  const reader: ProfileReader = {
    bySlug: async (slug) => { reads.push("slug:" + slug); return rows.find((row) => row.slug === slug) ?? null; },
    slugsForFloridaCredential: async (key) => { reads.push("key:" + key); return rows.filter((row) => row.licenses.some((l) => l.sourceSystem === "fl_dbpr" && l.externalKey === key)).map((row) => row.slug).slice(0, 3); },
  };
  return { reader, reads };
}
const keypair = (kid: string) => { const pair = generateKeyPairSync("ed25519"); return {
  priv: { kid, pem: pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString() } as AssertionKey,
  pub: { kid, pem: pair.publicKey.export({ type: "spki", format: "pem" }).toString() } as AssertionKey }; };
const memoryNonces = (): NonceStore => { const seen = new Set<string>(); return { claim: async (k) => (seen.has(k) ? false : (seen.add(k), true)) }; };
const IDENTITY = { hub: "contractor", profileClass: "contractor_profile", identifierNamespace: "fl.dbpr.license", sourceIdentifier: "CCC057187", jurisdiction: "FL",
  canonicalSlug: "ccc057187-a-r-roofing-inc", returnPath: "/contractors/ccc057187-a-r-roofing-inc" } as const;
const CANARY = [
  { slug: "ccc057187-a-r-roofing-inc", key: "CCC057187", digest: "9c9f6fc29435beac2f7f90dda198d99d7468dac061cbe78725cc1d798df48f4f" },
  { slug: "cfc1427249-a-sunny-plumbing-company", key: "CFC1427249", digest: "2d42c7d91683606664082cbb2adc6fe8b5ae7d7cfeb1d56686773c27193fe565" },
  { slug: "cgc1506243-abs-contracting-inc", key: "CGC1506243", digest: "f104be2ddf33359ef8bb7ec31e740491323255710b703b6d3035c70be9aee93f" },
] as const;
const SLUG = CANARY[0].slug;

/**
 * The pair, simulated end to end with the real Contractor modules.
 *
 * `ask` behaves as My TrustHub does for Move and Lender today: it verifies the
 * hub's service assertion on the parent API, stages a transfer and a
 * continuation, and when the browser arrives on the form it calls the hub's
 * signed source callback (resolve, source, acknowledge). It acts on an account
 * only under a session and only for an identity it holds one accepted binding for.
 */
function pair(options: { canary?: boolean; broad?: boolean } = {}) {
  const contractorKey = keypair("contractor-v23-test"), askKey = keypair("ask-v23-test");
  const { reader, reads } = source();
  const acks = memoryAckStore();
  const contractorNonces = memoryNonces(), askNonces = memoryNonces();
  const ask = {
    session: null as string | null, bindings: new Set(CANARY.map((c) => "fl.dbpr.license:" + c.key).concat(["fl.dbpr.license:CMC1249999"])), saved: new Set<string>(),
    transfers: new Map<string, { manifest: ContractorManifest; browser: string; expiresAt: number }>(), continuations: new Map<string, string>(),
    apiCalls: [] as Array<{ operation: string; claims: Record<string, unknown>; envelope: Record<string, unknown> }>, forms: [] as Array<{ target: string; fields: Record<string, string> }>,
    abandon: false, refuseUnsave: false, sourceStatuses: [] as number[],
  };
  const parent: ParentTransport = async (call) => {
    const url = PARENT_ORIGIN + PARENT_API_PATH, bytes = Buffer.from(call.body);
    const request = new Request(url, { method: "POST", headers: { "content-type": "application/json", [ASSERTION_HEADER]: call.assertion }, body: bytes });
    let claims;
    try { claims = await verifyContractorAssertion(request, bytes, contractorKey.pub, "contractor", "transfer:stage", askNonces); } catch { return { ok: false }; }
    const envelope = JSON.parse(call.body) as { version: string; operation: string; input: Record<string, unknown> };
    ask.apiCalls.push({ operation: envelope.operation, claims: claims as unknown as Record<string, unknown>, envelope: envelope as unknown as Record<string, unknown> });
    if (Object.keys(envelope).sort().join() !== "input,operation,version" || envelope.version !== RUNTIME_VERSION) return { ok: false };
    if (envelope.operation === "prepareGuestProfileTransfer") {
      const manifest = envelope.input as unknown as ContractorManifest;
      // Exactly one accepted binding for this exact identity, or nothing is staged.
      if (!isContractorManifest(manifest) || !ask.bindings.has(manifest.returnTask.profile.nativeId)) return { ok: false };
      const transferRef = ref(), expiresAt = Date.now() + 600_000;
      ask.transfers.set(transferRef, { manifest, browser: claims.browser, expiresAt });
      return { ok: true, operation: envelope.operation, result: { transferRef, manifestDigest: manifestDigest(manifest), expiresAt } };
    }
    if (envelope.operation === "prepareProfileSaveContinuation") {
      const input = envelope.input as { sourceHub: string; audience: string; transferRef: string; manifestDigest: string };
      const transfer = ask.transfers.get(input.transferRef);
      if (!transfer || transfer.browser !== claims.browser || input.sourceHub !== "contractor" || input.audience !== "ask" || input.manifestDigest !== manifestDigest(transfer.manifest)) return { ok: false };
      const continuationRef = ref(); ask.continuations.set(continuationRef, input.transferRef);
      return { ok: true, operation: envelope.operation, result: { continuationRef, expiresAt: transfer.expiresAt } };
    }
    return { ok: false };
  };
  const sourceOptions = { reader, key: askKey.pub, nonces: contractorNonces, acks };
  const callSource = async (body: unknown, scope: "source:read" | "source:ack", browser: string, signer: AssertionKey = askKey.priv) => {
    const bytes = Buffer.from(JSON.stringify(body)), url = CONTRACTOR_ORIGIN + SOURCE_PATH;
    const response = await handleContractorSource(new Request(url, { method: "POST", body: bytes, headers: { "content-type": "application/json",
      [ASSERTION_HEADER]: signContractorAssertion(signer, "ask", url, scope, bytes, browser) } }), sourceOptions);
    ask.sourceStatuses.push(response.status);
    return { status: response.status, body: await response.json() as { ok: boolean; result?: Record<string, unknown> } };
  };
  /** The browser's top-level form POST arriving at the parent, then the follow-up GET. */
  const arrive = async (target: string, fields: Record<string, string>) => {
    ask.forms.push({ target, fields });
    if (ask.abandon) return;                                   // the user clicked away mid-chain
    const transferRef = ask.continuations.get(fields.continuationRef!); const transfer = transferRef ? ask.transfers.get(transferRef) : null;
    if (!transfer || !transferRef) return;
    const snapshot = await callSource({ action: "source", continuationRef: fields.continuationRef, transferRef, manifest: transfer.manifest,
      manifestDigest: manifestDigest(transfer.manifest), expiresAt: transfer.expiresAt }, "source:read", transfer.browser);
    if (snapshot.status !== 200 || snapshot.body.result!.browserProof !== transfer.browser) return;
    if (fields.intent === "save_signin" && !ask.session) ask.session = "owner-a";  // the customer signs in on My TrustHub
    if (!ask.session) return;                                  // signed out: return without asking
    const profile = transfer.manifest.returnTask.profile, row = ask.session + ":" + profile.nativeId;
    const published = await callSource({ action: "resolve", profile }, "source:read", transfer.browser);
    if (published.status !== 200) return;
    let outcome: string;
    if (fields.intent === "unsave") { if (ask.refuseUnsave) return; ask.saved.delete(row); outcome = "local_only"; }
    else { outcome = ask.saved.has(row) ? "already_saved" : "saved"; ask.saved.add(row); }
    await callSource({ action: "acknowledge", continuationRef: fields.continuationRef, receipts: [{ receiptRef: ref(), requestKey: snapshot.body.result!.requestPrefix + ":0",
      accountContextRef: ref(), manifestDigest: manifestDigest(transfer.manifest), item: transfer.manifest.selected[0], parent: { outcome }, project: { outcome: "not_requested" }, localCopy: "keep" }] },
      "source:ack", transfer.browser, askKey.priv);
  };
  const deps: AdapterDeps = { mode: "gated", gate: { broad: options.broad ?? false, canary: options.canary ?? true }, reader, key: contractorKey.priv, parent, acks, now: Date.now };
  // The browser: one cookie jar, device storage, the same-origin endpoint, a native form POST.
  let cookie = "";
  const origin = CONTRACTOR_ORIGIN, bff: Array<{ action: string; status: number }> = [];
  const pending: Promise<void>[] = [];
  const ports: DirectPorts = {
    async post(body, csrf) {
      const response = await handleContractorProfileSave(new Request(origin + ENDPOINT_PATH, { method: "POST", body: JSON.stringify(body),
        headers: { origin, "sec-fetch-site": "same-origin", "content-type": "application/json", ...(cookie ? { cookie } : {}), ...(csrf ? { "x-cth-csrf": csrf } : {}) } }), deps, origin);
      bff.push({ action: (body as { action: string }).action, status: response.status });
      const set = response.headers.get("set-cookie"); if (set) cookie = set.split(";")[0]!;
      if (!response.ok) throw new Error("unavailable");
      return response.json();
    },
    submit(target, fields) { pending.push(arrive(target, fields)); },
    local: storage,
  };
  const click = async (slug: string, intent: DirectIntent) => { const result = await startDirect(ports, slug, intent); await Promise.all(pending.splice(0)); return result; };
  return { ask, deps, ports, click, reads, acks, contractorKey, askKey, callSource, bff, browserBinding: () => cookie.split("=")[1]!, sourceOptions };
}

test("H/I/J. device Save toggle: Save -> Saved -> Save -> Saved, one row, no network", () => {
  device.clear(); networkCalls = 0;
  assert.equal(isContractorSaved(SLUG), false);
  const first = saveContractor({ slug: SLUG, name: "A & R ROOFING INC", profileId: UUID });
  assert.equal(isContractorSaved(SLUG), true);
  assert.deepEqual({ ...first, savedAt: "" }, { slug: SLUG, name: "A & R ROOFING INC", profileId: UUID, profileClass: "contractor_profile", savedAt: "", sync: "device" });
  unsaveContractor(SLUG);
  assert.equal(isContractorSaved(SLUG), false); assert.deepEqual(listSavedContractors(), []);
  saveContractor({ slug: SLUG, name: "A & R ROOFING INC", profileId: UUID });
  const again = saveContractor({ slug: SLUG, name: "renamed", profileId: UUID });
  assert.equal(listSavedContractors().length, 1); assert.equal(again?.name, "A & R ROOFING INC");
  unsaveContractor("not-saved"); assert.equal(saveContractor({ slug: "../x", name: "x" }), null); assert.equal(saveContractor({ slug: "Has Space", name: "x" }), null);
  device.set(SAVED_STORAGE_KEY, JSON.stringify([listSavedContractors()[0], listSavedContractors()[0], { slug: 7 }, null]));
  assert.equal(listSavedContractors().length, 1);
  assert.equal(networkCalls, 0);
});

test("K. Save is not Watch: neither store touches the other", () => {
  device.clear();
  watchContractor({ slug: "watched-co", name: "Watched Co", licenseKey: "CGC1", licenseStatus: "active" });
  const watchesBefore = device.get(PROJECTS_KEY);
  saveContractor({ slug: SLUG, name: "A & R ROOFING INC", profileId: UUID }); unsaveContractor(SLUG); saveContractor({ slug: SLUG, name: "A & R ROOFING INC", profileId: UUID });
  assert.equal(device.get(PROJECTS_KEY), watchesBefore, "the watch/projects store is byte-for-byte unchanged by Save and Unsave");
  assert.equal(isWatching(SLUG), false); assert.equal(listWatches().length, 1); assert.equal(isContractorSaved("watched-co"), false);
  for (const file of fs.readdirSync("lib/my-trusthub").map((f) => "lib/my-trusthub/" + f).concat(["lib/saved/store.ts", "components/contractor/SaveContractorToggle.tsx", "components/saved/SavedContractorsClient.tsx"]))
    assert.doesNotMatch(fs.readFileSync(file, "utf8"), /from "@\/lib\/projects\/store"|watchContractor|unwatchContractor|consumer_watch/, file);
});

test("L/M. one toggle on the Trust Report; Compare, Watch and My Contractor are unchanged", () => {
  const toggle = fs.readFileSync("components/contractor/SaveContractorToggle.tsx", "utf8");
  assert.equal(toggle.split("<button").length - 1, 1);
  assert.match(toggle, /aria-pressed=\{mounted \? saved : undefined\}/); assert.match(toggle, /\{saved \? "Saved" : "Save"\}/);
  assert.doesNotMatch(toggle, />\s*Unsave\s*<|Keep this in My TrustHub|Confirm Save/);
  assert.match(toggle, /PARENT_SYNC_UI = process\.env\.NEXT_PUBLIC_MY_TRUSTHUB_CONTRACTOR_SYNC === "1"/);
  assert.match(toggle, /const direct = PARENT_SYNC_UI && syncEligible && pathname === "\/contractors\/" \+ slug/);
  assert.ok(toggle.indexOf("saveContractor({ slug, name, profileId })") < toggle.indexOf('await handOff("save")'));
  assert.ok(toggle.indexOf("unsaveContractor(slug);") < toggle.indexOf('await handOff("unsave")'));
  assert.match(toggle, /Keep this page open/); assert.match(toggle, /handOff\("save_signin"\)/); assert.match(toggle, /May still be saved in My TrustHub/);
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

test("E/F/G. identity: the Florida DBPR license key is the identity; thin, multi-license and non-FL profiles are device only", () => {
  const ready = parentSaveReadiness(contractor());
  assert.deepEqual(ready, { ready: true, identity: IDENTITY });
  assert.deepEqual(parentSaveReadiness(contractor({ id: "ffffffff-ffff-4fff-8fff-ffffffffffff" })), ready, "the contractor UUID is not part of the identity");
  assert.doesNotMatch(JSON.stringify(ready), new RegExp(UUID));
  assert.deepEqual(FL_DBPR, { sourceSystem: "fl_dbpr", namespace: "fl.dbpr.license", jurisdiction: "FL" });
  const not = (patch: Partial<ContractorDetail>) => { const r = parentSaveReadiness(contractor(patch)); return r.ready ? "ready" : r.reason; };
  assert.equal(not({ isThinProfile: true }), "thin_profile");                                                                          // E
  assert.equal(not({ licenses: [license("fl_dbpr", "CGC1500002"), license("fl_dbpr", "CCC1300002")] }), "multiple_fl_credentials");   // F
  assert.equal(not({ homeState: "NJ", licenses: [license("nj_dca", "13VH01234500", "NJ")] }), "not_florida");                         // G
  assert.equal(not({ homeState: null }), "not_florida");
  for (const other of ["nj_dca", "ca_cslb", "tx_tdlr", "tx_tsbpe", "wa_lni", "az_roc", "or_ccb", "co_dora", "la_lslbc", "ms_sbc", "ky_dhbc"])
    assert.equal(not({ licenses: [license(other, "X12345", null)] }), "multi_jurisdiction", other);
  assert.equal(not({ licenses: [license("fl_dbpr", "CGC1500001"), license("nj_dca", "13VH09999900", "NJ")] }), "multi_jurisdiction");
  assert.equal(not({ licenses: [] }), "no_fl_dbpr_credential");
  assert.equal(not({ licenses: [license("fl_dbpr", "CCC 13 ; drop")] }), "invalid_credential_key");
  assert.equal(not({ slug: "" }), "missing_slug");
  assert.equal(not({ licenses: [license("fl_dbpr", "CCC057187"), license("fl_dbpr", "CCC057187")] }), "ready");
  assert.equal(deviceSaveAllowed(contractor({ homeState: "CA", licenses: [license("ca_cslb", "1012345", "CA")] })), true);
  assert.equal(deviceSaveAllowed(contractor({ isThinProfile: true })), false);
  const binding = { hub: "contractor", specialistEntityType: "contractor_profile", identifierNamespace: "fl.dbpr.license", sourceIdentifier: "CCC057187", jurisdiction: "FL", status: "accepted" };
  assert.equal(bindingMatchesIdentity(IDENTITY, binding), true);
  for (const patch of [{ status: "review_required" }, { hub: "move" }, { specialistEntityType: "mover" }, { identifierNamespace: "nj.dca.license" }, { sourceIdentifier: "CCC0000000" }, { sourceIdentifier: UUID }, { jurisdiction: "NJ" }, { jurisdiction: null }])
    assert.equal(bindingMatchesIdentity(IDENTITY, { ...binding, ...patch }), false, JSON.stringify(patch));
});

test("publication: exact slug in, exact credential identity out; the parent's re-check takes the shared profile identity only", async () => {
  const { reader, reads } = source();
  assert.deepEqual(await resolveBySlug(reader, SLUG), { eligible: true, identity: IDENTITY });
  const reason = async (slug: unknown) => { const r = await resolveBySlug(reader, slug); return r.eligible ? "eligible" : r.reason; };
  for (const [slug, expected] of [["fixture-no-credential", "no_fl_dbpr_credential"], ["fixture-thin", "thin_profile"], ["fixture-nj", "not_florida"], ["fixture-ca", "not_florida"],
    ["fixture-fl-and-nj", "multi_jurisdiction"], ["fixture-two-fl-licenses", "multiple_fl_credentials"], ["fixture-shared-key-a", "credential_not_unique"], ["fixture-bad-key", "invalid_credential_key"],
    ["no-such-contractor", "not_public"]] as const) assert.equal(await reason(slug), expected, slug);
  reads.length = 0;
  for (const bad of ["A & R ROOFING INC", "CCC057187", UUID.toUpperCase(), "../" + SLUG, SLUG + "?x=1", "", null, 7, { slug: "x" }]) assert.equal(await reason(bad), "missing_slug", String(bad));
  assert.deepEqual(reads, [], "malformed input never reaches the source");
  const asked = { hub: "contractor", nativeId: "fl.dbpr.license:CCC057187", profileClass: "contractor_profile" };
  assert.deepEqual(await resolveByProfile(reader, asked), IDENTITY);
  assert.deepEqual({ ...(await contractorPublication(reader, asked, 5))! }, { identity: asked, canonicalSlug: SLUG, publicationState: "PUBLISHABLE", reviewedClass: "contractor_profile", checkedAt: 5 });
  for (const bad of [{ ...asked, nativeId: "fl.dbpr.license:CBC1250003" }, { ...asked, nativeId: "fl.dbpr.license:CCC9999999" }, { ...asked, nativeId: "nj.dca.license:CCC057187" }, { ...asked, nativeId: "CCC057187" },
    { ...asked, nativeId: UUID }, { ...asked, nativeId: SLUG }, { ...asked, nativeId: "A & R ROOFING INC" }, { ...asked, profileClass: "standalone_credential" }, { ...asked, hub: "move" },
    { ...asked, contractorId: UUID }, { ...asked, jurisdiction: "NJ" }, "fl.dbpr.license:CCC057187", null])
    assert.equal(await resolveByProfile(reader, bad), null, JSON.stringify(bad));
});

test("P. manifest: the shared v3 selected-profiles wire with the exact Florida identity (digests match Ask's contract code)", () => {
  for (const c of CANARY) {
    const m = contractorManifest({ sourceIdentifier: c.key, canonicalSlug: c.slug });
    const profile = { hub: "contractor", nativeId: "fl.dbpr.license:" + c.key, profileClass: "contractor_profile" };
    assert.deepEqual(m, { version: "v2-3/selected-profiles/3", sourceHub: "contractor", audience: "ask",
      selected: [{ localItemId: c.slug, revision: "1", digest: sha(JSON.stringify([profile.nativeId, "/contractors/" + c.slug])), profile }],
      returnTask: { kind: "profile", hub: "contractor", canonicalSlug: c.slug, profile, returnPath: "/contractors/" + c.slug } });
    // Golden: computed by Ask's manifestDigest (Conumers-Trust-Hub main 39decff) for this exact manifest.
    assert.equal(manifestDigest(m), c.digest, c.slug);
    assert.equal(isContractorManifest(m), true);
    assert.deepEqual(parseContractorNativeId(m.returnTask.profile.nativeId), { identifierNamespace: "fl.dbpr.license", sourceIdentifier: c.key, jurisdiction: "FL" });
    assert.doesNotMatch(JSON.stringify(m), /[0-9a-f]{8}-[0-9a-f]{4}-4|displayName|legal|email|network/i);
  }
  assert.equal(TRANSFER_VERSION_V3, "v2-3/selected-profiles/3"); assert.equal(RUNTIME_VERSION, "v2-3/parent-runtime/1");
  assert.equal(PARENT_ORIGIN + PARENT_API_PATH, "https://www.asktrusthub.com/api/my-trusthub/profile-save");
  assert.equal(PARENT_ORIGIN + PARENT_FORM_PATH, "https://www.asktrusthub.com/my/profile-save");
  assert.equal(CONTRACTOR_ORIGIN + SOURCE_PATH, "https://www.contractortrusthub.com/api/my-trusthub/profile-save/source");
  assert.equal(contractorNativeId("CCC057187"), "fl.dbpr.license:CCC057187");
  for (const bad of ["ccc057187", "CCC 057187", UUID, "A & R", ""]) assert.equal(contractorNativeId(bad), null);
  for (const bad of ["nj.dca.license:13VH01234500", "fl.dbpr.license:", "fl.dbpr.license:ccc057187", "fl.dbpr:CCC057187", "usdot-1002530", "nmls:123456", UUID, null, 7]) assert.equal(parseContractorNativeId(bad), null, String(bad));
  const m = contractorManifest(IDENTITY);
  // B/C: any change to the key, the namespace (jurisdiction), the class, the slug or the return path breaks the closed shape.
  const clone = () => JSON.parse(JSON.stringify(m)) as ContractorManifest;
  const tampered: Array<(x: ContractorManifest) => void> = [
    (x) => { x.returnTask.profile.nativeId = "fl.dbpr.license:CGC1506243"; }, (x) => { x.selected[0]!.profile.nativeId = "fl.dbpr.license:CGC1506243"; },
    (x) => { x.returnTask.profile.nativeId = "nj.dca.license:CCC057187"; x.selected[0]!.profile.nativeId = "nj.dca.license:CCC057187"; },
    (x) => { x.returnTask.profile.nativeId = UUID; x.selected[0]!.profile.nativeId = UUID; }, (x) => { (x.returnTask.profile as { profileClass: string }).profileClass = "standalone_credential"; },
    (x) => { x.returnTask.returnPath = "/contractors/some-other-slug"; }, (x) => { x.returnTask.canonicalSlug = "some-other-slug"; }, (x) => { (x as { sourceHub: string }).sourceHub = "move"; },
    (x) => { (x as unknown as Record<string, unknown>).jurisdiction = "NJ"; }, (x) => { (x.returnTask as unknown as Record<string, unknown>).contractorId = UUID; }, (x) => { x.selected.push(x.selected[0]!); },
  ];
  for (const [i, change] of tampered.entries()) { const x = clone(); change(x); assert.equal(isContractorManifest(x), false, "tamper " + i); }
  assert.throws(() => contractorManifest({ sourceIdentifier: "not a key", canonicalSlug: SLUG })); assert.throws(() => contractorManifest({ sourceIdentifier: "CCC057187", canonicalSlug: "Bad Slug" }));
});

test("P. assertion: the shared v23 service assertion with a contractor_origin claim", async () => {
  const k = keypair("contractor-v23-test"), nonces = memoryNonces(), now = 1_800_000_000_000;
  const url = PARENT_ORIGIN + PARENT_API_PATH, body = Buffer.from(JSON.stringify({ version: RUNTIME_VERSION, operation: "prepareGuestProfileTransfer", input: {} })), browser = "b".repeat(43);
  const token = signContractorAssertion(k.priv, "contractor", url, "transfer:stage", body, browser, null, null, now);
  const [h, c] = token.split(".").slice(0, 2).map((part) => JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>);
  assert.deepEqual(h, { alg: "EdDSA", typ: "trusthub-v23+jws", kid: "contractor-v23-test" });
  // Same claim set as Move and Lender, with the hub claim named for Contractor.
  assert.equal(Object.keys(c!).sort().join(), "ask_origin,aud,body_sha256,browser,contractor_origin,exp,grant,iat,iss,jti,method,path,scope,session,sub,v");
  assert.deepEqual({ ...c, jti: "" }, { v: 1, iss: "urn:trusthub:v23:qvvxvbcdmbjzrgvwjatw:contractor", sub: "svc:trusthub:contractor:v23:production", aud: url, scope: "transfer:stage",
    method: "POST", path: "/api/my-trusthub/profile-save", body_sha256: sha(body.toString()), iat: 1_800_000_000, exp: 1_800_000_030, jti: "",
    ask_origin: "https://www.asktrusthub.com", contractor_origin: "https://www.contractortrusthub.com", browser, session: null, grant: null });
  assert.equal(ASSERTION_HEADER, "x-trusthub-v23-assertion"); assert.equal(ASSERTION_TTL_SECONDS, 30);
  assert.deepEqual(CONTRACTOR_PRODUCTION_PINS, { parentOrigin: "https://www.asktrusthub.com", contractorOrigin: "https://www.contractortrusthub.com", project: "qvvxvbcdmbjzrgvwjatw", assertionEnvironment: "production" });
  const request = (t = token, b = body, target = url) => new Request(target, { method: "POST", headers: { [ASSERTION_HEADER]: t }, body: b });
  const claims = await verifyContractorAssertion(request(), body, k.pub, "contractor", "transfer:stage", nonces, now);
  assert.equal(claims.browser, browser);
  await assert.rejects(verifyContractorAssertion(request(), body, k.pub, "contractor", "transfer:stage", nonces, now), "replay");
  const fresh = () => signContractorAssertion(k.priv, "contractor", url, "transfer:stage", body, browser, null, null, now);
  await assert.rejects(verifyContractorAssertion(request(fresh(), Buffer.from("{}")), Buffer.from("{}"), k.pub, "contractor", "transfer:stage", memoryNonces(), now), "tampered body");
  await assert.rejects(verifyContractorAssertion(request(fresh()), body, keypair("contractor-v23-test").pub, "contractor", "transfer:stage", memoryNonces(), now), "wrong key");
  await assert.rejects(verifyContractorAssertion(request(fresh()), body, { ...k.pub, kid: "other" }, "contractor", "transfer:stage", memoryNonces(), now), "wrong kid");
  await assert.rejects(verifyContractorAssertion(request(fresh()), body, k.pub, "contractor", "source:ack", memoryNonces(), now), "wrong scope");
  await assert.rejects(verifyContractorAssertion(request(fresh()), body, k.pub, "ask", "transfer:stage", memoryNonces(), now), "wrong service");
  await assert.rejects(verifyContractorAssertion(request(fresh()), body, k.pub, "contractor", "transfer:stage", memoryNonces(), now + 31_000), "expired");
  await assert.rejects(verifyContractorAssertion(request(fresh(), body, PARENT_ORIGIN + "/api/other"), body, k.pub, "contractor", "transfer:stage", memoryNonces(), now), "wrong audience");
  // A token carrying another hub's origin claim (Move or Lender shape) never verifies as Contractor.
  for (const other of ["lender_origin", "move_origin"]) {
    const forgedClaims = { ...c, jti: ref() } as Record<string, unknown>; forgedClaims[other] = forgedClaims.contractor_origin; delete forgedClaims.contractor_origin;
    const unsigned = Buffer.from(JSON.stringify(h)).toString("base64url") + "." + Buffer.from(JSON.stringify(forgedClaims)).toString("base64url");
    const { sign, createPrivateKey } = await import("node:crypto");
    const forged = unsigned + "." + sign(null, Buffer.from(unsigned), createPrivateKey(k.priv.pem)).toString("base64url");
    await assert.rejects(verifyContractorAssertion(request(forged), body, k.pub, "contractor", "transfer:stage", memoryNonces(), now), other);
  }
  // Contractor only ever signs toward the pinned parent origin; Ask only toward the pinned Contractor origin.
  assert.throws(() => signContractorAssertion(k.priv, "contractor", "https://evil.example/api/my-trusthub/profile-save", "transfer:stage", body, browser));
  assert.throws(() => signContractorAssertion(k.priv, "ask", url, "source:read", body, browser));
  assert.throws(() => signContractorAssertion(k.priv, "contractor", url, "transfer:stage", body, "short"));
});

test("A. signed hand-off: all three Florida canaries stage their exact signed identity and complete Save -> Unsave", async () => {
  device.clear(); const p = pair(); p.ask.session = "owner-a";
  for (const c of CANARY) {
    saveContractor({ slug: c.slug, name: c.slug, profileId: UUID });
    assert.equal(await p.click(c.slug, "save"), "navigating", c.slug);
    const staged = p.ask.apiCalls.at(-2)!, continued = p.ask.apiCalls.at(-1)!;
    assert.equal(staged.operation, "prepareGuestProfileTransfer"); assert.equal(continued.operation, "prepareProfileSaveContinuation");
    const manifest = staged.envelope.input as unknown as ContractorManifest;
    assert.equal(manifestDigest(manifest), c.digest); assert.equal(manifest.returnTask.profile.nativeId, "fl.dbpr.license:" + c.key); assert.equal(manifest.returnTask.returnPath, "/contractors/" + c.slug);
    assert.equal(staged.claims.browser, p.browserBinding()); assert.equal(staged.claims.scope, "transfer:stage"); assert.equal(staged.claims.session, null); assert.equal(staged.claims.grant, null);
    assert.deepEqual(Object.keys(continued.envelope.input as object).sort(), ["audience", "manifestDigest", "sourceHub", "transferRef"]);
    // Top-level browser hand-off: exactly the parent form, exactly two fields.
    assert.deepEqual([p.ask.forms.at(-1)!.target, Object.keys(p.ask.forms.at(-1)!.fields).sort().join(), p.ask.forms.at(-1)!.fields.intent], ["https://www.asktrusthub.com/my/profile-save", "continuationRef,intent", "save"]);
    assert.deepEqual(await resumeDirect(p.ports, c.slug), { intent: "save", outcome: "confirmed" });
    assert.equal(parentSync(storage, c.slug), "synced");
  }
  assert.deepEqual([...p.ask.saved].sort(), CANARY.map((c) => "owner-a:fl.dbpr.license:" + c.key).sort());
  // Repeated Save: acknowledged as already saved, still one parent row per profile.
  assert.equal(await p.click(SLUG, "save"), "navigating"); assert.equal((await resumeDirect(p.ports, SLUG))!.outcome, "confirmed"); assert.equal(p.ask.saved.size, 3);
  // Unsave: device row removed first, parent row removed, acknowledged, control back to Save.
  for (const c of CANARY) {
    unsaveContractor(c.slug); assert.equal(isContractorSaved(c.slug), false);
    assert.equal(await p.click(c.slug, "unsave"), "navigating"); assert.equal(p.ask.forms.at(-1)!.fields.intent, "unsave");
    assert.deepEqual(await resumeDirect(p.ports, c.slug), { intent: "unsave", outcome: "confirmed" }); assert.equal(parentSync(storage, c.slug), null);
  }
  assert.equal(p.ask.saved.size, 0);
  assert.ok(p.ask.sourceStatuses.every((status) => status === 200));
  assert.equal(networkCalls, 0);
});

test("B/C/D. tampered DBPR key, tampered jurisdiction and browser-supplied identity are all rejected", async () => {
  device.clear(); const p = pair(); p.ask.session = "owner-a";
  assert.equal(await p.click(SLUG, "save"), "navigating"); await resumeDirect(p.ports, SLUG);
  const browser = p.browserBinding(), good = contractorManifest(IDENTITY);
  const rebuild = (nativeId: string, slug = SLUG): ContractorManifest => { const profile = { hub: "contractor" as const, nativeId, profileClass: "contractor_profile" as const }, returnPath = "/contractors/" + slug;
    return { version: TRANSFER_VERSION_V3, sourceHub: "contractor", audience: "ask", selected: [{ localItemId: slug, revision: "1", digest: sha(JSON.stringify([nativeId, returnPath])), profile }],
      returnTask: { kind: "profile", hub: "contractor", canonicalSlug: slug, profile, returnPath } }; };
  const sourceCall = (manifest: ContractorManifest, digest = manifestDigest(manifest)) => p.callSource({ action: "source", continuationRef: ref(), transferRef: ref(), manifest, manifestDigest: digest, expiresAt: Date.now() + 60_000 }, "source:read", browser);
  assert.equal((await sourceCall(good)).status, 200);
  // B. a different DBPR key under this profile's slug, or this key under another profile's slug.
  assert.equal((await sourceCall(rebuild("fl.dbpr.license:CGC1506243"))).status, 403);
  assert.equal((await sourceCall(rebuild("fl.dbpr.license:CCC057187", "cgc1506243-abs-contracting-inc"))).status, 403);
  assert.equal((await sourceCall(good, "0".repeat(64))).status, 403);
  // C. a different namespace / jurisdiction for the same key.
  assert.equal((await sourceCall(rebuild("nj.dca.license:CCC057187"))).status, 403);
  assert.equal((await sourceCall(rebuild("ca.cslb.license:CCC057187"))).status, 403);
  for (const profile of [{ hub: "contractor", nativeId: "nj.dca.license:CCC057187", profileClass: "contractor_profile" }, { hub: "contractor", nativeId: "fl.dbpr.license:CCC0000000", profileClass: "contractor_profile" },
    { hub: "contractor", nativeId: UUID, profileClass: "contractor_profile" }, { hub: "move", nativeId: "fl.dbpr.license:CCC057187", profileClass: "contractor_profile" }])
    assert.equal((await p.callSource({ action: "resolve", profile }, "source:read", browser)).status, 503, JSON.stringify(profile));
  // A body changed after signing, a caller without Ask's key, a wrong scope, a replay: unauthorized.
  const url = CONTRACTOR_ORIGIN + SOURCE_PATH, signedBody = Buffer.from(JSON.stringify({ action: "resolve", profile: good.returnTask.profile }));
  const token = signContractorAssertion(p.askKey.priv, "ask", url, "source:read", signedBody, browser);
  const swapped = Buffer.from(JSON.stringify({ action: "resolve", profile: { ...good.returnTask.profile, nativeId: "fl.dbpr.license:CGC1506243" } }));
  const raw = (body: Buffer, assertion: string) => handleContractorSource(new Request(url, { method: "POST", body, headers: { "content-type": "application/json", [ASSERTION_HEADER]: assertion } }), p.sourceOptions);
  assert.equal((await raw(swapped, token)).status, 403);
  assert.equal((await raw(signedBody, token)).status, 200); assert.equal((await raw(signedBody, token)).status, 403, "replay");
  assert.equal((await p.callSource({ action: "resolve", profile: good.returnTask.profile }, "source:read", browser, p.contractorKey.priv)).status, 403, "Contractor's own key is not Ask's");
  assert.equal((await p.callSource({ action: "resolve", profile: good.returnTask.profile }, "source:ack", browser)).status, 403);
  // An acknowledgement for another browser, a Watch-bearing receipt, an unknown outcome, or another identity is refused and not recorded.
  const before = p.acks.size();
  const receipt = (patch: Record<string, unknown> = {}, prefix = browser) => ({ receiptRef: ref(), requestKey: prefix + ":0", accountContextRef: ref(), manifestDigest: manifestDigest(good), item: good.selected[0],
    parent: { outcome: "saved" }, project: { outcome: "not_requested" }, localCopy: "keep", ...patch });
  const ack = (r: unknown) => p.callSource({ action: "acknowledge", continuationRef: ref(), receipts: [r] }, "source:ack", browser);
  assert.equal((await ack(receipt({}, "x".repeat(43)))).status, 403);
  assert.equal((await ack(receipt({ watchCreated: true }))).status, 403); assert.equal((await ack(receipt({ watch: { id: 1 } }))).status, 403);
  assert.equal((await ack(receipt({ parent: { outcome: "failed" } }))).status, 403);
  assert.equal((await ack(receipt({ item: { ...good.selected[0], profile: { ...good.selected[0]!.profile, nativeId: "fl.dbpr.license:CCC0000000" } } }))).status, 403);
  assert.equal(p.acks.size(), before);
  assert.equal((await ack(receipt())).status, 200); assert.equal(p.acks.size(), before + 1);
  // D. the browser may send only { slug, intent }.
  const csrf = p.browserBinding();
  const post = (body: unknown) => handleContractorProfileSave(new Request(CONTRACTOR_ORIGIN + ENDPOINT_PATH, { method: "POST", body: JSON.stringify(body),
    headers: { origin: CONTRACTOR_ORIGIN, "sec-fetch-site": "same-origin", "content-type": "application/json", cookie: `${COOKIE_NAME}=${csrf}`, "x-cth-csrf": csrf } }), p.deps, CONTRACTOR_ORIGIN);
  const calls = p.ask.apiCalls.length;
  for (const extra of [{ contractorId: UUID }, { profileId: UUID }, { networkEntityId: UUID }, { externalKey: "CCC057187" }, { sourceIdentifier: "CGC1506243" }, { nativeId: "fl.dbpr.license:CGC1506243" },
    { name: "A & R ROOFING INC" }, { jurisdiction: "FL" }, { identifierNamespace: "fl.dbpr.license" }, { returnPath: "/contractors/x" }])
    assert.equal((await post({ action: "prepare", slug: SLUG, intent: "save", ...extra })).status, 400, JSON.stringify(extra));
  for (const slug of [UUID, "CCC057187", "A & R ROOFING INC"]) assert.equal((await (await post({ action: "prepare", slug, intent: "save" })).json() as { state: string }).state, "local_only", slug);
  assert.equal((await (await post({ action: "prepare", slug: SLUG, intent: "watch" })).json() as { state: string }).state, "unavailable");
  assert.equal(p.ask.apiCalls.length, calls, "nothing reached the parent");
});

test("E/F/G. ineligible profiles and profiles outside the canary stage nothing with the parent", async () => {
  device.clear(); const p = pair(); p.ask.session = "owner-a";
  for (const [slug, reason] of [["fixture-thin", "thin_profile"], ["fixture-two-fl-licenses", "multiple_fl_credentials"], ["fixture-nj", "not_florida"], ["fixture-ca", "not_florida"],
    ["fixture-fl-and-nj", "multi_jurisdiction"], ["fixture-no-credential", "no_fl_dbpr_credential"], ["fixture-shared-key-a", "credential_not_unique"], ["no-such-contractor", "not_public"],
    ["fixture-eligible-not-canary", "sync_off"]] as const) {
    assert.deepEqual(await prepareParentSave(p.deps, slug, "save", "b".repeat(43)), { state: "local_only", reason, localCopy: "keep" }, slug);
    saveContractor({ slug, name: slug }); assert.equal(await p.click(slug, "save"), "not_eligible", slug); assert.equal(isContractorSaved(slug), true, "the device Save stands");
  }
  assert.deepEqual(p.ask.apiCalls, []); assert.deepEqual(p.ask.forms, []);
  // The parent declines when it holds no single accepted binding: device only.
  p.ask.bindings.delete("fl.dbpr.license:CCC057187");
  assert.deepEqual(await prepareParentSave(p.deps, SLUG, "save", "b".repeat(43)), { state: "local_only", reason: "parent_declined", localCopy: "keep" });
  // No signing key: nothing is sent.
  const unsigned = pair(); unsigned.deps.key = null;
  assert.deepEqual(await prepareParentSave(unsigned.deps, SLUG, "save", "b".repeat(43)), { state: "local_only", reason: "unsigned", localCopy: "keep" }); assert.deepEqual(unsigned.ask.apiCalls, []);
  // A parent that answers with another digest, an expired window or a malformed reference is not followed.
  for (const corrupt of [(r: Record<string, unknown>) => { r.manifestDigest = "0".repeat(64); }, (r: Record<string, unknown>) => { r.expiresAt = 1; }, (r: Record<string, unknown>) => { r.transferRef = "short"; }]) {
    const q = pair(), inner = q.deps.parent!;
    q.deps.parent = async (call) => { const response = await inner(call); if (response.ok && response.operation === "prepareGuestProfileTransfer") corrupt(response.result as Record<string, unknown>); return response; };
    assert.equal((await prepareParentSave(q.deps, SLUG, "save", "b".repeat(43))).state, "unavailable");
  }
});

test("N. signed-out continuation: the Save stays on the device, then sign-in finishes it with no second Save click", async () => {
  device.clear(); const p = pair();
  saveContractor({ slug: SLUG, name: "A & R ROOFING INC", profileId: UUID });
  assert.equal(await p.click(SLUG, "save"), "navigating");
  assert.deepEqual(await resumeDirect(p.ports, SLUG), { intent: "save", outcome: "not_confirmed" });
  assert.equal(isContractorSaved(SLUG), true); assert.equal(p.ask.saved.size, 0); assert.equal(parentSync(storage, SLUG), null);
  // "Sign in to My TrustHub": one hand-off with save_signin; the parent signs the customer in and saves.
  assert.equal(await p.click(SLUG, "save_signin"), "navigating"); assert.equal(p.ask.forms.at(-1)!.fields.intent, "save_signin");
  assert.deepEqual(await resumeDirect(p.ports, SLUG), { intent: "save_signin", outcome: "confirmed" });
  assert.deepEqual([...p.ask.saved], ["owner-a:fl.dbpr.license:CCC057187"]); assert.equal(parentSync(storage, SLUG), "synced");
  assert.equal(listSavedContractors().length, 1);
});

test("O. abandoned hand-off recovery: nothing is claimed, the device keeps the belief, a retry completes it", async () => {
  device.clear(); const p = pair(); p.ask.session = "owner-a";
  saveContractor({ slug: SLUG, name: "A & R ROOFING INC", profileId: UUID });
  await p.click(SLUG, "save"); await resumeDirect(p.ports, SLUG); assert.equal(p.ask.saved.size, 1);
  // The customer clicks away while the hand-off is in flight: device row gone, account row kept.
  unsaveContractor(SLUG); p.ask.abandon = true;
  assert.equal(await p.click(SLUG, "unsave"), "navigating");
  assert.ok(device.has("cth-mth-direct:" + SLUG), "the pending marker is on the device, not the tab");
  assert.deepEqual(await resumeDirect(p.ports, SLUG), { intent: "unsave", outcome: "not_confirmed" });
  assert.equal(isContractorSaved(SLUG), false); assert.equal(p.ask.saved.size, 1); assert.equal(parentSync(storage, SLUG), "synced");
  assert.equal(await resumeDirect(p.ports, SLUG), null, "consumed once");
  p.ask.abandon = false;
  assert.equal(await p.click(SLUG, "unsave"), "navigating");
  assert.deepEqual(await resumeDirect(p.ports, SLUG), { intent: "unsave", outcome: "confirmed" }); assert.equal(p.ask.saved.size, 0); assert.equal(parentSync(storage, SLUG), null);
  // An abandoned Save is not claimed either.
  p.ask.abandon = true; saveContractor({ slug: SLUG, name: "A & R ROOFING INC", profileId: UUID });
  await p.click(SLUG, "save"); assert.deepEqual(await resumeDirect(p.ports, SLUG), { intent: "save", outcome: "not_confirmed" }); assert.equal(p.ask.saved.size, 0); p.ask.abandon = false;
  // Project conflict: the parent refuses the removal and acknowledges nothing; the account row and the belief stay.
  await p.click(SLUG, "save"); await resumeDirect(p.ports, SLUG); p.ask.refuseUnsave = true; unsaveContractor(SLUG);
  await p.click(SLUG, "unsave"); assert.deepEqual(await resumeDirect(p.ports, SLUG), { intent: "unsave", outcome: "not_confirmed" }); assert.equal(p.ask.saved.size, 1); assert.equal(parentSync(storage, SLUG), "synced");
  // The acknowledgement is held for the browser it was staged for and nobody else.
  const held = p.ask.forms.find((f) => f.fields.intent === "save")!.fields.continuationRef!;
  assert.equal(await parentStatus(p.deps, held, p.browserBinding()), "parent_acknowledged");
  assert.equal(await parentStatus(p.deps, held, "z".repeat(43)), "pending"); assert.equal(await parentStatus(p.deps, ref(), p.browserBinding()), "pending");
  // No acknowledgement store (table not applied) or a failing one: status is unavailable and the device claims nothing.
  assert.equal(await parentStatus({ ...p.deps, acks: null }, held, p.browserBinding()), "unavailable");
  assert.equal(await parentStatus({ ...p.deps, acks: { record: async () => { throw new Error("db"); }, read: async () => { throw new Error("db"); } } }, held, p.browserBinding()), "unavailable");
  const lost = pair(); lost.ask.session = "owner-a"; lost.sourceOptions.acks = { record: async () => { throw new Error("relation does not exist"); }, read: async () => null } as never;
  await lost.click(SLUG, "save"); assert.ok(lost.ask.sourceStatuses.includes(503)); assert.equal((await resumeDirect(lost.ports, SLUG))!.outcome, "not_confirmed");
  // The browser is only ever handed to the production Ask form (or a local/test host).
  assert.equal(handoffTargetAllowed("https://www.asktrusthub.com/my/profile-save"), true);
  for (const bad of ["https://www.asktrusthub.com/my/handoff/start", "https://www.asktrusthub.com/my/saved", "https://asktrusthub.com/my/profile-save", "https://www.asktrusthub.com/my/profile-save?x=1",
    "https://www.asktrusthub.com.evil.example/my/profile-save", "https://evil.vercel.app/my/profile-save", "javascript:alert(1)", "", null]) assert.equal(handoffTargetAllowed(bad), false, String(bad));
});

test("production parent sync is OFF and the canary is OFF: nothing is read, signed or sent", async () => {
  assert.equal(CONTRACTOR_PARENT_SYNC_BROAD, false); assert.equal(CONTRACTOR_CANARY_ACTIVE, false);
  assert.deepEqual(productionParentGate(), { broad: false, canary: false });
  assert.deepEqual(CONTRACTOR_CANARIES.map((c) => [c.slug, c.externalKey]), CANARY.map((c) => [c.slug, c.key]));
  for (const env of [{}, { VERCEL_ENV: "production" }, { VERCEL_ENV: "production", MY_TRUSTHUB_CONTRACTOR_SYNC_MODE: "dry_run" }, { VERCEL_ENV: "production", MY_TRUSTHUB_CONTRACTOR_SYNC_MODE: "gated" },
    { MY_TRUSTHUB_CONTRACTOR_SYNC_MODE: "gated" }, { MY_TRUSTHUB_CONTRACTOR_SYNC_MODE: "live" }, { MY_TRUSTHUB_CONTRACTOR_SAVE_ENABLED: "true" }, { NEXT_PUBLIC_MY_TRUSTHUB_CONTRACTOR_SYNC: "1" },
    { VERCEL_ENV: "production", MY_TRUSTHUB_V23_CONTRACTOR_KEY_ID: "k", MY_TRUSTHUB_V23_CONTRACTOR_SIGNING_PRIVATE_KEY_PEM: "-----BEGIN PRIVATE KEY-----" }]) assert.equal(parentSyncMode(env), "off", JSON.stringify(env));
  assert.equal(parentSyncMode({ VERCEL_ENV: "preview", MY_TRUSTHUB_CONTRACTOR_SYNC_MODE: "dry_run" }), "dry_run");
  assert.equal(parentSyncMode({ VERCEL_ENV: "production" }, { broad: false, canary: true }), "gated", "only the reviewed gate constant opens it");
  for (const c of CANARY) { assert.equal(gateAllows(c.slug, productionParentGate()), false); assert.equal(gateAllows(c.slug, { broad: false, canary: true }), true); }
  assert.equal(gateAllows("fixture-eligible-not-canary", { broad: false, canary: true }), false);
  const { reader, reads } = source(); let sent = 0;
  const off: AdapterDeps = { mode: "off", gate: productionParentGate(), reader, key: keypair("k").priv, parent: async () => { sent++; return { ok: false }; }, acks: memoryAckStore(), now: Date.now };
  assert.deepEqual(await prepareParentSave(off, SLUG, "save", "b".repeat(43)), { state: "unavailable", localCopy: "keep" });
  assert.equal(await parentStatus(off, "t".repeat(43), "b".repeat(43)), "unavailable");
  const origin = CONTRACTOR_ORIGIN;
  for (const body of [{ action: "bootstrap" }, { action: "prepare", slug: SLUG, intent: "save" }, { action: "status", continuationRef: "t".repeat(43) }]) {
    const response = await handleContractorProfileSave(new Request(origin + ENDPOINT_PATH, { method: "POST", headers: { origin, "sec-fetch-site": "same-origin", "content-type": "application/json" }, body: JSON.stringify(body) }), off, origin);
    assert.equal(response.status, 503); assert.equal(response.headers.get("set-cookie"), null); assert.deepEqual(await response.json(), { state: "unavailable", localCopy: "keep" });
  }
  assert.deepEqual(reads, []); assert.equal(sent, 0);
  // Dry run (non-production): resolves and builds, contacts nobody.
  const dry = await prepareParentSave({ ...off, mode: "dry_run" }, "cgc1506243-abs-contracting-inc", "save", "b".repeat(43));
  assert.deepEqual(dry, { state: "staged_dry_run", nativeId: "fl.dbpr.license:CGC1506243", manifestDigest: CANARY[2].digest, localCopy: "keep",
    identity: { profileClass: "contractor_profile", identifierNamespace: "fl.dbpr.license", sourceIdentifier: "CGC1506243", jurisdiction: "FL", returnPath: "/contractors/cgc1506243-abs-contracting-inc" } });
  assert.equal(sent, 0);
  // The source callback is unavailable without Ask's verification key.
  const closed = await handleContractorSource(new Request(CONTRACTOR_ORIGIN + SOURCE_PATH, { method: "POST", body: "{}", headers: { "content-type": "application/json" } }), { reader, key: null, nonces: memoryNonces(), acks: null });
  assert.equal(closed.status, 503);
  // Signer/transport come only from the dedicated Contractor values and only toward the pinned parent origin.
  assert.deepEqual(productionHandoffDeps({}), { key: null, parent: null });
  const k = keypair("contractor-v23-prod");
  assert.deepEqual(productionHandoffDeps({ MY_TRUSTHUB_V23_CONTRACTOR_KEY_ID: k.priv.kid, MY_TRUSTHUB_V23_CONTRACTOR_SIGNING_PRIVATE_KEY_PEM: k.priv.pem, MY_TRUSTHUB_V23_PARENT_ORIGIN: "https://evil.example" }), { key: null, parent: null });
  assert.deepEqual(productionHandoffDeps({ MY_TRUSTHUB_V23_CONTRACTOR_KEY_ID: k.priv.kid, MY_TRUSTHUB_V23_CONTRACTOR_SIGNING_PRIVATE_KEY_PEM: k.priv.pem, MY_TRUSTHUB_V23_PARENT_ORIGIN: "https://www.asktrusthub.com" }).key, k.priv);
  // The only outbound request in the whole path is the gated parent transport; routes construct it only when gated.
  const route = fs.readFileSync("app/api/my-trusthub/profile-save/route.ts", "utf8");
  assert.match(route, /const signer = mode === "gated" \? productionHandoffDeps\(\) : \{ key: null, parent: null \}/);
  for (const file of fs.readdirSync("lib/my-trusthub").map((f) => "lib/my-trusthub/" + f).concat(["app/api/my-trusthub/profile-save/route.ts", "app/api/my-trusthub/profile-save/source/route.ts"])) {
    const text = fs.readFileSync(file, "utf8"), fetches = text.split("fetch(").length - 1;
    assert.equal(fetches, file.endsWith("parent-adapter.ts") || file.endsWith("direct-save-client.ts") ? 1 : 0, file);
  }
  assert.equal(networkCalls, 0);
});

test("the provisional envelope and the legacy hand-off are gone from the new path; one-account presentation stays off", () => {
  const manifest = fs.readFileSync("lib/my-trusthub/manifest.ts", "utf8");
  assert.doesNotMatch(manifest, /contractor-profile-save\/1|trusthub-save-manifest|signManifest|verifyManifest|MY_TRUSTHUB_CONTRACTOR_SIGNING_PRIVATE_KEY_PEM/);
  const legacy = fs.readFileSync("components/contractor/MyTrustHubSave.tsx", "utf8"), issue = fs.readFileSync("app/api/my-trusthub/issue/route.ts", "utf8");
  assert.match(legacy, /@deprecated LEGACY/); assert.match(issue, /@deprecated LEGACY/);
  for (const file of fs.readdirSync("lib/my-trusthub").map((f) => "lib/my-trusthub/" + f).concat(["components/contractor/SaveContractorToggle.tsx", "app/api/my-trusthub/profile-save/route.ts", "app/api/my-trusthub/profile-save/source/route.ts"]))
    assert.doesNotMatch(fs.readFileSync(file, "utf8"), /MyTrustHubSave|my\/handoff\/start|my\/handoff\/arrive|handoff\/issue|MY_TRUSTHUB_P13_CONTRACTOR_SECRET|MY_TRUSTHUB_CONTRACTOR_SAVE_ENABLED/, file);
  assert.equal(ONE_ACCOUNT_PRESENTATION, false); assert.equal(MY_TRUSTHUB_ACCOUNT_HREF, "https://www.asktrusthub.com/my"); assert.equal(workspaceSyncCopy(false).linkLabel, "Optional account");
  for (const route of ["app/account/page.tsx", "app/watch/page.tsx", "app/projects/page.tsx", "app/compare/page.tsx", "app/passport/page.tsx", "app/tools/page.tsx", "app/my-contractor/page.tsx",
    "schema/migrations/016_my_trusthub_handoff_acks.sql"]) assert.ok(fs.existsSync(route), route);
});
