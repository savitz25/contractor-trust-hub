import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
const ASK = "https://www.asktrusthub.com";
const safeHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow, noarchive", "X-Content-Type-Options": "nosniff" };
function unavailable(status = 400) { return new NextResponse("Secure Save is unavailable or expired. Return to the profile and try again.", { status, headers: safeHeaders }); }
export async function POST(request: Request) {
  const secret = process.env.MY_TRUSTHUB_P13_CONTRACTOR_SECRET;
  if (process.env.MY_TRUSTHUB_CONTRACTOR_SAVE_ENABLED !== "true" || !secret) return unavailable(404);
  if (request.headers.get("origin") !== ASK || Number(request.headers.get("content-length") ?? 0) > 1024) return unavailable();
  try {
    const raw = await request.text(); if (raw.length > 1024) return unavailable();
    const intent = new URLSearchParams(raw).get("intent"); if (!intent || !/^[A-Za-z0-9_-]{43}$/.test(intent)) return unavailable();
    const result = await fetch(`${ASK}/api/my-trusthub/handoff/issue`, { method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" }, body: JSON.stringify({ intent, issuer: "contractor", audience: "ask" }), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) });
    if (!result.ok) return unavailable();
    const { code } = await result.json(); if (typeof code !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(code)) return unavailable();
    const nonce = randomBytes(32).toString("base64url");
    return new NextResponse(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Save to My TrustHub</title><body><main><h1>Save to My TrustHub</h1><form method="post" action="${ASK}/my/handoff/arrive"><input type="hidden" name="code" value="${code}"><button type="submit">Continue secure Save</button></form></main><script nonce="${nonce}">document.forms[0].submit()</script></body></html>`, { headers: { ...safeHeaders, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; form-action ${ASK}/my/handoff/arrive; frame-ancestors 'none'; base-uri 'none'` } });
  } catch { return unavailable(503); }
}
