/**
 * Signed Save manifest (Contractor -> My TrustHub), server-side only.
 *
 * The manifest is the only statement of identity the parent receives. It is
 * built on the server from Contractor's own publication read and signed with
 * the Contractor service key. The browser carries an opaque reference to it and
 * never supplies any of its fields.
 *
 * Fields (fixed set, fixed order):
 *   hub = contractor, audience = ask, intent = save | unsave
 *   profile_class = contractor_profile
 *   identifier_namespace = fl.dbpr.license
 *   source_identifier = the exact DBPR external_key
 *   jurisdiction = FL
 *   canonical_return_path = /contractors/<slug>
 *   browser = SHA-256 of this browser's hand-off binding
 *   issued_at / expires_at (ten minutes) and a single-use nonce
 *
 * Deliberately absent: any network or contractor UUID, display or legal name,
 * email, a free-form license id.
 *
 * Wire form: base64url(header).base64url(payload).base64url(Ed25519 signature)
 * over "header.payload". The shared parent runtime is still being built; this
 * envelope is Contractor's side of it and may be re-wrapped to match the final
 * shared contract without changing the manifest fields.
 */
import { createHash, createPrivateKey, createPublicKey, randomBytes, sign, verify } from "node:crypto";
import { CONTRACTOR_SLUG, FL_DBPR, FL_DBPR_KEY, type ContractorSaveIdentity } from "./profile-identity";

export const MANIFEST_VERSION = "contractor-profile-save/1" as const;
export const MANIFEST_TTL_SECONDS = 600;
export type SaveIntent = "save" | "unsave";
export type SaveManifest = {
  version: typeof MANIFEST_VERSION;
  hub: "contractor";
  audience: "ask";
  intent: SaveIntent;
  profile_class: "contractor_profile";
  identifier_namespace: typeof FL_DBPR.namespace;
  source_identifier: string;
  jurisdiction: typeof FL_DBPR.jurisdiction;
  canonical_return_path: string;
  browser: string;
  nonce: string;
  issued_at: number;
  expires_at: number;
};
export type ManifestKey = { kid: string; pem: string };

const OPAQUE = /^[A-Za-z0-9_-]{43}$/;
const KID = /^[A-Za-z0-9_-]{1,64}$/;
const FIELDS = ["version", "hub", "audience", "intent", "profile_class", "identifier_namespace", "source_identifier", "jurisdiction",
  "canonical_return_path", "browser", "nonce", "issued_at", "expires_at"] as const;
const b64 = (value: Buffer | string) => Buffer.from(value).toString("base64url");
export const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

export function buildManifest(identity: ContractorSaveIdentity, intent: SaveIntent, browserBinding: string, now = Date.now()): SaveManifest {
  if (!OPAQUE.test(browserBinding)) throw new Error("invalid_browser_binding");
  if (intent !== "save" && intent !== "unsave") throw new Error("invalid_intent");
  const issued = Math.floor(now / 1000);
  const manifest: SaveManifest = {
    version: MANIFEST_VERSION, hub: "contractor", audience: "ask", intent,
    profile_class: identity.profileClass, identifier_namespace: identity.identifierNamespace, source_identifier: identity.sourceIdentifier,
    jurisdiction: identity.jurisdiction, canonical_return_path: identity.returnPath,
    browser: sha256(browserBinding), nonce: randomBytes(32).toString("base64url"), issued_at: issued, expires_at: issued + MANIFEST_TTL_SECONDS,
  };
  if (!isManifest(manifest)) throw new Error("invalid_manifest");
  return manifest;
}

/** Closed shape: exactly the fields above with exactly these values. */
export function isManifest(value: unknown): value is SaveManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const m = value as Record<string, unknown>;
  if (Object.keys(m).length !== FIELDS.length || !FIELDS.every((field) => Object.hasOwn(m, field))) return false;
  return m.version === MANIFEST_VERSION && m.hub === "contractor" && m.audience === "ask" && (m.intent === "save" || m.intent === "unsave") &&
    m.profile_class === "contractor_profile" && m.identifier_namespace === FL_DBPR.namespace && m.jurisdiction === FL_DBPR.jurisdiction &&
    typeof m.source_identifier === "string" && FL_DBPR_KEY.test(m.source_identifier) &&
    typeof m.canonical_return_path === "string" && m.canonical_return_path.startsWith("/contractors/") && CONTRACTOR_SLUG.test(m.canonical_return_path.slice("/contractors/".length)) &&
    typeof m.browser === "string" && /^[a-f0-9]{64}$/.test(m.browser) && typeof m.nonce === "string" && OPAQUE.test(m.nonce) &&
    Number.isInteger(m.issued_at) && Number.isInteger(m.expires_at) && (m.expires_at as number) - (m.issued_at as number) === MANIFEST_TTL_SECONDS;
}

/** Canonical bytes: the fixed field order above, no whitespace. */
export function manifestBytes(manifest: SaveManifest): Buffer {
  return Buffer.from(JSON.stringify(Object.fromEntries(FIELDS.map((field) => [field, manifest[field]]))));
}
export const manifestDigest = (manifest: SaveManifest) => sha256(manifestBytes(manifest));

/** The Contractor signing key, or null when it is not configured. Ed25519 only. */
export function manifestSigningKey(env: Record<string, string | undefined> = process.env): ManifestKey | null {
  const kid = env.MY_TRUSTHUB_CONTRACTOR_KEY_ID ?? "", pem = env.MY_TRUSTHUB_CONTRACTOR_SIGNING_PRIVATE_KEY_PEM ?? "";
  if (!KID.test(kid) || !pem) return null;
  try { return createPrivateKey(pem).asymmetricKeyType === "ed25519" ? { kid, pem } : null; } catch { return null; }
}

export function signManifest(manifest: SaveManifest, key: ManifestKey): string {
  if (!isManifest(manifest) || !KID.test(key.kid)) throw new Error("invalid_manifest");
  const priv = createPrivateKey(key.pem);
  if (priv.asymmetricKeyType !== "ed25519") throw new Error("invalid_key");
  const head = b64(JSON.stringify({ alg: "EdDSA", typ: "trusthub-save-manifest", kid: key.kid, v: MANIFEST_VERSION }));
  const body = b64(manifestBytes(manifest));
  return `${head}.${body}.${b64(sign(null, Buffer.from(`${head}.${body}`), priv))}`;
}

/** Reference verification (what the parent does): signature, key id, closed
 * shape, canonical encoding, time window, and the browser it was issued for. */
export function verifyManifest(token: unknown, key: { kid: string; pem: string }, browserBinding: string, now = Date.now()): SaveManifest | null {
  try {
    if (typeof token !== "string" || token.length > 4096) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const header = JSON.parse(Buffer.from(parts[0]!, "base64url").toString("utf8")) as Record<string, unknown>;
    if (header.alg !== "EdDSA" || header.typ !== "trusthub-save-manifest" || header.kid !== key.kid || header.v !== MANIFEST_VERSION) return null;
    const pub = createPublicKey(key.pem);
    if (pub.asymmetricKeyType !== "ed25519" || !verify(null, Buffer.from(`${parts[0]}.${parts[1]}`), pub, Buffer.from(parts[2]!, "base64url"))) return null;
    const raw = Buffer.from(parts[1]!, "base64url");
    const manifest = JSON.parse(raw.toString("utf8")) as unknown;
    if (!isManifest(manifest) || !manifestBytes(manifest).equals(raw)) return null;
    const seconds = Math.floor(now / 1000);
    if (manifest.issued_at > seconds + 2 || manifest.expires_at <= seconds) return null;
    if (manifest.browser !== sha256(browserBinding)) return null;
    return manifest;
  } catch { return null; }
}
