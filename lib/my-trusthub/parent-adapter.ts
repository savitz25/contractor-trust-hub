/**
 * My TrustHub — Contractor parent adapter (server side). PRODUCTION SYNC IS OFF.
 *
 * The production pattern proven on Move, for Florida DBPR contractor profiles:
 *
 *   1. The device Save happens first and never waits for anything.
 *   2. This server proves the profile is public and derives its exact identity
 *      (publication.ts). The browser supplies only the slug of the page it is
 *      on; it never supplies an identity.
 *   3. This server builds and signs the manifest (manifest.ts).
 *   4. The parent port stages the hand-off with My TrustHub: exactly one
 *      accepted binding for that identity, or not eligible.
 *   5. The browser is handed to the parent form, which commits or removes under
 *      the verified My TrustHub session and returns to the canonical profile.
 *   6. An account Save or Unsave is reported only when this server holds the
 *      parent's signed acknowledgement for that hand-off.
 *
 * Modes:
 *   off      (default, and the ONLY mode a production deployment can be in)
 *            every request is "unavailable"; nothing is read, built or signed.
 *   dry_run  (never in production) runs steps 2 and 3 and stops: it reports the
 *            staged identity and manifest digest and contacts nobody.
 * There is no live mode in this ship. The parent port has no transport: the
 * shared My TrustHub runtime for Contractor does not exist yet, so nothing can
 * be staged with Ask from here.
 */
import { buildManifest, manifestDigest, signManifest, type ManifestKey, type SaveIntent, type SaveManifest } from "./manifest";
import type { ContractorSaveIdentity } from "./profile-identity";
import { resolveBySlug, type ProfileReader, type Resolution } from "./publication";

export type ParentSyncMode = "off" | "dry_run";
export function parentSyncMode(env: Record<string, string | undefined> = process.env): ParentSyncMode {
  if (env.VERCEL_ENV === "production") return "off";
  return env.MY_TRUSTHUB_CONTRACTOR_SYNC_MODE === "dry_run" ? "dry_run" : "off";
}

/** What the future shared runtime implements. */
export interface ContractorParentPort {
  /** Stage one hand-off with the parent for a signed manifest. Returns the
   * opaque ticket and the fixed parent form target, or null when the parent
   * holds no single accepted binding for the identity or is unavailable. */
  stage(manifest: SaveManifest, signed: string): Promise<{ ticket: string; target: string; continuationRef: string } | null>;
  /** Whether the parent's signed acknowledgement is held for a ticket issued to this browser. */
  acknowledged(ticket: string, browserBinding: string): Promise<boolean>;
}
/** The port in this ship: nothing is staged, nothing is acknowledged. */
export const DISABLED_PARENT_PORT: ContractorParentPort = { stage: async () => null, acknowledged: async () => false };

export type PrepareResult =
  | { state: "unavailable"; localCopy: "keep" }
  | { state: "local_only"; reason: Exclude<Resolution, { eligible: true }>["reason"] | "no_accepted_binding"; localCopy: "keep" }
  | { state: "staged_dry_run"; identity: PublicIdentity; manifestDigest: string; signed: boolean; localCopy: "keep" }
  | { state: "continue"; ticket: string; target: string; fields: { continuationRef: string }; localCopy: "keep" };
/** The identity as it may be shown to the browser: public regulator facts only. */
export type PublicIdentity = Pick<ContractorSaveIdentity, "profileClass" | "identifierNamespace" | "sourceIdentifier" | "jurisdiction" | "returnPath">;

export type AdapterDeps = {
  mode: ParentSyncMode;
  reader: ProfileReader;
  /** Null in every deployment today. */
  key: ManifestKey | null;
  port: ContractorParentPort;
  now(): number;
};

const OPAQUE = /^[A-Za-z0-9_-]{43}$/;
/** Exactly the production Ask form. No other host or path is ever handed to. */
export const PARENT_FORM_TARGET = "https://www.asktrusthub.com/my/profile-save";

/** Prepare one Save or Unsave for the profile at `slug`. The device copy is
 * never affected by the outcome. */
export async function prepareParentSave(deps: AdapterDeps, slug: unknown, intent: unknown, browserBinding: string): Promise<PrepareResult> {
  if (deps.mode === "off") return { state: "unavailable", localCopy: "keep" };
  if ((intent !== "save" && intent !== "unsave") || !OPAQUE.test(browserBinding)) return { state: "unavailable", localCopy: "keep" };
  const resolved = await resolveBySlug(deps.reader, slug);
  if (!resolved.eligible) return { state: "local_only", reason: resolved.reason, localCopy: "keep" };
  const identity = resolved.identity;
  const manifest = buildManifest(identity, intent as SaveIntent, browserBinding, deps.now());
  const signed = deps.key ? signManifest(manifest, deps.key) : null;
  const shown: PublicIdentity = { profileClass: identity.profileClass, identifierNamespace: identity.identifierNamespace,
    sourceIdentifier: identity.sourceIdentifier, jurisdiction: identity.jurisdiction, returnPath: identity.returnPath };
  if (deps.mode === "dry_run") return { state: "staged_dry_run", identity: shown, manifestDigest: manifestDigest(manifest), signed: signed !== null, localCopy: "keep" };
  // No live mode exists; kept so the shape of the eventual path is reviewable.
  if (!signed) return { state: "unavailable", localCopy: "keep" };
  const staged = await deps.port.stage(manifest, signed);
  if (!staged) return { state: "local_only", reason: "no_accepted_binding", localCopy: "keep" };
  if (!OPAQUE.test(staged.ticket) || !OPAQUE.test(staged.continuationRef) || staged.target !== PARENT_FORM_TARGET) return { state: "unavailable", localCopy: "keep" };
  return { state: "continue", ticket: staged.ticket, target: staged.target, fields: { continuationRef: staged.continuationRef }, localCopy: "keep" };
}

/** Presentation only: whether the parent acknowledged a hand-off. */
export async function parentStatus(deps: AdapterDeps, ticket: unknown, browserBinding: string): Promise<"parent_acknowledged" | "pending" | "unavailable"> {
  if (deps.mode === "off" || typeof ticket !== "string" || !OPAQUE.test(ticket) || !OPAQUE.test(browserBinding)) return "unavailable";
  if (deps.mode === "dry_run") return "pending";
  return (await deps.port.acknowledged(ticket, browserBinding)) ? "parent_acknowledged" : "pending";
}
