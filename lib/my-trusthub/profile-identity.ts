/**
 * My TrustHub — Contractor profile classes and exact identity.
 *
 * Nothing here talks to My TrustHub. It states which public profiles carry an
 * identity that is safe to hand to the one My TrustHub account, and what that
 * identity is.
 *
 * FIRST SHIP SCOPE (founder decision, 2026-10-03): Florida DBPR contractor
 * profiles only.
 *
 *   profile class         contractor_profile            (/contractors/<slug>)
 *   identifier namespace  fl.dbpr.license
 *   jurisdiction          FL
 *   native identity       the ONE Florida DBPR license external_key attached to
 *                         the profile (the regulator's own key, unique in
 *                         `licenses` by (source_system, external_key))
 *   return path           /contractors/<slug>
 *
 * What is NOT the identity:
 *   - contractors.id. It is a database-generated UUID whose durability across a
 *     full re-ingest is unproven. It stays an internal local row reference only
 *     and never appears in a parent identity or manifest.
 *   - the slug. It is the return path, nothing more.
 *   - display or legal name, email, a browser-made id, a fuzzy or name match, a
 *     linked corporate entity, a permit, an enforcement row.
 *
 * Device Save only (never parent-synced in this ship): NJ DCA, CA CSLB, TX, WA,
 * AZ, OR, CO, LA, MS, KY and every other source; standalone /credentials/<id>
 * records; thin profiles; a Florida profile with more than one DBPR credential
 * (no single credential can be selected without a rule nobody has decided);
 * a profile that also carries a credential from another source (unresolved
 * multi-jurisdiction identity).
 */
import type { ContractorDetail } from "@/lib/contractors/types";

export type ContractorProfileClass = "contractor_profile" | "standalone_credential";

export const FL_DBPR = { sourceSystem: "fl_dbpr", namespace: "fl.dbpr.license", jurisdiction: "FL" } as const;

export type ContractorSaveIdentity = {
  hub: "contractor";
  profileClass: "contractor_profile";
  identifierNamespace: typeof FL_DBPR.namespace;
  /** The exact DBPR license external_key, e.g. CCC057187. */
  sourceIdentifier: string;
  jurisdiction: typeof FL_DBPR.jurisdiction;
  canonicalSlug: string;
  /** The only return destination: the canonical Trust Report. */
  returnPath: string;
};
export type NotReadyReason =
  | "missing_slug"
  | "thin_profile"
  | "not_florida"
  | "no_fl_dbpr_credential"
  | "invalid_credential_key"
  | "multiple_fl_credentials"
  | "multi_jurisdiction";
export type ParentSaveReadiness = { ready: true; identity: ContractorSaveIdentity } | { ready: false; reason: NotReadyReason };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const CONTRACTOR_SLUG = /^[a-z0-9][a-z0-9-]{0,199}$/;
/** DBPR license keys: a 1–4 letter occupation prefix and 3–9 digits (CCC057187, CGC1517216). */
export const FL_DBPR_KEY = /^[A-Z]{1,4}[0-9]{3,9}$/;

/** A profile may carry a device Save when it is a real, non-thin Trust Report
 * with a local row reference and a canonical slug. Local only. */
export function deviceSaveAllowed(contractor: Pick<ContractorDetail, "id" | "slug" | "isThinProfile">): boolean {
  return UUID.test(contractor.id ?? "") && CONTRACTOR_SLUG.test(contractor.slug ?? "") && !contractor.isThinProfile;
}

/** Exact identity for a My TrustHub Save, or the reason there is none. Fails
 * closed on anything that is not exactly one valid Florida DBPR credential on a
 * public, non-thin, Florida-only profile. */
export function parentSaveReadiness(contractor: ContractorDetail): ParentSaveReadiness {
  if (!CONTRACTOR_SLUG.test(contractor.slug ?? "")) return { ready: false, reason: "missing_slug" };
  if (contractor.isThinProfile) return { ready: false, reason: "thin_profile" };
  if (contractor.homeState !== FL_DBPR.jurisdiction) return { ready: false, reason: "not_florida" };
  // Any credential from another source leaves the identity unresolved across jurisdictions.
  if (contractor.licenses.some((license) => license.sourceSystem !== FL_DBPR.sourceSystem)) return { ready: false, reason: "multi_jurisdiction" };
  const keys = [...new Set(contractor.licenses.map((license) => (license.externalKey ?? "").trim()))];
  if (keys.length === 0) return { ready: false, reason: "no_fl_dbpr_credential" };
  if (keys.some((key) => !FL_DBPR_KEY.test(key))) return { ready: false, reason: "invalid_credential_key" };
  if (keys.length !== 1) return { ready: false, reason: "multiple_fl_credentials" };
  return { ready: true, identity: { hub: "contractor", profileClass: "contractor_profile", identifierNamespace: FL_DBPR.namespace, sourceIdentifier: keys[0]!,
    jurisdiction: FL_DBPR.jurisdiction, canonicalSlug: contractor.slug, returnPath: "/contractors/" + contractor.slug } };
}

/** A parent binding agrees with an identity only on the exact grain: accepted,
 * same hub and class, same namespace, same license key, same jurisdiction. The
 * binding's specialist entity id is deliberately not compared: it may hold a
 * contractor UUID, which is not an identity. */
export function bindingMatchesIdentity(identity: ContractorSaveIdentity, binding: {
  hub: string; specialistEntityType: string; identifierNamespace: string; sourceIdentifier: string; jurisdiction: string | null; status: string;
}): boolean {
  return binding.status === "accepted" && binding.hub === identity.hub && binding.specialistEntityType === identity.profileClass &&
    binding.identifierNamespace === identity.identifierNamespace && binding.sourceIdentifier === identity.sourceIdentifier &&
    binding.jurisdiction === identity.jurisdiction;
}
