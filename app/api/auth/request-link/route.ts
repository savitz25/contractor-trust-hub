import { NextResponse } from "next/server";
import { sendMagicLinkEmail } from "@/lib/auth/email";
import { createMagicLink } from "@/lib/auth/session";
import { absoluteUrl } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { email?: string };
  try {
    body = (await request.json()) as { email?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const email = (body.email || "").trim().toLowerCase();
  if (!email.includes("@")) {
    return NextResponse.json({ error: "Valid email required." }, { status: 400 });
  }

  try {
    const { token } = await createMagicLink(email);
    const magicUrl = absoluteUrl(`/api/auth/verify?token=${encodeURIComponent(token)}`);
    const mail = await sendMagicLinkEmail({ to: email, magicUrl });
    return NextResponse.json({
      ok: true,
      sent: mail.sent,
      /** Only returned when email provider is not configured — for local/dev recovery */
      previewUrl: mail.preview || undefined,
      message: mail.sent
        ? "Check your email for a sign-in link (expires in about 30 minutes)."
        : "Email delivery is not configured on this environment. Use the preview link if shown, or set RESEND_API_KEY.",
    });
  } catch (e) {
    console.error("[auth/request-link]", e);
    return NextResponse.json(
      {
        error:
          "Could not create sign-in link. Durable accounts require database migration 005 (Stage 5 tables).",
      },
      { status: 503 }
    );
  }
}
