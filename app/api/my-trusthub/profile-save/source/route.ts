import { query } from "@/lib/db";
import { postgresAckStore } from "@/lib/my-trusthub/ack-store";
import type { AssertionKey, NonceStore } from "@/lib/my-trusthub/contractor-assertion";
import { contractorProfileReader } from "@/lib/my-trusthub/publication-server";
import { handleContractorSource } from "@/lib/my-trusthub/source-callback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Per-instance replay guard, as on Lender. Assertions live 30 seconds.
const seen = new Map<string, number>();
const nonces: NonceStore = {
  async claim(key, expiresAt) {
    const now = Date.now();
    for (const [id, exp] of seen) if (exp <= now) seen.delete(id);
    if (seen.has(key)) return false;
    seen.set(key, expiresAt);
    return true;
  },
};

function askVerifyKey(): AssertionKey | null {
  const kid = process.env.MY_TRUSTHUB_V23_ASK_KEY_ID?.trim() ?? "";
  const pem = process.env.MY_TRUSTHUB_V23_ASK_VERIFY_PUBLIC_KEY_PEM ?? "";
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(kid) || !pem.includes("PUBLIC KEY")) return null;
  return { kid, pem };
}

/** Signed source callback from My TrustHub. Unavailable (503) until Ask's
 * verification key is configured; it initiates nothing and never calls Ask. */
export async function POST(request: Request) {
  return handleContractorSource(request, { reader: contractorProfileReader, key: askVerifyKey(), nonces, acks: postgresAckStore((text, params) => query(text, params)) });
}
