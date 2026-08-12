import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import type { AlertPreferences } from "@/lib/passport/types";
import {
  loadAlertPreferences,
  loadWorkspace,
  saveAlertPreferences,
  saveWorkspace,
} from "@/lib/passport/workspace-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  try {
    const prefs = await loadAlertPreferences(user.id);
    return NextResponse.json({ preferences: prefs });
  } catch {
    return NextResponse.json({ error: "Unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  let body: { preferences?: AlertPreferences };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!body.preferences) {
    return NextResponse.json({ error: "preferences required." }, { status: 400 });
  }
  try {
    await saveAlertPreferences(user.id, body.preferences);
    const ws = await loadWorkspace(user.id);
    ws.alertPreferences = body.preferences;
    await saveWorkspace(user.id, ws);
    return NextResponse.json({ ok: true, preferences: body.preferences });
  } catch {
    return NextResponse.json({ error: "Save failed." }, { status: 503 });
  }
}
