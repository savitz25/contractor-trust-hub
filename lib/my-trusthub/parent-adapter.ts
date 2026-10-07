/**
 * My TrustHub — Contractor parent adapter (server side).
 *
 * ONE-PROFILE ACTIVATION ARTIFACT. Do not merge until every prerequisite in
 * docs/my-trusthub/ONE-PROFILE-CANARY.md is done and an operator authorizes
 * the canary window. This commit is not a production deployment.
 *
 * SHUTOFF: CONTRACTOR_CANARY_ACTIVE is false. CONTRACTOR_CANARIES contains only
 * ccc057187-a-r-roofing-inc. CONTRACTOR_PARENT_SYNC_BROAD stays false.
 * The server gate is closed for every profile. Leaving
 * NEXT_PUBLIC_MY_TRUSTHUB_CONTRACTOR_SYNC unset stops the browser from
 * starting the hand-off and is not the security kill switch.
 *
 * Contractor speaks the shared production hand-off protocol used by Move and
 * Lender. Only the specialist identity differs.
 *
 *   1. The device Save happens first and never waits for anything.
 *   2. This server proves the profile is public and derives its exact Florida
 *      DBPR identity (publication.ts). The browser supplies only the slug of
 *      the page it is on and an intent.
 *   3. This server builds the shared v3 manifest (manifest.ts) and stages it
 *      with My TrustHub in two signed calls:
 *        prepareGuestProfileTransfer    -> transferRef, manifestDigest
 *        prepareProfileSaveContinuation -> continuationRef
 *      each a POST of { version, operation, input } to the parent API carrying
 *      a Contractor service assertion (contractor-assertion.ts, scope
 *      transfer:stage, bound to this browser's hand-off binding).
 *   4. The browser posts { continuationRef, intent } to the parent form at
 *      https://www.asktrusthub.com/my/profile-save (top-level navigation).
 *   5. The parent calls back over the signed source channel
 *      (source-callback.ts): resolve, source, acknowledge.
 *   6. An account Save or Unsave is reported only when the acknowledgement for
 *      that hand-off and this browser is held (ack-store.ts).
 *
 * GATE. Activation is a reviewed code change, not an environment flag.
 * CONTRACTOR_PARENT_SYNC_BROAD and CONTRACTOR_CANARY_ACTIVE are constants.
 * This shutoff sets the canary constant false and leaves broad false. With both constants false, nothing is read, built, signed or sent.
 *   dry_run (never in production, and only while the gate constants are both
 *   false) runs steps 2-3 without the parent calls and reports the staged
 *   identity; it contacts nobody.
 */
import { ASSERTION_HEADER, signContractorAssertion, type AssertionKey } from "./contractor-assertion";
import type { AckStore } from "./ack-store";
import { PARENT_API_PATH, PARENT_FORM_PATH, PARENT_ORIGIN, RUNTIME_VERSION, contractorManifest, manifestDigest, type ContractorManifest } from "./manifest";
import type { ContractorSaveIdentity } from "./profile-identity";
import { resolveBySlug, type ProfileReader, type Resolution } from "./publication";

export const CONTRACTOR_PARENT_SYNC_BROAD = false;
/** Forward-fix shutoff: preserve the one-profile list and close the gate. */
export const CONTRACTOR_CANARY_ACTIVE = false;
/** The only profile this activation admits. Slug is the page; the identity is
 * always derived on the server. CFC1427249 and CGC1517216 stay off this list
 * until a later reviewed change after this profile's Save chain passes. */
export const CONTRACTOR_CANARIES = [
  { slug: "ccc057187-a-r-roofing-inc", externalKey: "CCC057187" },
] as const;

export type ParentGate = { broad: boolean; canary: boolean };
export function productionParentGate(): ParentGate {
  return { broad: CONTRACTOR_PARENT_SYNC_BROAD, canary: CONTRACTOR_CANARY_ACTIVE };
}
/** A profile may hand off only when the gate admits it. */
export function gateAllows(slug: string, gate: ParentGate): boolean {
  if (gate.broad) return true;
  return gate.canary && CONTRACTOR_CANARIES.some((item) => item.slug === slug);
}

export type ParentSyncMode = "off" | "dry_run" | "gated";
/** off: both gate constants are false. gated: this activation (canary true,
 * one slug, broad false) or a later reviewed gate. dry_run: non-production
 * only, and only while both constants are false. No parent calls. */
export function parentSyncMode(env: Record<string, string | undefined> = process.env, gate: ParentGate = productionParentGate()): ParentSyncMode {
  if (gate.broad || gate.canary) return "gated";
  if (env.VERCEL_ENV === "production") return "off";
  return env.MY_TRUSTHUB_CONTRACTOR_SYNC_MODE === "dry_run" ? "dry_run" : "off";
}

export type HandoffIntent = "save" | "save_signin" | "unsave";
const INTENTS: readonly string[] = ["save", "save_signin", "unsave"];
export type ParentResult = { transferRef?: string; manifestDigest?: string; continuationRef?: string; expiresAt?: number };
export type ParentResponse = { ok: true; operation: string; result: ParentResult } | { ok: false };
export type ParentTransport = (call: { operation: string; body: string; assertion: string }) => Promise<ParentResponse>;

/** Production signer and transport, from dedicated Contractor values. Returns
 * nothing usable unless the key is present and the parent origin, if set, is
 * exactly the pinned Ask origin. Only called when the gate is open. */
export function productionHandoffDeps(env: Record<string, string | undefined> = process.env): { key: AssertionKey | null; parent: ParentTransport | null } {
  const kid = env.MY_TRUSTHUB_V23_CONTRACTOR_KEY_ID?.trim() ?? "";
  const pem = env.MY_TRUSTHUB_V23_CONTRACTOR_SIGNING_PRIVATE_KEY_PEM ?? "";
  const configured = env.MY_TRUSTHUB_V23_PARENT_ORIGIN?.trim();
  if (configured && configured !== PARENT_ORIGIN) return { key: null, parent: null };
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(kid) || !pem.includes("PRIVATE KEY")) return { key: null, parent: null };
  return {
    key: { kid, pem },
    parent: async (call) => {
      const response = await fetch(PARENT_ORIGIN + PARENT_API_PATH, {
        method: "POST", body: call.body, headers: { "content-type": "application/json", [ASSERTION_HEADER]: call.assertion },
        cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return { ok: false };
      const body = (await response.json()) as { ok?: boolean; operation?: string; result?: ParentResult };
      if (!body || body.ok !== true || typeof body.operation !== "string" || !body.result) return { ok: false };
      return { ok: true, operation: body.operation, result: body.result };
    },
  };
}

/** The identity as it may be shown to the browser: public regulator facts only. */
export type PublicIdentity = Pick<ContractorSaveIdentity, "profileClass" | "identifierNamespace" | "sourceIdentifier" | "jurisdiction" | "returnPath">;
export type PrepareResult =
  | { state: "unavailable"; localCopy: "keep" }
  | { state: "local_only"; reason: Exclude<Resolution, { eligible: true }>["reason"] | "sync_off" | "unsigned" | "parent_declined"; localCopy: "keep" }
  | { state: "staged_dry_run"; identity: PublicIdentity; nativeId: string; manifestDigest: string; localCopy: "keep" }
  | { state: "continue"; target: string; continuationRef: string; intent: HandoffIntent; localCopy: "keep" };

export type AdapterDeps = {
  mode: ParentSyncMode;
  gate: ParentGate;
  reader: ProfileReader;
  key: AssertionKey | null;
  parent: ParentTransport | null;
  acks: AckStore | null;
  now(): number;
};

const OPAQUE = /^[A-Za-z0-9_-]{43}$/;
const keep = { localCopy: "keep" } as const;

async function postParent(deps: AdapterDeps, operation: "prepareGuestProfileTransfer" | "prepareProfileSaveContinuation",
  input: ContractorManifest | { sourceHub: "contractor"; audience: "ask"; transferRef: string; manifestDigest: string }, browser: string, now: number): Promise<ParentResult | null> {
  if (!deps.key || !deps.parent) return null;
  const body = JSON.stringify({ version: RUNTIME_VERSION, operation, input });
  const assertion = signContractorAssertion(deps.key, "contractor", PARENT_ORIGIN + PARENT_API_PATH, "transfer:stage", Buffer.from(body), browser, null, null, now);
  const response = await deps.parent({ operation, body, assertion });
  if (!response.ok || response.operation !== operation) return null;
  return response.result;
}

/** Prepare one Save or Unsave for the profile at `slug`. The device copy is
 * never affected by the outcome. `browserBinding` is this browser's HttpOnly
 * hand-off binding; it is the assertion's browser claim. */
export async function prepareParentSave(deps: AdapterDeps, slug: unknown, intent: unknown, browserBinding: string): Promise<PrepareResult> {
  if (deps.mode === "off") return { state: "unavailable", ...keep };
  if (typeof intent !== "string" || !INTENTS.includes(intent) || !OPAQUE.test(browserBinding)) return { state: "unavailable", ...keep };
  const resolved = await resolveBySlug(deps.reader, slug);
  if (!resolved.eligible) return { state: "local_only", reason: resolved.reason, ...keep };
  const identity = resolved.identity, manifest = contractorManifest(identity);
  if (deps.mode === "dry_run") {
    return { state: "staged_dry_run", nativeId: manifest.returnTask.profile.nativeId, manifestDigest: manifestDigest(manifest), ...keep,
      identity: { profileClass: identity.profileClass, identifierNamespace: identity.identifierNamespace, sourceIdentifier: identity.sourceIdentifier, jurisdiction: identity.jurisdiction, returnPath: identity.returnPath } };
  }
  if (!gateAllows(identity.canonicalSlug, deps.gate)) return { state: "local_only", reason: "sync_off", ...keep };
  if (!deps.key || !deps.parent) return { state: "local_only", reason: "unsigned", ...keep };
  const now = deps.now();
  try {
    const staged = await postParent(deps, "prepareGuestProfileTransfer", manifest, browserBinding, now);
    // The parent stages nothing unless it holds exactly one accepted binding for this identity.
    if (!staged) return { state: "local_only", reason: "parent_declined", ...keep };
    if (staged.manifestDigest !== manifestDigest(manifest) || !OPAQUE.test(String(staged.transferRef)) ||
      !Number.isFinite(staged.expiresAt) || (staged.expiresAt ?? 0) <= now) return { state: "unavailable", ...keep };
    const continuation = await postParent(deps, "prepareProfileSaveContinuation",
      { sourceHub: "contractor", audience: "ask", transferRef: staged.transferRef!, manifestDigest: staged.manifestDigest! }, browserBinding, now);
    if (!continuation || !OPAQUE.test(String(continuation.continuationRef)) || !Number.isFinite(continuation.expiresAt) ||
      (continuation.expiresAt ?? 0) <= now || (continuation.expiresAt ?? 0) > (staged.expiresAt ?? 0)) return { state: "unavailable", ...keep };
    return { state: "continue", target: PARENT_ORIGIN + PARENT_FORM_PATH, continuationRef: continuation.continuationRef!, intent: intent as HandoffIntent, ...keep };
  } catch {
    return { state: "unavailable", ...keep };
  }
}

/** Presentation only: what the parent acknowledged for one hand-off staged for
 * this browser. `unavailable` when it cannot be read; never a guess. */
export async function parentStatus(deps: AdapterDeps, continuationRef: unknown, browserBinding: string): Promise<"parent_acknowledged" | "pending" | "unavailable"> {
  if (deps.mode !== "gated" || typeof continuationRef !== "string" || !OPAQUE.test(continuationRef) || !OPAQUE.test(browserBinding) || !deps.acks) return "unavailable";
  try {
    return (await deps.acks.read(continuationRef, browserBinding, deps.now())) ? "parent_acknowledged" : "pending";
  } catch {
    return "unavailable";
  }
}
