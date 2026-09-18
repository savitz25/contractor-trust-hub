import { type NextRequest, NextResponse } from "next/server";
import { normalizedPublishedStatePath } from "@/lib/seo/published-state-path";

export function proxy(request: NextRequest) {
  const nextPath = normalizedPublishedStatePath(request.nextUrl.pathname);
  if (!nextPath) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = nextPath;
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: ["/:path"],
};
