import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How Contractor Trust Hub verifies Florida contractors using official public records.",
};

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
        About
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)]">
        How Contractor Trust Hub works
      </h1>
      <div className="mt-8 space-y-6 text-[var(--muted)] leading-relaxed">
        <p>
          <strong className="text-[var(--text)]">Before you hire, verify.</strong> We built
          this as an independent research tool for homeowners and buyers who want to check a
          Florida contractor against official public records — without navigating a maze of
          government sites.
        </p>
        <p>
          We are <strong className="text-[var(--text)]">not</strong> a lead marketplace. We do
          not sell placements, collect bids, or rank contractors by paid advertising.
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

        <h2 className="pt-4 text-xl font-semibold text-[var(--text)]">Florida first</h2>
        <p>
          Phase 1 is Florida-only. The product architecture is designed so New Jersey and other
          states can plug in as separate evidence sources without rewriting the verify
          experience.
        </p>

        <h2 className="pt-4 text-xl font-semibold text-[var(--text)]">Your responsibility</h2>
        <p>
          Always confirm current status on the official board before hiring. Our snapshots can
          lag the live board systems.
        </p>
      </div>
      <Link
        href="/verify"
        className="mt-10 inline-flex rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--navy)] no-underline"
      >
        Verify a contractor
      </Link>
    </main>
  );
}
