/**
 * Stage 6.1 / 7 / 8C ops visibility — file extract + optional DB production truth.
 */

import { allCoverageMatrix, coverageAnalyticsSnapshot } from "./coverage";
import { extractStats } from "./permits";
import type { DbOpsSnapshot } from "./ops-db";
import { WAVE_A_COUNTIES, WAVE_A_SLUGS } from "./wave-a";
import {
  WAVE_B_COUNTIES,
  WAVE_B_SLUGS,
  WAVE_C_COUNTIES,
  WAVE_C_SLUGS,
} from "./wave-bc";

function countByCounties(
  byJurisdiction: Record<string, number>,
  counties: readonly string[]
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const county of counties) out[county] = 0;
  for (const [j, n] of Object.entries(byJurisdiction)) {
    const jl = j.toLowerCase();
    for (const county of counties) {
      const cl = county.toLowerCase();
      if (jl.includes(cl) || jl.includes(cl.split("-")[0] || cl)) {
        out[county] += n;
      }
    }
  }
  return out;
}

function waveSlice(slugs: readonly string[]) {
  return allCoverageMatrix().filter((m) =>
    (slugs as readonly string[]).includes(m.countySlug)
  );
}

export function waveAOpsSnapshot() {
  return waveOpsSnapshot("A", WAVE_A_COUNTIES, WAVE_A_SLUGS);
}

export function waveBOpsSnapshot() {
  return waveOpsSnapshot("B", WAVE_B_COUNTIES, WAVE_B_SLUGS);
}

export function waveCOpsSnapshot() {
  return waveOpsSnapshot("C", WAVE_C_COUNTIES, WAVE_C_SLUGS);
}

export function waveOpsSnapshot(
  wave: "A" | "B" | "C",
  counties: readonly string[],
  slugs: readonly string[]
) {
  const stats = extractStats();
  const matrix = waveSlice(slugs);
  const fullSnap = coverageAnalyticsSnapshot();
  const recordsByCounty = countByCounties(stats.byJurisdiction, counties);

  return {
    generatedAt: new Date().toISOString(),
    stage: "8C",
    wave,
    counties: [...counties],
    matrix,
    recordsByCounty,
    extract: {
      permitRows: stats.permitRows,
      addressKeys: stats.addressKeys,
      withLicenseKey: stats.withLicenseKey,
      withoutLicenseKey: stats.withoutLicenseKey,
      unmatchedLicenseBearing: stats.unmatchedLicenseBearingRows,
      activityLicenseKeys: stats.activityLicenseKeys,
      activityKeysAlsoOnPermits: stats.activityKeysAlsoOnPermits,
      joinRateProxyPercent: stats.joinRateProxy,
      freshness: stats.freshness,
      byJurisdiction: stats.byJurisdiction,
    },
    dataSourceNote:
      "File extract stats (sample-permits.json). Prefer production.db when available.",
    matching: {
      rule: "exact_license_only",
      nameOnlyJoins: false,
      falseJoinPolicy: "refuse_when_uncertain",
      crossStateJoins: false,
    },
    fullMatrixSummary: {
      jurisdictionsEnabled: fullSnap.jurisdictionsEnabled,
      byWave: fullSnap.byWave,
    },
    knownLimits: [
      `Wave ${wave} is partial — many real addresses return zero rows`,
      "Never display sample density as complete live AHJ coverage",
      "Trust Report activity only for licenses present in activity rollups or DB",
      "DB join requires migration 006 + load:permits; otherwise file extracts only",
      "Never claim complete county coverage",
      "Auto-join is exact license key only — no name-only joins",
    ],
  };
}

/** Combined Wave A–C ops for coverage API / admin snapshot */
export function floridaWavesOpsSnapshot(db?: DbOpsSnapshot | null) {
  return {
    generatedAt: new Date().toISOString(),
    stage: "8C",
    waveA: waveAOpsSnapshot(),
    waveB: waveBOpsSnapshot(),
    waveC: waveCOpsSnapshot(),
    extract: extractStats(),
    production: db || null,
    njVerify: {
      pilot: true,
      note: "NJ is Verify pilot only — not FL permit-wave coverage",
      path: "/verify?state=nj",
      dcaLicenses: db?.njDcaLicenses ?? null,
    },
  };
}

