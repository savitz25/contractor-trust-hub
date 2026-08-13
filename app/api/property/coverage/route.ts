import { NextResponse } from "next/server";
import { coverageAnalyticsSnapshot } from "@/lib/property/coverage";
import {
  floridaWavesOpsSnapshot,
  waveAOpsSnapshot,
  waveBOpsSnapshot,
  waveCOpsSnapshot,
} from "@/lib/property/ops-health";
import { extractStats } from "@/lib/property/permits";
import { isNjVerifyPilotEnabled } from "@/lib/states/feature-flags";
import { getStateBySlug } from "@/lib/states/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const nj = getStateBySlug("nj");
  return NextResponse.json({
    analytics: coverageAnalyticsSnapshot(),
    extractStats: extractStats(),
    waveAOps: waveAOpsSnapshot(),
    waveBOps: waveBOpsSnapshot(),
    waveCOps: waveCOpsSnapshot(),
    floridaWaves: floridaWavesOpsSnapshot(),
    multiState: {
      floridaPermitWaves: true,
      njVerifyPilot: Boolean(nj?.live && isNjVerifyPilotEnabled()),
      njPath: "/verify?state=nj",
      note: "Florida permit waves are separate from NJ Verify pilot coverage.",
    },
  });
}
