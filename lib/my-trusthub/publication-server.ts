import "server-only";
import { query } from "@/lib/db";
import { getContractorBySlug } from "@/lib/contractors/queries";
import { FL_DBPR, FL_DBPR_KEY } from "./profile-identity";
import type { ProfileReader } from "./publication";

/** Production reader: the Trust Report's own profile read, plus one exact
 * lookup of which public profiles carry a Florida DBPR license key. Read-only,
 * exact equality, at most three rows. */
export const contractorProfileReader: ProfileReader = {
  bySlug: (slug) => getContractorBySlug(slug),
  async slugsForFloridaCredential(externalKey) {
    if (!FL_DBPR_KEY.test(externalKey)) return [];
    const rows = await query<{ slug: string }>(
      `SELECT DISTINCT c.slug
       FROM licenses l JOIN contractors c ON c.id = l.contractor_id
       WHERE l.source_system = $1 AND l.external_key = $2 AND c.slug IS NOT NULL
       LIMIT 3`,
      [FL_DBPR.sourceSystem, externalKey]
    );
    return rows.map((row) => row.slug);
  },
};
