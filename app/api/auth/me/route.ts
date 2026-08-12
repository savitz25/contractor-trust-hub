import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { loadAlertPreferences, loadWorkspace } from "@/lib/passport/workspace-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ user: null });
    const workspace = await loadWorkspace(user.id);
    const alertPreferences = await loadAlertPreferences(user.id);
    return NextResponse.json({
      user,
      workspace: { ...workspace, alertPreferences },
      durable: true,
    });
  } catch (e) {
    console.error("[auth/me]", e);
    return NextResponse.json({ user: null, durable: false, error: "unavailable" });
  }
}
