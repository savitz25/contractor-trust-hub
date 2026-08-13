/**
 * Stage 8C — production DB stats for coverage truthfulness.
 * Soft-fails to null when DATABASE_URL missing or tables empty.
 */

import { query } from "@/lib/db";

export type DbPermitJurisdictionStat = {
  jurisdictionSlug: string;
  recordCount: number;
  withLicenseKey: number;
  freshness: string | null;
  wave: string | null;
  notes: string | null;
};

export type DbOpsSnapshot = {
  available: boolean;
  generatedAt: string;
  wavePermits: number;
  activityKeys: number;
  permitFreshness: string | null;
  activityFreshness: string | null;
  jurisdictions: DbPermitJurisdictionStat[];
  flDbprLicenses: number;
  njDcaLicenses: number;
  njSosEntities: number;
  njEnforcement: number;
  lastLoadRuns: Array<{
    sourceSystem: string;
    sourceDataset: string;
    status: string;
    rowCount: number;
    deltaRows: number | null;
    startedAt: string | null;
  }>;
  dataMode: "database" | "unavailable";
  knownLimits: string[];
};

function empty(available: boolean): DbOpsSnapshot {
  return {
    available,
    generatedAt: new Date().toISOString(),
    wavePermits: 0,
    activityKeys: 0,
    permitFreshness: null,
    activityFreshness: null,
    jurisdictions: [],
    flDbprLicenses: 0,
    njDcaLicenses: 0,
    njSosEntities: 0,
    njEnforcement: 0,
    lastLoadRuns: [],
    dataMode: available ? "database" : "unavailable",
    knownLimits: [
      "Partial jurisdiction coverage only",
      "Exact license joins only",
      "Never claim complete AHJ dumps",
    ],
  };
}

/** Read production permit/NJ counts when DB is reachable. */
export async function loadDbOpsSnapshot(): Promise<DbOpsSnapshot> {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    return empty(false);
  }

  try {
    const wave = await query<{ n: number; freshness: string | null }>(
      `SELECT COUNT(*)::int AS n, MAX(retrieved_at)::text AS freshness
       FROM permit_records WHERE source_label ILIKE 'CTH Wave%'`
    );
    const act = await query<{ n: number; freshness: string | null }>(
      `SELECT COUNT(*)::int AS n, MAX(retrieved_at)::text AS freshness
       FROM contractor_permit_activity`
    );
    const juris = await query<{
      jurisdiction_slug: string;
      record_count: string | number;
      with_license_key: string | number;
      freshness: string | null;
      wave: string | null;
      notes: string | null;
    }>(
      `SELECT jurisdiction_slug, record_count, with_license_key,
              freshness::text, wave, notes
       FROM permit_coverage_stats
       ORDER BY wave NULLS LAST, jurisdiction_slug`
    );

    // If coverage_stats empty, aggregate from permits
    let jurisdictions: DbPermitJurisdictionStat[] = juris.map((r) => ({
      jurisdictionSlug: r.jurisdiction_slug,
      recordCount: Number(r.record_count) || 0,
      withLicenseKey: Number(r.with_license_key) || 0,
      freshness: r.freshness,
      wave: r.wave,
      notes: r.notes,
    }));

    if (!jurisdictions.length) {
      const agg = await query<{
        jurisdiction_slug: string;
        n: number;
        with_lic: number;
        freshness: string | null;
      }>(
        `SELECT jurisdiction_slug, COUNT(*)::int AS n,
                COUNT(*) FILTER (WHERE contractor_license_key IS NOT NULL)::int AS with_lic,
                MAX(retrieved_at)::text AS freshness
         FROM permit_records
         WHERE source_label ILIKE 'CTH Wave%'
         GROUP BY 1 ORDER BY 1`
      );
      jurisdictions = agg.map((r) => ({
        jurisdictionSlug: r.jurisdiction_slug,
        recordCount: r.n,
        withLicenseKey: r.with_lic,
        freshness: r.freshness,
        wave: null,
        notes: "Aggregated from permit_records",
      }));
    }

    const fl = await query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM licenses WHERE source_system = 'fl_dbpr'`
    );
    const nj = await query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM licenses WHERE source_system = 'nj_dca'`
    );
    let njEnt = 0;
    let njEnf = 0;
    try {
      const e = await query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM entities WHERE source_system = 'nj_sos'`
      );
      njEnt = e[0]?.n || 0;
      const d = await query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM discipline_actions WHERE source_system = 'nj_enforcement'`
      );
      njEnf = d[0]?.n || 0;
    } catch {
      /* optional */
    }

    let lastLoadRuns: DbOpsSnapshot["lastLoadRuns"] = [];
    try {
      const runs = await query<{
        source_system: string;
        source_dataset: string;
        status: string;
        row_count: number;
        delta_rows: number | null;
        started_at: string | null;
      }>(
        `SELECT source_system, source_dataset, status, row_count::int, delta_rows::int,
                started_at::text
         FROM ops_load_runs
         ORDER BY started_at DESC
         LIMIT 8`
      );
      lastLoadRuns = runs.map((r) => ({
        sourceSystem: r.source_system,
        sourceDataset: r.source_dataset,
        status: r.status,
        rowCount: Number(r.row_count) || 0,
        deltaRows: r.delta_rows != null ? Number(r.delta_rows) : null,
        startedAt: r.started_at,
      }));
    } catch {
      lastLoadRuns = [];
    }

    const wavePermits = wave[0]?.n || 0;

    return {
      available: true,
      generatedAt: new Date().toISOString(),
      wavePermits,
      activityKeys: act[0]?.n || 0,
      permitFreshness: wave[0]?.freshness || null,
      activityFreshness: act[0]?.freshness || null,
      jurisdictions,
      flDbprLicenses: fl[0]?.n || 0,
      njDcaLicenses: nj[0]?.n || 0,
      njSosEntities: njEnt,
      njEnforcement: njEnf,
      lastLoadRuns,
      dataMode: "database",
      knownLimits: [
        wavePermits === 0
          ? "No CTH Wave permits in DB yet — run npm run load:permits"
          : "Wave extracts are partial — empty property results remain common",
        "Exact license joins only for activity and profile links",
        "NJ Verify pilot is separate from FL permit waves",
        "Never claim complete county or statewide permit history",
      ],
    };
  } catch {
    return empty(false);
  }
}
