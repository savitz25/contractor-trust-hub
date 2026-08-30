import { parsePublicBusinessProfile, type PublicBusinessProfile } from "./public-contract";

export async function fetchPublicBusinessProfile(profileId: string, origin: string, fetcher: typeof fetch = fetch): Promise<PublicBusinessProfile | null> {
  try {
    const response = await fetcher(`${origin.replace(/\/+$/, "")}/api/public/contractor-profiles/${encodeURIComponent(profileId)}`, {
      cache: "no-store", signal: AbortSignal.timeout(1500), headers: { accept: "application/json" },
    });
    if (!response.ok) return null;
    return parsePublicBusinessProfile(await response.json(), profileId);
  } catch { return null; }
}
