import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo/page-meta";

/**
 * Magic links hit /api/auth/verify directly.
 * This page is a friendly fallback if someone lands here without a token.
 */
export const metadata: Metadata = pageMetadata({
  title: "Verify sign-in",
  description: "Complete Contractor Trust Hub email sign-in.",
  path: "/account/verify",
  noIndex: true,
});

export default function AccountVerifyFallbackPage() {
  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Sign-in link</h1>
      <p className="mt-3 text-sm text-[var(--muted)]">
        Open the link from your email, or request a new one from your account page.
      </p>
      <Link href="/account" className="mt-6 inline-block text-sm font-semibold text-[var(--navy)]">
        Back to account
      </Link>
    </main>
  );
}
