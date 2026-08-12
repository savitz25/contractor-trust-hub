import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Disclaimer",
  description:
    "Legal and educational disclaimer for Contractor Trust Hub public-records research tools.",
  alternates: { canonical: "/disclaimer" },
  openGraph: {
    title: "Disclaimer — Contractor Trust Hub",
    description:
      "Educational research tooling based on public records. Not a consumer reporting agency.",
    url: "/disclaimer",
    type: "website",
  },
};

export default function DisclaimerPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
        Legal foundation
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)]">
        Disclaimer
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)] sm:text-base">
        Please read this carefully. It is written in plain language so you know what this product
        is — and is not — before you rely on it.
      </p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-[var(--muted)]">
        <section>
          <h2 className="text-lg font-semibold text-[var(--text)]">1. Educational research tooling</h2>
          <p className="mt-2">
            Contractor Trust Hub provides educational research tools that organize and display
            information derived from government public records (including Florida DBPR construction
            license extracts, Sunbiz business filings, and related discipline extracts). The site is
            offered so that people can more easily review public evidence before hiring a
            contractor.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text)]">
            2. Not a substitute for official sources
          </h2>
          <p className="mt-2">
            Our data can lag live government systems. Board and registry websites remain the
            authoritative source for current license status, discipline, and business filings.{" "}
            <strong className="text-[var(--text)]">
              Always verify critical details directly with the official board (and other required
              local checks) before you hire.
            </strong>
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text)]">
            3. Not a consumer reporting agency
          </h2>
          <p className="mt-2">
            We are not a “consumer reporting agency” and do not provide “consumer reports” as those
            terms are used under the Fair Credit Reporting Act (FCRA) or similar laws. Do not use
            this site to make employment, credit, housing, insurance underwriting, or other
            FCRA-covered decisions. Use official licensing and other appropriate channels for those
            purposes.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text)]">4. No endorsement or warranty</h2>
          <p className="mt-2">
            Displaying a contractor profile is not an endorsement, rating, or recommendation to hire
            (or not hire). We make no warranty that information is complete, continuous, or free of
            error. Matching between license records and corporate filings uses transparent
            high-confidence rules; absence of a link is not proof that no entity exists.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text)]">5. No professional advice</h2>
          <p className="mt-2">
            Content on this site is not legal, financial, engineering, or insurance advice. Hiring a
            contractor involves contracts, permits, insurance, and local requirements that you must
            evaluate with appropriate professionals.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text)]">6. Public records ownership</h2>
          <p className="mt-2">
            Public records remain the property of the issuing government body. We reorganize and
            present extracts for research convenience. Official seals, trademarks, and board branding
            remain with their owners.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text)]">7. Corrections</h2>
          <p className="mt-2">
            If you believe we have made an error in how we present or link public data, please use
            our{" "}
            <Link href="/corrections" className="text-[var(--accent)]">
              corrections process
            </Link>
            . We review requests against official sources; we do not invent statuses that the board
            does not support.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text)]">8. Independence</h2>
          <p className="mt-2">
            We do not sell leads or paid rankings. See{" "}
            <Link href="/independence" className="text-[var(--accent)]">
              Independence & how we make money
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text)]">9. Limitation of liability</h2>
          <p className="mt-2">
            To the fullest extent permitted by law, Contractor Trust Hub and its operators are not
            liable for decisions made solely on the basis of this site, including hiring decisions,
            contract disputes, or damages arising from reliance on delayed or incomplete extracts.
            Your use of the site is at your own risk.
          </p>
        </section>
      </div>

      <p className="mt-10 text-xs text-[var(--muted)]">
        Last updated: August 2026. This page may be revised as the product and legal landscape
        evolve.
      </p>

      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        <Link href="/methodology" className="text-[var(--accent)]">
          Methodology
        </Link>
        <span className="text-[var(--border)]">·</span>
        <Link href="/independence" className="text-[var(--accent)]">
          Independence
        </Link>
        <span className="text-[var(--border)]">·</span>
        <Link href="/corrections" className="text-[var(--accent)]">
          Corrections
        </Link>
      </div>
    </main>
  );
}
