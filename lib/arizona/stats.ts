import { queryOne } from "@/lib/db";

export async function getArizonaDiscoveryStats(): Promise<{
  contractors: number;
  licenses: number;
  disciplineLinked: number;
}> {
  try {
    const row = await queryOne<{
      contractors: string;
      licenses: string;
      discipline: string;
    }>(
      `
      SELECT
        (SELECT COUNT(DISTINCT c.id)::text
         FROM contractors c
         JOIN licenses l ON l.contractor_id = c.id
         WHERE l.source_system = 'az_roc'
           AND c.is_thin_profile = FALSE
           AND l.status_normalized IN ('active', 'current')
        ) AS contractors,
        (SELECT COUNT(*)::text FROM licenses
         WHERE source_system = 'az_roc' AND status_normalized IN ('active', 'current')
        ) AS licenses,
        (SELECT COUNT(DISTINCT d.contractor_id)::text
         FROM discipline_actions d
         JOIN licenses l ON l.contractor_id = d.contractor_id
         WHERE l.source_system = 'az_roc'
        ) AS discipline
      `
    );
    return {
      contractors: Number(row?.contractors || 0),
      licenses: Number(row?.licenses || 0),
      disciplineLinked: Number(row?.discipline || 0),
    };
  } catch {
    return { contractors: 0, licenses: 0, disciplineLinked: 0 };
  }
}
