import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  consumeMagicLink,
  createSession,
  sessionCookieOptions,
} from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  if (!token) {
    return NextResponse.redirect(new URL("/account?error=missing_token", url.origin));
  }

  try {
    const user = await consumeMagicLink(token);
    if (!user) {
      return NextResponse.redirect(new URL("/account?error=invalid_token", url.origin));
    }
    const sessionToken = await createSession(user.id);
    const res = NextResponse.redirect(new URL("/account?signed_in=1", url.origin));
    res.cookies.set(
      SESSION_COOKIE,
      sessionToken,
      sessionCookieOptions(60 * 60 * 24 * 30)
    );
    return res;
  } catch (e) {
    console.error("[auth/verify]", e);
    return NextResponse.redirect(new URL("/account?error=server", url.origin));
  }
}
