/**
 * Stage 6.1 lightweight ops visibility — coverage/join health snapshot.
 */

import { allCoverageMatrix, coverageAnalyticsSnapshot } from "./coverage";
import { extractStats } from "./permits";
import { WAVE_A_COUNTIES, WAVE_A_SLUGS } from "./wave-a";

export function waveAOpsSnapshot() {
  const stats = extractStats();
  const matrix = allCoverageMatrix().filter((m) =>
    (WAVE_A_SLUGS as readonly string[]).includes(m.countySlug)
  );
  const fullSnap = coverageAnalyticsSnapshot();

  // Jurisdiction row counts from extract by matching county name in sourceJurisdiction
  const recordsByWaveACounty: Record<string, number> = {};
  for (const county of WAVE_A_COUNTIES) {
    recordsByWaveACounty[county] = 0;
  }
  for (const [j, n] of Object.entries(stats.byJurisdiction)) {
    for (const county of WAVE_A_COUNTIES) {
      if (j.toLowerCase().includes(county.toLowerCase().split("-")[0]) ||
          j.toLowerCase().includes(county.toLowerCase())) {
        recordsByWaveACounty[county] += n;
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    stage: "6.1",
    waveA: {
      counties: [...WAVE_A_COUNTIES],
      matrix,
      recordsByCounty: recordsByWaveACounty,
    },
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
    matching: {
      rule: "exact_license_only",
      nameOnlyJoins: false,
      falseJoinPolicy: "refuse_when_uncertain",
    },
    fullMatrixSummary: {
      jurisdictionsEnabled: fullSnap.jurisdictionsEnabled,
      byWave: fullSnap.byWave,
    },
    knownLimits: [
      "Wave A is partial — many real addresses return zero rows",
      "Sample/JSON extracts are not a full AHJ dump",
      "Trust Report activity only for licenses present in activity rollups or DB",
      "DB join requires migration 006 + batch load; otherwise file extracts only",
      "Never claim complete county coverage",
    ],
  };
}
