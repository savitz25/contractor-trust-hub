import type { Metadata } from "next";
import Link from "next/link";
import { LegalNotice } from "@/components/trust/LegalNotice";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How Contractor Trust Hub verifies Florida contractors using official public records.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "How Contractor Trust Hub works",
    description:
      "How Contractor Trust Hub verifies Florida contractors using official public records.",
    url: "/about",
    type: "website",
  },
};

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
        About
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)]">
        How Contractor Trust Hub works
      </h1>
      <div className="mt-8 space-y-6 text-[var(--muted)] leading-relaxed">
        <p>
          <strong className="text-[var(--text)]">Before you hire, verify.</strong> We built this as
          an independent research tool for homeowners and buyers who want to check a Florida
          contractor against official public records — without navigating a maze of government
          sites alone.
        </p>
        <p>
          We are <strong className="text-[var(--text)]">not</strong> a lead marketplace. We do not
          sell placements, collect bids, or rank contractors by paid advertising. See{" "}
          <Link href="/independence" className="text-[var(--accent)]">
            Independence & how we make money
          </Link>
          .
        </p>

        <h2 className="pt-4 text-xl font-semibold text-[var(--text)]">What you can check</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Florida construction license status, type, and key dates (DBPR)</li>
          <li>
            Linked Sunbiz business entity status, document number, and officers — only when a
            high-confidence match exists
          </li>
          <li>Board discipline actions when linked in our extracts</li>
        </ul>

        <h2 className="pt-4 text-xl font-semibold text-[var(--text)]">Two ways to start</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <Link href="/verify" className="text-[var(--accent)]">
              Search
            </Link>{" "}
            by license number or company name
          </li>
          <li>
            <Link href="/florida" className="text-[var(--accent)]">
              Browse Florida
            </Link>{" "}
            by county and trade
          </li>
        </ul>

        <h2 className="pt-4 text-xl font-semibold text-[var(--text)]">Florida first</h2>
        <p>
          The live product is Florida-only. The architecture is designed so additional states can
          plug in as separate evidence sources without rewriting the verify experience.
        </p>

        <h2 className="pt-4 text-xl font-semibold text-[var(--text)]">Your responsibility</h2>
        <p>
          Always confirm current status on the official board before hiring. Our snapshots can lag
          live board systems. We are not a consumer reporting agency. Read the{" "}
          <Link href="/disclaimer" className="text-[var(--accent)]">
            full disclaimer
          </Link>
          .
        </p>

        <h2 className="pt-4 text-xl font-semibold text-[var(--text)]">Think something is wrong?</h2>
        <p>
          Use our{" "}
          <Link href="/corrections" className="text-[var(--accent)]">
            corrections process
          </Link>
          . We review requests against official public sources.
        </p>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/verify"
          className="inline-flex min-h-11 items-center rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--navy)] no-underline"
        >
          Verify a contractor
        </Link>
        <Link
          href="/methodology"
          className="inline-flex min-h-11 items-center rounded-xl border border-[var(--border)] px-5 text-sm font-medium text-[var(--text)] no-underline"
        >
          Methodology
        </Link>
      </div>

      <div className="mt-10">
        <LegalNotice />
      </div>
    </main>
  );
}
