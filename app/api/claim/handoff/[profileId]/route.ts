import { claimCtaEnabledFor, loadEligibleClaimProfile, logClaimHandoff, mintClaimHandoff } from "@/lib/claim/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await params;
  try {
    if (!claimCtaEnabledFor(profileId)) {
      logClaimHandoff("claim_handoff_failed", { reason: "unavailable" });
      return Response.json({ error: "Profile management is unavailable." }, { status: 404, headers: NO_STORE });
    }
    const profile = await loadEligibleClaimProfile(profileId);
    if (!profile) {
      logClaimHandoff("claim_handoff_failed", { reason: "ineligible" });
      return Response.json({ error: "Profile management is unavailable." }, { status: 404, headers: NO_STORE });
    }
    const { token } = mintClaimHandoff(profile);
    logClaimHandoff("claim_handoff_minted", {
      native_profile_id: profile.id,
      state: "FL",
      source_system: "fl_dbpr",
    });
    const target = new URL("https://www.asktrusthub.com/claim/continue");
    target.searchParams.set("handoff", token);
    return Response.redirect(target, 302);
  } catch {
    logClaimHandoff("claim_handoff_failed", { reason: "unavailable" });
    return Response.json({ error: "Profile management is temporarily unavailable." }, { status: 503, headers: NO_STORE });
  }
}
