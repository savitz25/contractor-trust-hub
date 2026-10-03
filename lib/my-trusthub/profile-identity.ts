/**
 * My TrustHub — Contractor profile classes and exact identity (PREP ONLY).
 *
 * Nothing here talks to My TrustHub. It states, for each kind of public profile
 * Contractor Trust Hub renders, what its exact identity is and whether that
 * identity is safe to hand to the one My TrustHub account later.
 *
 * Contractor has more than one identity grain and they are kept apart:
 *
 *   contractor_profile   /contractors/<slug>   one `contractors` row (a resolved
 *                        licensee/business) with its attached regulator
 *                        credentials. Native id = contractors.id. The network
 *                        binding names the profile AND one exact credential
 *                        (namespace e.g. fl.dbpr.license, the regulator's own
 *                        license key, its jurisdiction), so the profile must
 *                        still carry that credential.
 *
 *   standalone_credential /credentials/<id>    one `licenses` row with no
 *                        contractor attached (a person or regulatory
 *                        credential record). Native id = (source_system,
 *                        external_key). A different grain: it is never folded
 *                        into a contractor profile and has no Save control.
 *
 * Never an identity: display or legal name, a slug by itself, an email, a
 * browser-made id, a fuzzy or name match, a linked corporate entity, a permit,
 * an enforcement row. Anything ambiguous or unresolved is not parent-ready.
 */
import type { ContractorDetail } from "@/lib/contractors/types";

export type ContractorProfileClass = "contractor_profile" | "standalone_credential";

/** Reviewed exact credential sources per jurisdiction, with the network
 * identifier namespace each maps to. The inventory is the one the claim
 * doorway already relies on (lib/claim/eligibility.ts, 2026-09-24): FL
 * `fl_dbpr` and NJ `nj_dca` are the credential sources proven exact and
 * published. `fl.dbpr.license` is the namespace My TrustHub already uses for
 * Contractor bindings. Every other source is not parent-ready until reviewed. */
export const PARENT_READY_CREDENTIAL_SOURCES = {
  FL: { sourceSystem: "fl_dbpr", namespace: "fl.dbpr.license" },
  NJ: { sourceSystem: "nj_dca", namespace: "nj.dca.license" },
} as const;
export type ParentReadyJurisdiction = keyof typeof PARENT_READY_CREDENTIAL_SOURCES;

export type ExactCredential = { namespace: string; jurisdiction: ParentReadyJurisdiction; sourceSystem: string; externalKey: string };
export type ContractorSaveIdentity = {
  hub: "contractor";
  profileClass: "contractor_profile";
  /** contractors.id */
  nativeId: string;
  canonicalSlug: string;
  /** The only return destination: the canonical Trust Report. */
  returnPath: string;
  /** Exact regulator credentials currently attached to this profile. A parent
   * binding must name this profile and one of these, or it does not match. */
  credentials: ExactCredential[];
};
export type NotReadyReason =
  | "missing_profile_id"
  | "missing_slug"
  | "thin_profile"
  | "no_reviewed_credential"
  | "ambiguous_jurisdiction";
export type ParentSaveReadiness = { ready: true; identity: ContractorSaveIdentity } | { ready: false; reason: NotReadyReason };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9][a-z0-9-]{0,199}$/;
/** Regulator license keys are short printable tokens; anything else is not exact. */
const EXTERNAL_KEY = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,79}$/;

/** A profile may carry a device Save when it is a real, non-thin Trust Report
 * with an exact profile id and canonical slug. This is local only. */
export function deviceSaveAllowed(contractor: Pick<ContractorDetail, "id" | "slug" | "isThinProfile">): boolean {
  return UUID.test(contractor.id ?? "") && SLUG.test(contractor.slug ?? "") && !contractor.isThinProfile;
}

/** Exact identity for a future My TrustHub Save, or the reason there is none.
 * Fails closed: no id, no slug, a thin profile, no reviewed credential, or
 * reviewed credentials in more than one jurisdiction all return not ready. */
export function parentSaveReadiness(contractor: ContractorDetail): ParentSaveReadiness {
  if (!UUID.test(contractor.id ?? "")) return { ready: false, reason: "missing_profile_id" };
  if (!SLUG.test(contractor.slug ?? "")) return { ready: false, reason: "missing_slug" };
  if (contractor.isThinProfile) return { ready: false, reason: "thin_profile" };
  const credentials: ExactCredential[] = [];
  for (const [jurisdiction, source] of Object.entries(PARENT_READY_CREDENTIAL_SOURCES) as Array<[ParentReadyJurisdiction, (typeof PARENT_READY_CREDENTIAL_SOURCES)[ParentReadyJurisdiction]]>) {
    for (const license of contractor.licenses) {
      const key = (license.externalKey ?? "").trim();
      if (license.sourceSystem !== source.sourceSystem || !EXTERNAL_KEY.test(key)) continue;
      if (!credentials.some((c) => c.namespace === source.namespace && c.externalKey === key))
        credentials.push({ namespace: source.namespace, jurisdiction, sourceSystem: source.sourceSystem, externalKey: key });
    }
  }
  if (credentials.length === 0) return { ready: false, reason: "no_reviewed_credential" };
  // One profile, one jurisdiction. A profile holding reviewed credentials in two
  // jurisdictions has no single binding grain yet; it is left unresolved.
  if (new Set(credentials.map((c) => c.jurisdiction)).size !== 1) return { ready: false, reason: "ambiguous_jurisdiction" };
  credentials.sort((a, b) => a.externalKey.localeCompare(b.externalKey));
  return { ready: true, identity: { hub: "contractor", profileClass: "contractor_profile", nativeId: contractor.id, canonicalSlug: contractor.slug,
    returnPath: "/contractors/" + contractor.slug, credentials } };
}

/** A parent binding agrees with a profile only on the exact grain: same hub,
 * class and profile id, an accepted status, and a credential the profile still
 * carries in the same namespace and jurisdiction. */
export function bindingMatchesIdentity(identity: ContractorSaveIdentity, binding: {
  hub: string; specialistEntityType: string; specialistEntityId: string; identifierNamespace: string; sourceIdentifier: string; jurisdiction: string | null; status: string;
}): boolean {
  return binding.status === "accepted" && binding.hub === "contractor" && binding.specialistEntityType === identity.profileClass &&
    binding.specialistEntityId === identity.nativeId &&
    identity.credentials.some((c) => c.namespace === binding.identifierNamespace && c.externalKey === binding.sourceIdentifier && c.jurisdiction === binding.jurisdiction);
}
