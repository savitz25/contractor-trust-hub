import "server-only";
import type { PublicBusinessProfile } from "./public-contract";
import { fetchPublicBusinessProfile } from "./fetch-public";

export async function getPublicBusinessProfile(profileId: string, fetcher: typeof fetch = fetch): Promise<PublicBusinessProfile | null> {
  return fetchPublicBusinessProfile(profileId, process.env.ATH_PUBLIC_PROFILE_ORIGIN || "https://www.asktrusthub.com", fetcher);
}
