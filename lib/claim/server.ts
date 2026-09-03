import "server-only";
import { queryOne } from "@/lib/db";
import { mintAthHandoffToken } from "./handoff-contract";
import type { ClaimProfile } from "./eligibility";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function claimCtaEnabledFor(profileId: string): boolean {
  const secret = process.env.ATH_HANDOFF_SECRET || "";
  if (secret.length < 32) return false;
  const mode = process.env.ATH_CLAIM_CTA_MODE || "off";
  if (mode === "all") return true;
  if (mode !== "canary") return false;
  return new Set(
    (process.env.ATH_CLAIM_CANARY_PROFILE_IDS || "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  ).has(profileId.toLowerCase());
}

export async function loadEligibleClaimProfile(profileId: string): Promise<ClaimProfile | null> {
  if (!UUID.test(profileId)) return null;
  const row = await queryOne<{
    id: string;
    slug: string;
    external_key: string;
    display_name: string;
  }>(
    `
    SELECT c.id::text AS id, c.slug, c.display_name, l.external_key
    FROM contractors c
    JOIN LATERAL (
      SELECT external_key, state
      FROM licenses
      WHERE contractor_id = c.id
        AND source_system = 'fl_dbpr'
        AND NULLIF(TRIM(external_key), '') IS NOT NULL
      ORDER BY CASE WHEN status_normalized = 'active' THEN 0 ELSE 1 END,
               last_seen_at DESC NULLS LAST
      LIMIT 1
    ) l ON TRUE
    WHERE c.id = $1::uuid
      AND c.is_thin_profile = FALSE
      AND NULLIF(TRIM(c.slug), '') IS NOT NULL
      AND (c.home_state = 'FL' OR l.state = 'FL')
    LIMIT 1
    `,
    [profileId]
  );
  return row ? { id: row.id, slug: row.slug, externalKey: row.external_key, displayName: row.display_name } : null;
}

export function mintClaimHandoff(profile: ClaimProfile, now?: Date) {
  return mintAthHandoffToken(process.env.ATH_HANDOFF_SECRET || "", profile, { now });
}

export function logClaimHandoff(
  event: "claim_handoff_minted" | "claim_handoff_failed",
  fields: { native_profile_id?: string; state?: "FL"; source_system?: "fl_dbpr"; reason?: string }
): void {
  console.info(JSON.stringify({ src: "cth-claim", event, hub: "contractor", ...fields }));
}
