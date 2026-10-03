/**
 * Contractor's publication authority for a My TrustHub Save.
 *
 * Source: the same production read that renders /contractors/<slug> — one
 * `contractors` row with its attached `licenses` (getContractorBySlug). Nothing
 * is copied or registered separately.
 * Grain: one `contractors` row, identified to the parent by its single Florida
 * DBPR license key.
 *
 * Two exact questions, both server-side:
 *   bySlug      the profile being saved -> its identity (or why it has none)
 *   byIdentity  the parent's re-check: this exact credential -> the one public
 *               profile that carries it
 * A credential must lead to exactly one public profile and that profile must
 * lead back to the same credential and slug. Anything else is not eligible.
 */
import type { ContractorDetail } from "@/lib/contractors/types";
import { CONTRACTOR_SLUG, isFloridaIdentityInput, parentSaveReadiness, type ContractorSaveIdentity, type NotReadyReason } from "./profile-identity";

export type ProfileReader = {
  /** The Trust Report's own profile read. Null when not public. */
  bySlug(slug: string): Promise<ContractorDetail | null>;
  /** Slugs of contractors carrying this exact fl_dbpr external_key (at most 3). */
  slugsForFloridaCredential(externalKey: string): Promise<string[]>;
};
export type Resolution = { eligible: true; identity: ContractorSaveIdentity } | { eligible: false; reason: NotReadyReason | "not_public" | "credential_not_unique" | "source_unavailable" };

export async function resolveBySlug(reader: ProfileReader, slug: unknown): Promise<Resolution> {
  if (typeof slug !== "string" || !CONTRACTOR_SLUG.test(slug)) return { eligible: false, reason: "missing_slug" };
  try {
    const contractor = await reader.bySlug(slug);
    // The canonical return slug must be the profile's own slug, not an alias of it.
    if (!contractor || contractor.slug !== slug) return { eligible: false, reason: "not_public" };
    const readiness = parentSaveReadiness(contractor);
    if (!readiness.ready) return { eligible: false, reason: readiness.reason };
    const slugs = await reader.slugsForFloridaCredential(readiness.identity.sourceIdentifier);
    if (slugs.length !== 1 || slugs[0] !== slug) return { eligible: false, reason: "credential_not_unique" };
    return { eligible: true, identity: readiness.identity };
  } catch {
    return { eligible: false, reason: "source_unavailable" };
  }
}

/** The parent asks about one exact credential. Returns the identity with the
 * canonical slug, or null. No name, slug or UUID is ever accepted as input. */
export async function resolveByIdentity(reader: ProfileReader, input: unknown): Promise<ContractorSaveIdentity | null> {
  if (!isFloridaIdentityInput(input)) return null;
  try {
    const slugs = await reader.slugsForFloridaCredential(input.sourceIdentifier);
    if (slugs.length !== 1) return null;
    const resolved = await resolveBySlug(reader, slugs[0]);
    return resolved.eligible && resolved.identity.sourceIdentifier === input.sourceIdentifier ? resolved.identity : null;
  } catch {
    return null;
  }
}
