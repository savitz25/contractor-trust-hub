import { queryOne } from "@/lib/db";

export async function getOregonDiscoveryStats(): Promise<{
  contractors: number;
  licenses: number;
  withBondListed: number;
}> {
  try {
    const row = await queryOne<{
      contractors: string;
      licenses: string;
      bond: string;
    }>(
      `
      SELECT
        (SELECT COUNT(DISTINCT c.id)::text
         FROM contractors c
         JOIN licenses l ON l.contractor_id = c.id
         WHERE l.source_system = 'or_ccb'
           AND c.is_thin_profile = FALSE
           AND l.status_normalized IN ('active', 'current')
        ) AS contractors,
        (SELECT COUNT(*)::text FROM licenses
         WHERE source_system = 'or_ccb' AND status_normalized IN ('active', 'current')
        ) AS licenses,
        (SELECT COUNT(*)::text FROM licenses
         WHERE source_system = 'or_ccb'
           AND secondary_status ILIKE '%Bond%'
        ) AS bond
      `
    );
    return {
      contractors: Number(row?.contractors || 0),
      licenses: Number(row?.licenses || 0),
      withBondListed: Number(row?.bond || 0),
    };
  } catch {
    return { contractors: 0, licenses: 0, withBondListed: 0 };
  }
}
