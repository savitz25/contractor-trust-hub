import { parsePublicBusinessProfile, type PublicBusinessProfile } from "./public-contract";
import { ASK_PUBLIC_REVALIDATE_S, askPublicStateTag } from "./fetch-public-state";

export async function fetchPublicBusinessProfile(profileId: string, origin: string, fetcher: typeof fetch = fetch): Promise<PublicBusinessProfile | null> {
  try {
    const response = await fetcher(`${origin.replace(/\/+$/, "")}/api/public/contractor-profiles/${encodeURIComponent(profileId)}`, {
      next: { revalidate: ASK_PUBLIC_REVALIDATE_S, tags: [askPublicStateTag(profileId)] }, signal: AbortSignal.timeout(1500), headers: { accept: "application/json" },
    });
    if (!response.ok) return null;
    return parsePublicBusinessProfile(await response.json(), profileId);
  } catch { return null; }
}
