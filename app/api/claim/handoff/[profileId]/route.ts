import { claimCtaEnabledFor, loadEligibleClaimProfile, logClaimHandoff, mintClaimHandoff } from "@/lib/claim/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

function safeFailure(message: string, status: 404 | 503) {
  return Response.json({
    error: message,
    next: {
      primary: { label: "Find your profile", href: "/search" },
      alternative: { label: "Verify a credential", href: "/verify" },
      support: { label: "Request help", href: "/contact" },
    },
  }, { status, headers: NO_STORE });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await params;
  try {
    if (!claimCtaEnabledFor(profileId)) {
      logClaimHandoff("claim_handoff_failed", { reason: "unavailable" });
      return safeFailure("Profile management is unavailable for this profile.", 404);
    }
    const profile = await loadEligibleClaimProfile(profileId);
    if (!profile) {
      logClaimHandoff("claim_handoff_failed", { reason: "ineligible" });
      return safeFailure("This profile is not eligible for management.", 404);
    }
    const { token } = mintClaimHandoff(profile);
    logClaimHandoff("claim_handoff_minted", {
      native_profile_id: profile.id,
      state: "FL",
      source_system: "fl_dbpr",
    });
    const target = new URL("https://www.asktrusthub.com/claim/continue");
    target.searchParams.set("handoff", token);
    return new Response(null, { status: 302, headers: { ...NO_STORE, Location: target.toString() } });
  } catch {
    logClaimHandoff("claim_handoff_failed", { reason: "unavailable" });
    return safeFailure("Profile management is temporarily unavailable.", 503);
  }
}
