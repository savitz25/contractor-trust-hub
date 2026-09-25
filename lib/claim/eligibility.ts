import type { ContractorDetail } from "@/lib/contractors/types";

/**
 * ATH-CLAIM-V2-FLNJ-001 — claimable credential sources, keyed by the claim jurisdiction they establish.
 *
 * A profile is claimable only through an exact, published, credential-bearing source. Enforcement rows,
 * entity records, permits and name-only evidence never qualify. Inventory of Contractor production data
 * (2026-09-24) found exactly one NJ credential source in `licenses`: `nj_dca` (HIC registrations plus the
 * ELE/PLB/HVAC/ALM/TEL/LCK/HRT boards). Out-of-state credentials held by NJ businesses do not make an NJ
 * profile claimable, and no generic "any licence in NJ" shortcut exists. Every other state: no claim doorway.
 */
export const CLAIMABLE_CREDENTIAL_SOURCES = {
  FL: ["fl_dbpr"],
  NJ: ["nj_dca"],
} as const satisfies Record<string, readonly string[]>;

export type ClaimState = keyof typeof CLAIMABLE_CREDENTIAL_SOURCES;
/** Evaluation order. FL first so existing FL behaviour is unchanged for profiles that also hold NJ rows. */
export const CLAIM_STATES = ["FL", "NJ"] as const satisfies readonly ClaimState[];

export type ClaimProfile = {
  id: string;
  slug: string;
  externalKey: string;
  displayName: string;
  /** Claim jurisdiction established by the selected credential (FL or NJ) — never a browser-supplied value. */
  homeState: ClaimState;
  /** The selected credential's real source system (`fl_dbpr` | `nj_dca`). */
  sourceSystem: string;
};

export function claimStateForSource(sourceSystem: string | null | undefined): ClaimState | null {
  for (const state of CLAIM_STATES) {
    if ((CLAIMABLE_CREDENTIAL_SOURCES[state] as readonly string[]).includes(String(sourceSystem ?? ""))) return state;
  }
  return null;
}

export function isClaimableCredentialPair(sourceSystem: string | null | undefined, homeState: string | null | undefined): homeState is ClaimState {
  return claimStateForSource(sourceSystem) !== null && claimStateForSource(sourceSystem) === homeState;
}

export function eligibleClaimProfile(contractor: ContractorDetail): ClaimProfile | null {
  if (!contractor.id || !contractor.slug || contractor.isThinProfile) return null;
  for (const state of CLAIM_STATES) {
    const sources = CLAIMABLE_CREDENTIAL_SOURCES[state] as readonly string[];
    const license = contractor.licenses.find(
      (item) =>
        sources.includes(item.sourceSystem) &&
        Boolean(item.externalKey.trim()) &&
        (contractor.homeState === state || item.state === state)
    );
    if (license) {
      return { id: contractor.id, slug: contractor.slug, externalKey: license.externalKey, displayName: contractor.displayName, homeState: state, sourceSystem: license.sourceSystem };
    }
  }
  return null;
}
