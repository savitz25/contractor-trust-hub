import { claimCtaEnabledFor, loadEligibleClaimProfile, mintClaimHandoff } from "@/lib/claim/server";
import { MemoryRateLimitStore, handleClaimHandoffGet, handleClaimStart } from "@/lib/claim/start-core";
import { getSiteUrl } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ATH-CLAIM-V2-001. Production Ask origin is fixed. A non-production override exists only so the
 * cross-repo flow can be exercised against a local Ask (`ATH_CLAIM_ASK_ORIGIN_DEV`); it is ignored in
 * production builds.
 */
const ASK_ORIGIN = process.env.NODE_ENV === "production" ? "https://www.asktrusthub.com" : (process.env.ATH_CLAIM_ASK_ORIGIN_DEV || "https://www.asktrusthub.com");

/** Per-isolate, non-durable, bounded. See lib/claim/start-core.ts header for the honest scope of this gate. */
const store = new MemoryRateLimitStore();

function log(event: string, fields?: Record<string, unknown>) {
  console.info(JSON.stringify({ src: "cth-claim", event, ...fields }));
}

/** V2 rule: GET never mints a signed handoff. */
export function GET() {
  return handleClaimHandoffGet();
}

/** V2 rule: an explicit same-origin POST is the only way to mint a signed handoff. */
export async function POST(request: Request, { params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  return handleClaimStart(request, profileId, {
    enabled: claimCtaEnabledFor,
    loadProfile: loadEligibleClaimProfile,
    mint: (profile) => mintClaimHandoff(profile),
    store,
    now: () => Date.now(),
    askOrigin: ASK_ORIGIN,
    allowedOrigins: [getSiteUrl()],
    log,
  });
}
