import { parsePublicBusinessProfile, type PublicBusinessProfile } from "./public-contract";
import { parsePublicBusinessReplies, type PublicBusinessReplies } from "../business-replies/public-contract";

/**
 * Contractor-side data-cache window for Ask public reads (ATH-CLAIM-V2-001R4). Was 21600s, which made a first
 * approval / first owner save invisible for up to 6 hours. Ask's own edge (s-maxage=60) and existence set protect
 * Neon, so a short window here costs no Neon work. Kept as a cache (not no-store) per ATH-NEON-001.
 */
export const ASK_PUBLIC_REVALIDATE_S = 60;
/**
 * Per-profile data-cache tag on every Ask public read. It makes an owner-layer entry precisely purgeable
 * (revalidateTag(askPublicStateTag(id), { expire: 0 })) by a future trusted server path; there is deliberately no
 * public purge route (that would be an attacker-triggerable surface). Until one exists the bound is the 60s window.
 */
export const askPublicStateTag = (profileId: string) => `ask-public-state:${profileId}`;

export type PublicContractorTrustState = {
  contractorId: string;
  hasPublicBusinessProfile: boolean;
  hasPublicReply: boolean;
  profile: PublicBusinessProfile | null;
  replies: PublicBusinessReplies | null;
};

export async function fetchPublicContractorState(
  profileId: string,
  origin: string,
  fetcher: typeof fetch = fetch,
): Promise<PublicContractorTrustState | null> {
  try {
    const response = await fetcher(
      `${origin.replace(/\/+$/, "")}/api/public/contractor-profiles/${encodeURIComponent(profileId)}/public-state`,
      {
        next: { revalidate: ASK_PUBLIC_REVALIDATE_S, tags: [askPublicStateTag(profileId)] },
        signal: AbortSignal.timeout(1500),
        headers: { accept: "application/json" },
      },
    );
    if (!response.ok) return null;
    const row = (await response.json()) as Record<string, unknown>;
    if (row.hub !== "contractor" || row.contractorId !== profileId) return null;
    const hasProfile = row.hasPublicBusinessProfile === true;
    const hasReply = row.hasPublicReply === true;
    const profile = hasProfile ? parsePublicBusinessProfile(row.profile, profileId) : null;
    const replies = parsePublicBusinessReplies(
      row.replies ?? { contractVersion: 1, hub: "contractor", nativeProfileId: profileId, replies: [] },
      profileId,
    );
    if (hasProfile && !profile) return null;
    return {
      contractorId: profileId,
      hasPublicBusinessProfile: Boolean(profile),
      hasPublicReply: Boolean(replies && replies.replies.length > 0),
      profile,
      replies,
    };
  } catch {
    return null;
  }
}
