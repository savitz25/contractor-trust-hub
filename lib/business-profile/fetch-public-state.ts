import { parsePublicBusinessProfile, type PublicBusinessProfile } from "./public-contract";
import { parsePublicBusinessReplies, type PublicBusinessReplies } from "../business-replies/public-contract";

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
        next: { revalidate: 21600 },
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
