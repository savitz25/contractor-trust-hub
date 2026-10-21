import "server-only";
import { query } from "@/lib/db";
import { isOshaProfileEnabled } from "./flag";
import { loadPublicOshaMatches, type OshaPublicRecord } from "./public-record";

/**
 * Profile read path. Flag off, a missing table, or any read error returns null.
 * Null means the profile renders no OSHA section.
 */
export async function loadPublicOshaSafetyRecord(input: {
  contractorId: string;
  homeState: string | null;
  licenseKeys: string[];
}): Promise<OshaPublicRecord[] | null> {
  if (!isOshaProfileEnabled()) return null;
  try {
    const result = await loadPublicOshaMatches(input, {
      enabled: true,
      query: (text, params) => query(text, params),
    });
    return result.records;
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code !== "42P01") {
      console.error(
        "[osha] public read failed",
        error instanceof Error ? error.message.slice(0, 160) : "read error",
      );
    }
    return null;
  }
}
