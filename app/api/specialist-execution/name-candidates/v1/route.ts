import { NextResponse } from "next/server";
import {
  executeContractorNameCandidates,
  nameCandidatesCapability,
  nameCandidatesRequestError,
  type NameCandidatesResponse,
} from "@/lib/specialist-execution/contractor-name-candidates";

export const dynamic = "force-dynamic";

function httpStatus(result: NameCandidatesResponse): number {
  if (result.resultState === "INVALID_QUERY") return 400;
  if (result.resultState === "UNSUPPORTED_SCOPE") return 422;
  if (result.resultState === "SOURCE_FAILURE") return result.failureKind === "timeout" ? 504 : 503;
  return 200;
}

async function respond(body: unknown) {
  try {
    const result = await executeContractorNameCandidates(body);
    const ok = httpStatus(result) === 200;
    return NextResponse.json(result, { status: httpStatus(result), headers: { "Cache-Control": ok ? "public, max-age=30, s-maxage=60" : "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (/^(invalid_|unsupported_)/.test(code)) return NextResponse.json(nameCandidatesRequestError(error), { status: 400, headers: { "Cache-Control": "no-store" } });
    console.error("[name-candidates-v1] execution failed", code);
    return NextResponse.json({ ...nameCandidatesRequestError(new Error("execution_unavailable")), resultState: "SOURCE_FAILURE", failureKind: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  if ([...params.keys()].length === 0) {
    return NextResponse.json(nameCandidatesCapability(), { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } });
  }
  const body: Record<string, unknown> = {};
  for (const [key, value] of params.entries()) body[key] = key === "page" || key === "limit" ? Number(value) : value;
  return respond(body);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(nameCandidatesRequestError(new Error("invalid_json")), { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  return respond(body);
}
