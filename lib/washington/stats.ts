import { queryOne } from "@/lib/db";

export async function getWashingtonDiscoveryStats(): Promise<{
  contractors: number;
  licenses: number;
  waMailing: number;
}> {
  try {
    const row = await queryOne<{
      contractors: string;
      licenses: string;
      wa_mailing: string;
    }>(
      `
      SELECT
        (SELECT COUNT(DISTINCT c.id)::text
         FROM contractors c
         JOIN licenses l ON l.contractor_id = c.id
         WHERE l.source_system = 'wa_lni'
           AND c.is_thin_profile = FALSE
           AND l.status_normalized IN ('active', 'current')
        ) AS contractors,
        (SELECT COUNT(*)::text FROM licenses
         WHERE source_system = 'wa_lni' AND status_normalized IN ('active', 'current')
        ) AS licenses,
        (SELECT COUNT(*)::text FROM licenses
         WHERE source_system = 'wa_lni'
           AND status_normalized IN ('active', 'current')
           AND UPPER(TRIM(state)) = 'WA'
        ) AS wa_mailing
      `
    );
    return {
      contractors: Number(row?.contractors || 0),
      licenses: Number(row?.licenses || 0),
      waMailing: Number(row?.wa_mailing || 0),
    };
  } catch {
    return { contractors: 0, licenses: 0, waMailing: 0 };
  }
}
