import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { LegalNotice } from "@/components/trust/LegalNotice";
import { pageMetadata } from "@/lib/seo/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "Methodology — how we collect contractor evidence",
  description:
    "How Contractor Trust Hub collects and presents official license extracts, high-confidence entity links, and discipline rows. Matching rules and limits — not ratings.",
  path: "/methodology",
});

export default function MethodologyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Methodology", path: "/methodology" },
        ]}
      />
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
        Transparency
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)]">
        Methodology
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)] sm:text-base">
        How we collect, link, and present contractor license evidence from official public records.
        We publish this so anyone can challenge our rules — and so we stay accountable to
        high-confidence standards. For a short map of which states are live, see{" "}
        <Link href="/tools/coverage" className="font-medium text-[var(--navy)]">
          where we have coverage
        </Link>
        .
      </p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-[var(--muted)]">
        <section>
          <h2 className="text-lg font-semibold text-[var(--text)]">1. License evidence</h2>
          <p className="mt-2">
            We load official board extracts for each live state (for example, Florida DBPR
            Construction Industry bulk files for licenses and discipline). We keep the published
            license id when the board publishes one (e.g.{" "}
            <span className="font-mono text-[var(--accent)]">CBC015082</span>). Rows without a real
            consumer-facing license id are not shown as full Trust Reports. Incomplete shells are
            kept out of search so you do not get empty fake profiles.
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
            Where we auto-link business filings (notably Florida Sunbiz / Division of Corporations),
            bulk corporate files supply entity status, document numbers, formation dates, and
            officers when the match rules pass. Other states may show entity data only when a
            high-confidence link exists — we do not invent company filings.
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
            Contractor ↔ entity links use <strong className="text-[var(--text)]">exact matching
            only</strong> where we support auto-linking. We show an entity status on search results
            and Trust Reports only when the match is high-confidence (we require a strong exact
            match — roughly 90%+ confidence on our internal scale). Examples of strong matches:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Exact normalized name + address + ZIP</li>
            <li>Exact normalized name + ZIP</li>
            <li>Exact normalized name + city</li>
          </ul>
          <p className="mt-2">
            Ambiguous ties (two different company records at the same top confidence) produce{" "}
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
        <Link href="/guides" className="text-[var(--accent)]">
          Homeowner guides
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
