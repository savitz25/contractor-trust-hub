import { manifestSigningKey } from "@/lib/my-trusthub/manifest";
import { DISABLED_PARENT_PORT, parentSyncMode } from "@/lib/my-trusthub/parent-adapter";
import { handleContractorProfileSave } from "@/lib/my-trusthub/profile-save-http";
import { contractorProfileReader } from "@/lib/my-trusthub/publication-server";
import { getSiteUrl } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Contractor Save hand-off endpoint. Production sync is OFF: parentSyncMode()
 * is "off" for every production deployment, so this answers 503 and reads,
 * builds, signs and contacts nothing. The parent port has no transport. */
export function POST(request: Request) {
  return handleContractorProfileSave(request, {
    mode: parentSyncMode(), reader: contractorProfileReader, key: manifestSigningKey(), port: DISABLED_PARENT_PORT, now: Date.now,
  }, process.env.VERCEL_ENV === "production" ? getSiteUrl() : new URL(request.url).origin);
}
