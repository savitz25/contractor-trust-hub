import { query } from "@/lib/db";
import { postgresAckStore } from "@/lib/my-trusthub/ack-store";
import { parentSyncMode, productionHandoffDeps, productionParentGate } from "@/lib/my-trusthub/parent-adapter";
import { handleContractorProfileSave } from "@/lib/my-trusthub/profile-save-http";
import { contractorProfileReader } from "@/lib/my-trusthub/publication-server";
import { getSiteUrl } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Contractor Save hand-off endpoint. The production gate is closed
 * (CONTRACTOR_PARENT_SYNC_BROAD and CONTRACTOR_CANARY_ACTIVE are false), so
 * this answers 503 and reads, builds, signs and sends nothing. The signer and
 * the transport to My TrustHub are only constructed when the gate is open. */
export function POST(request: Request) {
  const gate = productionParentGate(), mode = parentSyncMode(process.env, gate);
  const signer = mode === "gated" ? productionHandoffDeps() : { key: null, parent: null };
  return handleContractorProfileSave(request, {
    mode, gate, reader: contractorProfileReader, key: signer.key, parent: signer.parent,
    acks: mode === "gated" ? postgresAckStore((text, params) => query(text, params)) : null, now: Date.now,
  }, process.env.VERCEL_ENV === "production" ? getSiteUrl() : new URL(request.url).origin);
}
