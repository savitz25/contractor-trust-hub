/**
 * Same-origin browser endpoint for the Contractor Save hand-off
 * (POST /api/my-trusthub/profile-save). Mirrors the Move endpoint:
 *
 *   { action: "bootstrap" }                      -> { csrf } + HttpOnly cookie
 *   { action: "prepare", slug, intent }          -> PrepareResult
 *   { action: "status", ticket }                 -> { state }
 *
 * The browser sends the slug of the page it is on and an intent. It cannot
 * send an identity: any other field is rejected. With sync off (production)
 * every call, including bootstrap, answers 503 "unavailable" and sets nothing.
 */
import { randomBytes, timingSafeEqual } from "node:crypto";
import { parentStatus, prepareParentSave, type AdapterDeps } from "./parent-adapter";

export const COOKIE_NAME = "cth_mth_profile_transfer";
export const ENDPOINT_PATH = "/api/my-trusthub/profile-save";
const HEADERS = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow, noarchive" };
const OPAQUE = /^[A-Za-z0-9_-]{43}$/;
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: HEADERS });
const keep = (state: string, status: number) => json({ state, localCopy: "keep" }, status);

async function boundedJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("invalid");
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 4096) { await reader.cancel(); throw new Error("invalid"); }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function handleContractorProfileSave(request: Request, deps: AdapterDeps, siteOrigin: string): Promise<Response> {
  if (deps.mode === "off") return keep("unavailable", 503);
  const url = new URL(request.url);
  if (request.method !== "POST" || url.search || url.pathname !== ENDPOINT_PATH || request.headers.get("origin") !== siteOrigin ||
    request.headers.get("sec-fetch-site") !== "same-origin" || request.headers.get("content-type")?.split(";")[0] !== "application/json") return keep("invalid", 403);
  try {
    const body = await boundedJson(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) return keep("invalid", 400);
    const input = body as Record<string, unknown>, keys = Object.keys(input).sort().join();
    const existing = request.headers.get("cookie")?.split(";").map((v) => v.trim()).find((v) => v.startsWith(COOKIE_NAME + "="))?.slice(COOKIE_NAME.length + 1);
    if (input.action === "bootstrap" && keys === "action") {
      const csrf = existing && OPAQUE.test(existing) ? existing : randomBytes(32).toString("base64url");
      const response = json({ csrf });
      response.headers.set("Set-Cookie", `${COOKIE_NAME}=${csrf}; Path=${ENDPOINT_PATH}; HttpOnly; SameSite=Strict; Max-Age=86400${url.protocol === "https:" ? "; Secure" : ""}`);
      return response;
    }
    const csrf = request.headers.get("x-cth-csrf");
    if (!existing || !csrf || !OPAQUE.test(existing) || !OPAQUE.test(csrf) || !timingSafeEqual(Buffer.from(existing), Buffer.from(csrf))) return keep("invalid", 403);
    if (input.action === "prepare" && keys === "action,intent,slug") return json(await prepareParentSave(deps, input.slug, input.intent, existing));
    if (input.action === "status" && keys === "action,ticket") return json({ state: await parentStatus(deps, input.ticket, existing), localCopy: "keep" });
    return keep("invalid", 400);
  } catch {
    return keep("unavailable", 503);
  }
}
