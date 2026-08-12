import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import type { DurableWorkspace } from "@/lib/passport/types";
import { loadWorkspace, mergeWorkspaces, saveWorkspace } from "@/lib/passport/workspace-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One-tap import of device-local workspace into the signed-in account. */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  let body: { workspace?: DurableWorkspace };
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
    const merged = mergeWorkspaces(cloud, body.workspace);
    await saveWorkspace(user.id, merged);
    return NextResponse.json({
      ok: true,
      workspace: merged,
      message: "Local data merged into your account.",
    });
  } catch (e) {
    console.error("[account/import-local]", e);
    return NextResponse.json({ error: "Import failed." }, { status: 503 });
  }
}
