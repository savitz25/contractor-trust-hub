import type { Metadata } from "next";
import Link from "next/link";
import { LegalNotice } from "@/components/trust/LegalNotice";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "Transparent methodology for Florida contractor license and Sunbiz entity evidence, including high-confidence matching rules.",
  alternates: { canonical: "/methodology" },
  openGraph: {
    title: "Methodology — Contractor Trust Hub",
    description:
      "Transparent methodology for Florida contractor license and Sunbiz entity evidence.",
    url: "/methodology",
    type: "website",
  },
};

export default function MethodologyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
        Transparency
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)]">
        Methodology
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)] sm:text-base">
        How we collect, link, and present Florida contractor evidence. We publish this so anyone can
        challenge our rules — and so we stay accountable to high-confidence standards.
      </p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-[var(--muted)]">
        <section>
          <h2 className="text-lg font-semibold text-[var(--text)]">1. License evidence</h2>
          <p className="mt-2">
            We ingest official Florida DBPR Construction Industry public bulk extracts (licensees
            and discipline). Stable keys prefer the published full license id (e.g.{" "}
            <code className="text-[var(--accent)]">CBC015082</code>). Qualifying Business (QB) rows
            without license numbers are never given invented IDs. Thin shells without a full
            consumer-facing license record are excluded from search (
            <code className="text-[var(--accent)]">is_thin_profile</code>).
          </p>
          <p className="mt-2">
            <strong className="text-[var(--text)]">Source:</strong>{" "}
            <a
              href="https://www2.myfloridalicense.com/construction-industry/"
              target="_blank"
              rel="noreferrer"
              className="text-[var(--accent)]"
            >
              Florida DBPR — Construction Industry Licensing Board
            </a>
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text)]">2. Entity evidence</h2>
          <p className="mt-2">
            Sunbiz (Division of Corporations) corporate bulk files provide entity status, document
            numbers, formation dates, and officers. We store these as{" "}
            <code className="text-[var(--accent)]">fl_sunbiz</code> entities.
          </p>
          <p className="mt-2">
            <strong className="text-[var(--text)]">Source:</strong>{" "}
            <a
              href="https://dos.fl.gov/sunbiz/"
              target="_blank"
              rel="noreferrer"
              className="text-[var(--accent)]"
            >
              Florida Division of Corporations (Sunbiz)
            </a>
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text)]">3. Linking standard (high confidence only)</h2>
          <p className="mt-2">
            Contractor ↔ Sunbiz links use <strong className="text-[var(--text)]">exact matching
            only</strong>. We surface a Sunbiz status on search results and Trust Reports only when:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Link role is <code className="text-[var(--accent)]">sunbiz_entity</code>
            </li>
            <li>
              Confidence is at least <strong className="text-[var(--text)]">0.90</strong>
            </li>
          </ul>
          <p className="mt-3 font-medium text-[var(--text)]">Match methods and confidence:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Exact normalized name + address + ZIP — 0.98</li>
            <li>Exact normalized name + ZIP — 0.95</li>
            <li>Exact normalized name + city — 0.92</li>
          </ul>
          <p className="mt-2">
            Ambiguous ties (two different document numbers at the same top confidence) produce{" "}
            <strong className="text-[var(--text)]">no link</strong>. We prefer no profile over a
            wrong one. Name search for consumers is more forgiving (e.g. ignoring “LLC”); entity
            linking is not.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text)]">4. Discipline</h2>
          <p className="mt-2">
            Board discipline extracts are linked when they attach to the contractor or license in
            our load. “None linked in extract” means none in our current files — not a legal
            warranty of a clean history.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text)]">5. Freshness (“last verified”)</h2>
          <p className="mt-2">
            Each loaded record carries source provenance and a last-verified timestamp from our
            ingest batch. That timestamp means “present in our successful load at this time,” not
            “checked live at page view.” Board systems remain the authority for real-time status.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text)]">6. What we do not do</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Fuzzy name matching or “close enough” entity merges</li>
            <li>Paid rankings, featured placements, or lead generation forms</li>
            <li>Invented licenses, fabricated IDs, or thin filler profiles for SEO</li>
            <li>Trust Scores that pretend to be a single “hire / don’t hire” number</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text)]">7. Corrections</h2>
          <p className="mt-2">
            If our presentation or linking is wrong, use{" "}
            <Link href="/corrections" className="text-[var(--accent)]">
              Request a correction
            </Link>
            . We review against official sources.
          </p>
        </section>
      </div>

      <div className="mt-10 flex flex-wrap gap-3 text-sm">
        <Link href="/independence" className="text-[var(--accent)]">
          Independence
        </Link>
        <span className="text-[var(--border)]">·</span>
        <Link href="/disclaimer" className="text-[var(--accent)]">
          Disclaimer
        </Link>
        <span className="text-[var(--border)]">·</span>
        <Link href="/about" className="text-[var(--accent)]">
          How it works
        </Link>
      </div>

      <div className="mt-10">
        <LegalNotice />
      </div>
    </main>
  );
}
