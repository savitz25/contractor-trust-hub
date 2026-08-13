import type { Metadata } from "next";
import Link from "next/link";
import { ResearchBrowse } from "@/components/discovery/ResearchBrowse";
import { HomeContinuity } from "@/components/home/HomeContinuity";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeSearchBlock } from "@/components/home/HomeSearchBlock";
import { IntentRouter } from "@/components/home/IntentRouter";
import { JourneySpine } from "@/components/home/JourneySpine";
import { ProofStrip } from "@/components/home/ProofStrip";
import { StateLandscape } from "@/components/home/StateLandscape";
import { ToolDiscovery } from "@/components/home/ToolDiscovery";
import { pageMetadata } from "@/lib/seo/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "Contractor Trust Hub — Before you hire, verify",
  description:
    "Independent contractor research. Florida is the full journey. Texas is specialty-trade verify. New Jersey is HIC + specialty board verify. Evidence — not a marketplace.",
  path: "/",
});

export default function HomePage() {
  return (
    <main>
      {/* Returning users: continue project / passport / property */}
      <HomeContinuity />

      {/* 1. Hero — identity + CTAs */}
      <HomeHero />

      {/* 2. Multi-state landscape (FL full / TX specialty / NJ HIC) */}
      <StateLandscape />

      {/* 3. Primary intent router */}
      <IntentRouter />

      {/* 4. Inline verify search for name/license holders */}
      <HomeSearchBlock />

      {/* 5. Full journey spine (Florida-deep) */}
      <JourneySpine />

      {/* 6. Secondary tools */}
      <ToolDiscovery />

      {/* 7. Proof / credibility */}
      <ProofStrip />

      {/* 8. Trust Report explainer */}
      <section className="border-b border-[var(--border)]">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-[var(--text)]">
              What a Trust Report shows
            </h2>
            <ol className="mt-5 space-y-4 text-sm leading-relaxed text-[var(--muted)]">
              <li>
                <span className="font-medium text-[var(--text)]">1. License / registration evidence</span>{" "}
                — Florida DBPR, Texas specialty (TDLR/TSBPE), or New Jersey HIC + specialty status,
                trade class, and dates from the public extract.
              </li>
              <li>
                <span className="font-medium text-[var(--text)]">2. Entity link (Florida-deep)</span>{" "}
                — high-confidence Sunbiz match only. Texas and New Jersey do not invent SOS entity
                links.
              </li>
              <li>
                <span className="font-medium text-[var(--text)]">3. Discipline / coverage notes</span>{" "}
                — Florida board actions when linked; New Jersey public discipline flags when present
                in bulk files; Texas specialty-only limits called out plainly.
              </li>
            </ol>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/verify"
                data-entry-path="trust-report-verify"
                className="inline-flex min-h-11 items-center rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--navy)] no-underline hover:brightness-105"
              >
                Florida Verify
              </Link>
              <Link
                href="/verify?state=tx"
                className="inline-flex min-h-11 items-center rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--text)] no-underline hover:bg-[var(--bg-elevated)]"
              >
                Texas Verify
              </Link>
              <Link
                href="/verify?state=nj"
                className="inline-flex min-h-11 items-center rounded-xl border border-violet-200 bg-violet-50 px-5 py-2.5 text-sm font-medium text-violet-950 no-underline hover:bg-violet-100"
              >
                New Jersey Verify
              </Link>
              <Link
                href="/methodology"
                className="inline-flex min-h-11 items-center rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--text)] no-underline hover:bg-[var(--bg-elevated)]"
              >
                Methodology
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 9. Browse by county/trade — secondary discovery (Florida) */}
      <section id="research" className="border-b border-[var(--border)] bg-[var(--bg)]">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="mb-6 max-w-2xl">
            <h2 className="text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
              Browse by county &amp; trade
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
              Florida discovery from public license data — not paid rankings. Texas and New Jersey
              use Verify search (specialty / HIC registration) rather than county browse.
            </p>
          </div>
          <ResearchBrowse />
        </div>
      </section>
    </main>
  );
}
