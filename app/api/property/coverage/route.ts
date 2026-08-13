import { NextResponse } from "next/server";
import { coverageAnalyticsSnapshot } from "@/lib/property/coverage";
import {
  floridaWavesOpsSnapshot,
  waveAOpsSnapshot,
  waveBOpsSnapshot,
  waveCOpsSnapshot,
} from "@/lib/property/ops-health";
import { loadDbOpsSnapshot } from "@/lib/property/ops-db";
import { extractStats } from "@/lib/property/permits";
import { isNjVerifyPilotEnabled } from "@/lib/states/feature-flags";
import { getStateBySlug } from "@/lib/states/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const nj = getStateBySlug("nj");
  const production = await loadDbOpsSnapshot();
  const analytics = coverageAnalyticsSnapshot();

  const bySlug = new Map(
    production.jurisdictions.map((j) => [j.jurisdictionSlug, j])
  );

  // Static matrix from coverage.ts includes county + we need slug — re-read from allCoverage
  const { allCoverageMatrix } = await import("@/lib/property/coverage");
  const fullMatrix = allCoverageMatrix();
  const slugByCounty = new Map(
    fullMatrix.map((m) => [m.county, m.countySlug])
  );

  const matrixWithDb = analytics.matrix.map((row) => {
    const slug = slugByCounty.get(row.county) || row.county.toLowerCase().replace(/\s+/g, "-");
    const match = bySlug.get(slug);
    if (!match || !production.available || production.wavePermits === 0) {
      return {
        ...row,
        countySlug: slug,
        productionRecordCount: null as number | null,
        productionFreshness: null as string | null,
        dataMode: production.available ? "file_matrix" : "file_only",
      };
    }
    return {
      ...row,
      countySlug: slug,
      productionRecordCount: match.recordCount,
      productionFreshness: match.freshness,
      // Prefer production counts for truthfulness when loaded
      sampleRecordCount: match.recordCount,
      freshness: match.freshness || row.freshness,
      dataMode: "database" as const,
    };
  });

  return NextResponse.json({
    stage: "8C",
    analytics: {
      ...analytics,
      matrix: matrixWithDb,
      productionAvailable: production.available,
      productionWavePermits: production.wavePermits,
    },
    extractStats: extractStats(),
    waveAOps: waveAOpsSnapshot(),
    waveBOps: waveBOpsSnapshot(),
    waveCOps: waveCOpsSnapshot(),
    floridaWaves: floridaWavesOpsSnapshot(production),
    production,
    multiState: {
      floridaPermitWaves: true,
      njVerifyPilot: Boolean(nj?.live && isNjVerifyPilotEnabled()),
      njPath: "/verify?state=nj",
      njDcaLicenses: production.njDcaLicenses,
      note: "Florida permit waves are separate from NJ Verify pilot coverage.",
    },
    honesty: {
      sampleVsProduction:
        production.available && production.wavePermits > 0
          ? "Coverage counts prefer production DB when loaded"
          : "Showing file/sample extract stats until production load succeeds",
      neverClaimCompleteAhj: true,
    },
  });
}
