/**
 * Transactional email helper.
 * If RESEND_API_KEY is set, send via Resend. Otherwise log and return preview URL for UI.
 */

export async function sendMagicLinkEmail(opts: {
  to: string;
  magicUrl: string;
}): Promise<{ sent: boolean; preview?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_FROM_EMAIL || "Contractor Trust Hub <onboarding@resend.dev>";

  if (!key) {
    console.info("[auth] Magic link (email not configured):", opts.magicUrl);
    return { sent: false, preview: opts.magicUrl };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: "Your Contractor Trust Hub sign-in link",
        text: [
          "Sign in to Contractor Trust Hub (valid ~30 minutes):",
          opts.magicUrl,
          "",
          "If you did not request this, ignore this email.",
          "Educational research tooling — not a marketplace.",
        ].join("\n"),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[auth] Resend failed", res.status, body);
      return { sent: false, preview: opts.magicUrl };
    }
    return { sent: true };
  } catch (e) {
    console.error("[auth] email error", e);
    return { sent: false, preview: opts.magicUrl };
  }
}

export async function sendAlertEmail(opts: {
  to: string;
  subject: string;
  body: string;
  href?: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_FROM_EMAIL || "Contractor Trust Hub <onboarding@resend.dev>";
  if (!key) {
    console.info("[alerts] email skipped (no RESEND_API_KEY):", opts.subject);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        text: [opts.body, opts.href ? `\nOpen: ${opts.href}` : "", "\n— Contractor Trust Hub"].join(
          "\n"
        ),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
