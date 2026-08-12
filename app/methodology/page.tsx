import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "Transparent methodology for Florida contractor license and Sunbiz entity evidence.",
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
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
        Transparency
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)]">
        Methodology
      </h1>
      <div className="mt-8 space-y-6 text-sm leading-relaxed text-[var(--muted)]">
        <section>
          <h2 className="text-lg font-semibold text-[var(--text)]">1. License evidence</h2>
          <p className="mt-2">
            We ingest the official Florida DBPR Construction Industry public bulk extracts
            (licensees and discipline). Stable keys prefer the published full license id (e.g.{" "}
            <code className="text-[var(--accent)]">CBC015082</code>). Qualifying Business (QB)
            rows without license numbers are never given invented IDs.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-[var(--text)]">2. Entity evidence</h2>
          <p className="mt-2">
            Sunbiz (Division of Corporations) corporate bulk files provide entity status,
            document numbers, formation dates, and officers. We load these as{" "}
            <code className="text-[var(--accent)]">fl_sunbiz</code> entities.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-[var(--text)]">3. Linking standard</h2>
          <p className="mt-2">
            Contractor ↔ Sunbiz links use <strong className="text-[var(--text)]">high-confidence
            exact matching only</strong>:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Exact normalized name + address + ZIP (0.98)</li>
            <li>Exact normalized name + ZIP (0.95)</li>
            <li>Exact normalized name + city (0.92)</li>
          </ul>
          <p className="mt-2">
            Ambiguous ties (two document numbers at the same confidence) produce no link. We
            prefer no profile over a wrong one.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-[var(--text)]">4. What we do not do</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Fuzzy name matching or “close enough” merges</li>
            <li>Paid rankings or featured placements</li>
            <li>Lead generation forms or quote marketplaces</li>
            <li>Invented licenses, NMLS-style IDs, or thin filler profiles</li>
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-[var(--text)]">5. Freshness</h2>
          <p className="mt-2">
            Each loaded record carries source provenance and a last-verified timestamp from our
            ingest batch. Board systems remain the authority for real-time status.
          </p>
        </section>
      </div>
      <Link href="/about" className="mt-10 inline-block text-sm text-[var(--accent)]">
        ← How it works
      </Link>
    </main>
  );
}
