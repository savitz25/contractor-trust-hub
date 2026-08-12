import { NextResponse } from "next/server";
import { coverageAnalyticsSnapshot } from "@/lib/property/coverage";
import { waveAOpsSnapshot } from "@/lib/property/ops-health";
import { extractStats } from "@/lib/property/permits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    analytics: coverageAnalyticsSnapshot(),
    extractStats: extractStats(),
    waveAOps: waveAOpsSnapshot(),
  });
}
