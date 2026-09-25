import "server-only";
import { query } from "@/lib/db";
import { mintAthHandoffToken } from "./handoff-contract";
import type { ClaimProfile } from "./eligibility";
import { selectClaimableCredential } from "./rollout";

export { claimCtaEnabledFor, claimEnabledStates, claimModeEnabledFor, claimStateEnabled, selectClaimableCredential } from "./rollout";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function loadEligibleClaimProfile(profileId: string): Promise<ClaimProfile | null> {
  if (!UUID.test(profileId)) return null;
  // ATH-CLAIM-V2-FLNJ-001: one read returns every claimable-source credential row for the profile in a fixed
  // order (FL source first, active first, most recently seen, then key — identical to Ask cth-read); the FL
  // selection rule is exactly the pre-FLNJ one (best fl_dbpr row, then the FL state rule on that row), and NJ
  // is evaluated only when FL does not apply. The browser never influences source, state or credential.
  const rows = await query<{
    id: string;
    slug: string;
    display_name: string;
    home_state: string | null;
    external_key: string;
    source_system: string;
    license_state: string | null;
  }>(
    `
    SELECT c.id::text AS id, c.slug, c.display_name, c.home_state, l.external_key, l.source_system, l.state AS license_state
    FROM contractors c
    JOIN LATERAL (
      SELECT external_key, source_system, state, status_normalized, last_seen_at
      FROM licenses
      WHERE contractor_id = c.id
        AND source_system IN ('fl_dbpr', 'nj_dca')
        AND NULLIF(TRIM(external_key), '') IS NOT NULL
    ) l ON TRUE
    WHERE c.id = $1::uuid
      AND c.is_thin_profile = FALSE
      AND NULLIF(TRIM(c.slug), '') IS NOT NULL
    ORDER BY CASE WHEN l.source_system = 'fl_dbpr' THEN 0 ELSE 1 END,
             CASE WHEN l.status_normalized = 'active' THEN 0 ELSE 1 END,
             l.last_seen_at DESC NULLS LAST,
             l.external_key ASC
    LIMIT 50
    `,
    [profileId]
  );
  return selectClaimableCredential(rows);
}

/**
 * ATH-CLAIM-V2-001R2 (Q2) — `acquisitionSource` is a trusted-server-only parameter, never derived from a
 * request. The public route never passes it, so every browser-initiated mint is `organic`. Only server-side
 * code that calls this function directly (a QA fixture, an internal tool) may set another allow-listed value.
 */
export function mintClaimHandoff(profile: ClaimProfile, now?: Date, acquisitionSource?: import("./handoff-contract").AthHandoffAcquisitionSource) {
  return mintAthHandoffToken(process.env.ATH_HANDOFF_SECRET || "", profile, { now, acquisitionSource });
}

export function logClaimHandoff(
  event: "claim_handoff_minted" | "claim_handoff_failed",
  fields: { native_profile_id?: string; state?: "FL"; source_system?: "fl_dbpr"; reason?: string }
): void {
  console.info(JSON.stringify({ src: "cth-claim", event, hub: "contractor", ...fields }));
}
