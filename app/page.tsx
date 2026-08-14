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
import {
  getLiveStateCount,
  getLiveVerifyNavLinks,
  liveStatesPlainList,
} from "@/lib/states/config";
import { pageMetadata } from "@/lib/seo/page-meta";

const liveCount = getLiveStateCount();

export const metadata: Metadata = pageMetadata({
  title: "Contractor Trust Hub — Before you hire, verify",
  description: `Check official contractor license evidence before you hire. ${liveCount} live states — Florida full journey; peers are Verify-first with honest board scope.`,
  path: "/",
});

export default function HomePage() {
  return (
    <main>
      {/* Returning users: continue project / passport / property */}
      <HomeContinuity />

      {/* 1. Hero — multi-state network + primary CTAs */}
      <HomeHero />

      {/* 2. Multi-state landscape (all live states) */}
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
                — official board extracts for {liveStatesPlainList()} (scope differs by state;
                see coverage on each tile above).
              </li>
              <li>
                <span className="font-medium text-[var(--text)]">2. Entity link (Florida-deep)</span>{" "}
                — high-confidence Sunbiz match only. Other states do not invent SOS entity links.
              </li>
              <li>
                <span className="font-medium text-[var(--text)]">3. Discipline / coverage notes</span>{" "}
                — when present in our extracts (e.g. Florida board actions, Arizona ROC rows, NJ
                flags). Absence ≠ clean history. Always re-check the official board.
              </li>
            </ol>
            <div className="mt-6 flex flex-wrap gap-2 sm:gap-3">
              {getLiveVerifyNavLinks().map((c, i) => (
                <Link
                  key={c.href}
                  href={c.href}
                  className={
                    i === 0
                      ? "inline-flex min-h-11 items-center rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--navy)] no-underline hover:brightness-105"
                      : "inline-flex min-h-11 items-center rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text)] no-underline hover:bg-[var(--bg-elevated)]"
                  }
                >
                  {c.label.replace(/ Verify$/, "")}
                </Link>
              ))}
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
              Florida discovery from public license data — not paid rankings. Other states use
              Verify search with board-specific scope rather than county browse.
            </p>
          </div>
          <ResearchBrowse />
        </div>
      </section>
    </main>
  );
}
