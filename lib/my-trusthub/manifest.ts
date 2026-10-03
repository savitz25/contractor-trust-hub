/**
 * Shared My TrustHub profile-transfer manifest, Contractor edition.
 *
 * This is the production wire used by Move and Lender ("v2-3/selected-profiles/3",
 * staged through "v2-3/parent-runtime/1"). Only the specialist identity differs.
 * The digest is the shared positional SHA-256; field order matches Ask.
 *
 * Contractor identity inside the shared ProfileIdentity {hub, nativeId, profileClass}:
 *
 *   hub          contractor
 *   profileClass contractor_profile
 *   nativeId     fl.dbpr.license:<DBPR external_key>     e.g. fl.dbpr.license:CCC057187
 *
 * The native id carries the whole locked identity: the identifier namespace
 * (fl.dbpr.license), which fixes the jurisdiction (FL), and the exact DBPR
 * license key as the source identifier. It is the same construction Lender
 * uses (nmls:<number>). It never contains contractors.id, a slug or a name.
 * The return path is /contractors/<slug>, the shared v3 route for this hub.
 */
import { createHash } from "node:crypto";
import { CONTRACTOR_SLUG, FL_DBPR, FL_DBPR_KEY, type ContractorSaveIdentity } from "./profile-identity";

export const TRANSFER_VERSION_V3 = "v2-3/selected-profiles/3" as const;
export const RUNTIME_VERSION = "v2-3/parent-runtime/1" as const;
export const PARENT_ORIGIN = "https://www.asktrusthub.com";
export const CONTRACTOR_ORIGIN = "https://www.contractortrusthub.com";
export const PARENT_API_PATH = "/api/my-trusthub/profile-save";
export const PARENT_FORM_PATH = "/my/profile-save";
export const SOURCE_PATH = PARENT_API_PATH + "/source";
export const CONTRACTOR_PROFILE_CLASS = "contractor_profile" as const;

export type ContractorProfile = { hub: "contractor"; nativeId: string; profileClass: typeof CONTRACTOR_PROFILE_CLASS };
export type ContractorManifest = {
  version: typeof TRANSFER_VERSION_V3;
  sourceHub: "contractor";
  audience: "ask";
  selected: Array<{ localItemId: string; revision: string; digest: string; profile: ContractorProfile }>;
  returnTask: { kind: "profile"; hub: "contractor"; canonicalSlug: string; profile: ContractorProfile; returnPath: string };
};

const NATIVE_PREFIX = FL_DBPR.namespace + ":";
/** fl.dbpr.license:<key> for a well-formed DBPR key, else null. */
export function contractorNativeId(externalKey: string): string | null {
  return FL_DBPR_KEY.test(externalKey) ? NATIVE_PREFIX + externalKey : null;
}
/** The locked identity fields carried by a native id, or null if it is not exactly this grain. */
export function parseContractorNativeId(nativeId: unknown): { identifierNamespace: typeof FL_DBPR.namespace; sourceIdentifier: string; jurisdiction: typeof FL_DBPR.jurisdiction } | null {
  if (typeof nativeId !== "string" || !nativeId.startsWith(NATIVE_PREFIX)) return null;
  const key = nativeId.slice(NATIVE_PREFIX.length);
  return FL_DBPR_KEY.test(key) ? { identifierNamespace: FL_DBPR.namespace, sourceIdentifier: key, jurisdiction: FL_DBPR.jurisdiction } : null;
}
export const contractorReturnPath = (slug: string) => `/contractors/${slug}`;

export function contractorItemDigest(nativeId: string, returnPath: string): string {
  return createHash("sha256").update(JSON.stringify([nativeId, returnPath])).digest("hex");
}

/** Built on the server from the publication read. Throws on anything not exact. */
export function contractorManifest(identity: Pick<ContractorSaveIdentity, "sourceIdentifier" | "canonicalSlug">): ContractorManifest {
  const nativeId = contractorNativeId(identity.sourceIdentifier);
  if (!nativeId || !CONTRACTOR_SLUG.test(identity.canonicalSlug)) throw new Error("invalid_identity");
  const returnPath = contractorReturnPath(identity.canonicalSlug);
  const profile: ContractorProfile = { hub: "contractor", nativeId, profileClass: CONTRACTOR_PROFILE_CLASS };
  return {
    version: TRANSFER_VERSION_V3, sourceHub: "contractor", audience: "ask",
    selected: [{ localItemId: identity.canonicalSlug, revision: "1", digest: contractorItemDigest(nativeId, returnPath), profile }],
    returnTask: { kind: "profile", hub: "contractor", canonicalSlug: identity.canonicalSlug, profile, returnPath },
  };
}

/** Closed shape: exactly one selected Florida profile that is also the return task. */
export function isContractorManifest(value: unknown): value is ContractorManifest {
  const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
  const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));
  const profile = (v: unknown): v is ContractorProfile => object(v) && exact(v, ["hub", "nativeId", "profileClass"]) && v.hub === "contractor" &&
    v.profileClass === CONTRACTOR_PROFILE_CLASS && parseContractorNativeId(v.nativeId) !== null;
  if (!object(value) || !exact(value, ["version", "sourceHub", "audience", "selected", "returnTask"])) return false;
  if (value.version !== TRANSFER_VERSION_V3 || value.sourceHub !== "contractor" || value.audience !== "ask") return false;
  const task = value.returnTask, selected = value.selected;
  if (!object(task) || !exact(task, ["kind", "hub", "canonicalSlug", "profile", "returnPath"]) || task.kind !== "profile" || task.hub !== "contractor" || !profile(task.profile)) return false;
  if (typeof task.canonicalSlug !== "string" || !CONTRACTOR_SLUG.test(task.canonicalSlug) || task.returnPath !== contractorReturnPath(task.canonicalSlug)) return false;
  if (!Array.isArray(selected) || selected.length !== 1) return false;
  const item = selected[0] as unknown;
  if (!object(item) || !exact(item, ["localItemId", "revision", "digest", "profile"]) || !profile(item.profile)) return false;
  return item.localItemId === task.canonicalSlug && item.revision === "1" && item.profile.nativeId === task.profile.nativeId &&
    item.digest === contractorItemDigest(task.profile.nativeId, task.returnPath as string);
}

/** Shared positional digest (identical to Ask's manifestDigest for version 3). */
export function manifestDigest(v: ContractorManifest): string {
  const profileKey = (p: { hub: string; nativeId: string; profileClass: string }) => JSON.stringify([p.hub, p.nativeId, p.profileClass]);
  const task = [v.returnTask.kind, v.returnTask.hub, v.returnTask.canonicalSlug, v.returnTask.returnPath, profileKey(v.returnTask.profile)];
  return createHash("sha256").update(JSON.stringify([
    v.version, v.sourceHub, v.audience,
    v.selected.map((i) => [i.localItemId, i.revision, i.digest, i.profile.hub, i.profile.nativeId, i.profile.profileClass]),
    task,
  ])).digest("hex");
}
