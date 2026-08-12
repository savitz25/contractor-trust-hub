import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import type { DurableWorkspace } from "@/lib/passport/types";
import {
  loadWorkspace,
  mergeWorkspaces,
  saveWorkspace,
  saveAlertPreferences,
} from "@/lib/passport/workspace-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Pull cloud workspace */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  try {
    const workspace = await loadWorkspace(user.id);
    return NextResponse.json({ workspace, email: user.email });
  } catch (e) {
    console.error("[account/sync GET]", e);
    return NextResponse.json({ error: "Workspace unavailable." }, { status: 503 });
  }
}

/** Push local workspace; merge with cloud and return result */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  let body: { workspace?: DurableWorkspace; mode?: "merge" | "replace" };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!body.workspace) {
    return NextResponse.json({ error: "workspace required." }, { status: 400 });
  }

  try {
    const cloud = await loadWorkspace(user.id);
    const next =
      body.mode === "replace"
        ? { ...body.workspace, version: 2 as const, updatedAt: new Date().toISOString() }
        : mergeWorkspaces(cloud, body.workspace);
    await saveWorkspace(user.id, next);
    if (next.alertPreferences) {
      await saveAlertPreferences(user.id, next.alertPreferences);
    }
    return NextResponse.json({ workspace: next, email: user.email });
  } catch (e) {
    console.error("[account/sync POST]", e);
    return NextResponse.json(
      { error: "Could not save. Ensure Stage 5 migration is applied." },
      { status: 503 }
    );
  }
}
