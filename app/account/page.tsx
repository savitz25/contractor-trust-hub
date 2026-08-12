import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountClient } from "@/components/account/AccountClient";
import { pageMetadata } from "@/lib/seo/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "Account — save projects & Home Passport",
  description:
    "Optional email sign-in to keep Contractor Trust Hub projects, watches, and Home Passport durable across devices.",
  path: "/account",
});

export default function AccountPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading account…</p>}>
        <AccountClient />
      </Suspense>
    </main>
  );
}
