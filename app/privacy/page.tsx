import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "Privacy",
  description:
    "How Contractor Trust Hub uses PostHog for product analytics, what is collected, and how to opt out.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
        Legal foundation
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)]">Privacy</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)] sm:text-base">
        This page says what product analytics does on the public site. A cookie banner is not
        shown.
      </p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-[var(--muted)]">
        <section>
          <h2 className="text-lg font-semibold text-[var(--text)]">Analytics and cookies</h2>
          <p className="mt-2">
            We use PostHog for product analytics when a project key is present. Events can include
            pages viewed, clicks on links, buttons, and forms, device and browser info, and an
            anonymous id stored in local storage and a cookie. Email addresses, search text, sign-in
            fields, and sensitive URL parameters are removed before an event is sent. The event asks
            PostHog not to add a location from the network address. PostHog can still receive that
            address with the request, and whether it is stored is a PostHog project setting that this
            site does not change. This site does not set how long events are kept. Retention follows
            the PostHog project settings. Do Not Track, Global Privacy Control, or blocking cookies
            turns analytics off in this browser. A cookie banner is not shown.
          </p>
        </section>
      </div>
    </main>
  );
}
