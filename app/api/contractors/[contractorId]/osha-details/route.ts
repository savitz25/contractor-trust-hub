import { loadPublicOshaInspectionDetails } from "@/lib/osha/load-inspection-details";
import { OshaDetailUnavailableError } from "@/lib/osha/inspection-detail-adapter";
import { isOshaDetailEnabled } from "@/lib/osha/flag";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = { params: Promise<{ contractorId: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" } });
}

export async function GET(request: Request, { params }: Props) {
  if (!isOshaDetailEnabled()) return json({ error: "not_found" }, 404);
  const { contractorId } = await params;
  if (!UUID.test(contractorId)) return json({ error: "not_found" }, 404);
  const url = new URL(request.url);
  const publicMatchId = url.searchParams.get("match") ?? "";
  if (!UUID.test(publicMatchId)) return json({ error: "not_found" }, 404);
  const state = url.searchParams.get("state") ?? "";
  const licenseKey = url.searchParams.get("license") ?? "";
  try {
    return json(await loadPublicOshaInspectionDetails({
      contractorId,
      publicMatchId,
      state,
      licenseKey,
      cursor: url.searchParams.get("cursor"),
    }));
  } catch (error) {
    if (error instanceof OshaDetailUnavailableError && error.reason === "invalid_cursor") {
      return json({ error: "invalid_cursor" }, 400);
    }
    if (error instanceof OshaDetailUnavailableError && error.reason === "reconciliation_failed") {
      return json({ error: "details_unavailable" }, 409);
    }
    if (error instanceof OshaDetailUnavailableError && error.reason === "weak_or_unmatched") {
      return json({ error: "not_found" }, 404);
    }
    console.error("[osha] inspection detail request failed", error instanceof Error ? error.message.slice(0, 160) : "read error");
    return json({ error: "temporarily_unavailable" }, 503);
  }
}
