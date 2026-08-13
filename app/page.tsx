import type { Metadata } from "next";
import Link from "next/link";
import { ResearchBrowse } from "@/components/discovery/ResearchBrowse";
import { HomeContinuity } from "@/components/home/HomeContinuity";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeSearchBlock } from "@/components/home/HomeSearchBlock";
import { IntentRouter } from "@/components/home/IntentRouter";
import { JourneySpine } from "@/components/home/JourneySpine";
import { ProofStrip } from "@/components/home/ProofStrip";
import { ToolDiscovery } from "@/components/home/ToolDiscovery";
import { pageMetadata } from "@/lib/seo/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "Contractor Trust Hub — Before you hire, verify",
  description:
    "Independent Florida contractor research from official public records. Plan scope, verify licenses, compare quotes, and protect your project — not a marketplace.",
  path: "/",
});

export default function HomePage() {
  return (
    <main>
      {/* Returning users: continue project / passport / property */}
      <HomeContinuity />

      {/* 1. Hero — identity + CTAs */}
      <HomeHero />

      {/* 2. Primary intent router */}
      <IntentRouter />

      {/* 3. Inline verify search for name/license holders */}
      <HomeSearchBlock />

      {/* 4. Full journey spine */}
      <JourneySpine />

      {/* 5. Secondary tools */}
      <ToolDiscovery />

      {/* 6. Proof / credibility */}
      <ProofStrip />

      {/* 7. Trust Report explainer */}
      <section className="border-b border-[var(--border)]">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-[var(--text)]">
              What a Trust Report shows
            </h2>
            <ol className="mt-5 space-y-4 text-sm leading-relaxed text-[var(--muted)]">
              <li>
                <span className="font-medium text-[var(--text)]">1. License evidence</span> —
                Florida DBPR status, occupation class, and dates from the public extract.
              </li>
              <li>
                <span className="font-medium text-[var(--text)]">2. Entity link</span> — high-confidence
                Sunbiz match only (exact name + geo). We do not invent corporate links.
              </li>
              <li>
                <span className="font-medium text-[var(--text)]">3. Discipline scan</span> — board
                actions linked in our extracts, with source attribution.
              </li>
            </ol>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/verify"
                data-entry-path="trust-report-verify"
                className="inline-flex min-h-11 items-center rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--navy)] no-underline hover:brightness-105"
              >
                Search a name or license
              </Link>
              <Link
                href="/methodology"
                className="inline-flex min-h-11 items-center rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--text)] no-underline hover:bg-[var(--bg-elevated)]"
              >
                Methodology
              </Link>
              <Link
                href="/independence"
                className="inline-flex min-h-11 items-center rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--text)] no-underline hover:bg-[var(--bg-elevated)]"
              >
                Independence
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Browse by county/trade — secondary discovery */}
      <section id="research" className="border-b border-[var(--border)] bg-[var(--bg)]">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="mb-6 max-w-2xl">
            <h2 className="text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
              Browse by county &amp; trade
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
              Research listings from public license data — not paid rankings or marketplace leads.
            </p>
          </div>
          <ResearchBrowse />
        </div>
      </section>
    </main>
  );
}
