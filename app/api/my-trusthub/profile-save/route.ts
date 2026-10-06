import { query } from "@/lib/db";
import { postgresAckStore } from "@/lib/my-trusthub/ack-store";
import { parentSyncMode, productionHandoffDeps, productionParentGate } from "@/lib/my-trusthub/parent-adapter";
import { handleContractorProfileSave } from "@/lib/my-trusthub/profile-save-http";
import { contractorProfileReader } from "@/lib/my-trusthub/publication-server";
import { getSiteUrl } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Contractor Save hand-off endpoint.
 *
 * This activation opens the server gate for ccc057187-a-r-roofing-inc only.
 * CONTRACTOR_PARENT_SYNC_BROAD stays false. Do not merge until
 * docs/my-trusthub/ONE-PROFILE-CANARY.md is satisfied. This route does not
 * read NEXT_PUBLIC_MY_TRUSTHUB_CONTRACTOR_SYNC. An unset browser flag does
 * not close this gate. The signer and the transport to My TrustHub are
 * constructed only when the gate mode is gated. A closed gate (both constants
 * false) answers 503 and reads, builds, signs and sends nothing. */
export function POST(request: Request) {
  const gate = productionParentGate(), mode = parentSyncMode(process.env, gate);
  const signer = mode === "gated" ? productionHandoffDeps() : { key: null, parent: null };
  return handleContractorProfileSave(request, {
    mode, gate, reader: contractorProfileReader, key: signer.key, parent: signer.parent,
    acks: mode === "gated" ? postgresAckStore((text, params) => query(text, params)) : null, now: Date.now,
  }, process.env.VERCEL_ENV === "production" ? getSiteUrl() : new URL(request.url).origin);
}
