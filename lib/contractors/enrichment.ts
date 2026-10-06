import "server-only";
import { query } from "@/lib/db";
import { shapeEnrichment, type BusinessWebsiteEnrichment, type EnrichmentRow } from "./enrichment-shape";

/**
 * MD-ENRICH-001 — public business-website enrichment for one contractor profile.
 * Suppressed observations are filtered in SQL and again in shapeEnrichment.
 * A missing table (migration 017 not yet applied) or any read error yields null so the
 * Trust Report renders exactly as before; enrichment is never load-bearing.
 */
export async function loadBusinessWebsiteEnrichment(contractorId: string): Promise<BusinessWebsiteEnrichment | null> {
  try {
    const rows = await query<EnrichmentRow>(
      `SELECT field, value, ordinal, is_suppressed, source_refs, observed_at
       FROM contractor_enrichment_observations
       WHERE contractor_id = $1::uuid AND NOT is_suppressed
       ORDER BY field, ordinal, value
       LIMIT 200`,
      [contractorId]
    );
    return shapeEnrichment(rows);
  } catch (e) {
    const code = (e as { code?: string } | null)?.code;
    if (code !== "42P01") {
      console.error("[enrichment] read failed", e instanceof Error ? e.message.slice(0, 160) : String(e));
    }
    return null;
  }
}
