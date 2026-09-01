import { NextResponse } from "next/server";
import {
  contractorCapabilityContract,
  contractorRequestErrorResponse,
  contractorUnsupportedElectricalResponse,
  executeContractorSpecialistQuery,
} from "@/lib/specialist-execution/contractor-v2";

export const dynamic = "force-dynamic";

function responseStatus(result: { resultState?: string }): number {
  if (result.resultState === "INVALID_QUERY") return 400;
  if (["CLARIFICATION_REQUIRED", "INVALID_GEOGRAPHY", "UNSUPPORTED_STATE_CAPABILITY", "UNSUPPORTED_TRADE_CAPABILITY", "PUBLICATION_RESTRICTED"].includes(result.resultState ?? "")) return 422;
  return 200;
}

function getRequest(searchParams: URLSearchParams): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const field of ["contract", "queryType", "state", "trade", "credentialClass", "county", "city", "zip", "geographyIntent", "credentialStatus", "identifier"] as const) {
    const value = searchParams.get(field);
    if (value !== null) body[field] = value;
  }
  for (const field of ["page", "limit"] as const) {
    const value = searchParams.get(field);
    if (value !== null) body[field] = Number(value);
  }
  if (searchParams.has("confirmStatewide")) body.confirmStatewide = searchParams.get("confirmStatewide") === "true";
  return body;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  if ([...params.keys()].length === 0) {
    return NextResponse.json(contractorCapabilityContract(), { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } });
  }
  const body = getRequest(params);
  try {
    const response = await executeContractorSpecialistQuery(body);
    return NextResponse.json(response, { status: responseStatus(response), headers: { "Cache-Control": "public, max-age=30, s-maxage=60" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "execution_failed";
    if (code === "unsupported_florida_electrical_source") return NextResponse.json(contractorUnsupportedElectricalResponse(body), { status: 422 });
    const clientError = /^(invalid_|unsupported_|clarification_)/.test(code);
    if (!clientError) console.error("[specialist-execution-v2] execution failed", code);
    const response = clientError ? contractorRequestErrorResponse(error, body) : { contract: "trusthub-specialist-execution-v2", hub: "contractor", resultState: "BACKEND_UNAVAILABLE", errorCode: "execution_unavailable" };
    return NextResponse.json(response, { status: clientError ? responseStatus(response) || 400 : 503 });
  }
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
    return NextResponse.json(response, { status: responseStatus(response), headers: { "Cache-Control": "public, max-age=30, s-maxage=60" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "execution_failed";
    if (code === "unsupported_florida_electrical_source") return NextResponse.json(contractorUnsupportedElectricalResponse(body), { status: 422 });
    const clientError = /^(invalid_|unsupported_|clarification_)/.test(code);
    if (!clientError) console.error("[specialist-execution-v2] execution failed", code);
    const response = clientError ? contractorRequestErrorResponse(error, body) : { contract: "trusthub-specialist-execution-v2", hub: "contractor", resultState: "BACKEND_UNAVAILABLE", errorCode: "execution_unavailable" };
    return NextResponse.json(response, { status: clientError ? responseStatus(response) || 400 : 503 });
  }
}
