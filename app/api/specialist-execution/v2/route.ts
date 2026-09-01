import { NextResponse } from "next/server";
import {
  contractorCapabilityContract,
  executeContractorSpecialistQuery,
} from "@/lib/specialist-execution/contractor-v2";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(contractorCapabilityContract(), {
    headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  try {
    const response = await executeContractorSpecialistQuery(body);
    return NextResponse.json(response, { headers: { "Cache-Control": "public, max-age=30, s-maxage=60" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "execution_failed";
    const clientError = /^(invalid_|unsupported_|trade_or_identifier|required|city_|geography_)/.test(code);
    if (!clientError) console.error("[specialist-execution-v2] execution failed", code);
    return NextResponse.json({ contract: "trusthub-specialist-execution-v2", hub: "contractor", error: clientError ? code : "execution_unavailable" }, { status: clientError ? 400 : 503 });
  }
}
