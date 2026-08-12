import type { Metadata } from "next";
import Link from "next/link";
import { CorrectionForm } from "@/components/trust/CorrectionForm";
import { LegalNotice } from "@/components/trust/LegalNotice";

export const metadata: Metadata = {
  title: "Request a correction",
  description:
    "How to report incorrect Florida contractor data on Contractor Trust Hub and what happens next.",
  alternates: { canonical: "/corrections" },
  openGraph: {
    title: "Request a correction — Contractor Trust Hub",
    description:
      "Report incorrect license or entity data. We review requests against official public sources.",
    url: "/corrections",
    type: "website",
  },
};

type Props = {
  searchParams: Promise<{ slug?: string; license?: string }>;
};

export default async function CorrectionsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const defaultSlug = (sp.slug || "").trim();
  const defaultLicense = (sp.license || "").trim();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
        Trust infrastructure
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)]">
        Request a correction
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)] sm:text-base">
        If you believe a Trust Report or search result is wrong, incomplete, or linked to the wrong
        business, tell us. We treat corrections seriously and check them against official public
        sources — calmly and without drama.
      </p>

      <section className="mt-10 space-y-4 text-sm leading-relaxed text-[var(--muted)]">
        <h2 className="text-lg font-semibold text-[var(--text)]">What we can correct</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Stale or mis-displayed license status or dates after a board refresh</li>
          <li>Wrong company identity on a profile (rare; usually a slug or data-merge issue)</li>
          <li>Sunbiz entity link that does not match the licensed business</li>
          <li>Discipline rows that do not belong to this contractor</li>
          <li>Obvious location or name display errors in our presentation of public data</li>
        </ul>
        <p>
          We cannot change what the official board publishes. If DBPR or Sunbiz shows a status we
          accurately reflect, the fix is with the government source — not with us inventing a
          different answer.
        </p>
      </section>

      <section className="mt-10 space-y-4 text-sm leading-relaxed text-[var(--muted)]">
        <h2 className="text-lg font-semibold text-[var(--text)]">What happens after you submit</h2>
        <ol className="list-decimal space-y-3 pl-5">
          <li>
            <strong className="text-[var(--text)]">We receive your request</strong> with the
            license id or profile URL and your description of the issue.
          </li>
          <li>
            <strong className="text-[var(--text)]">We compare to official sources</strong> (Florida
            DBPR construction extracts, Sunbiz filings, and related public records we use).
          </li>
          <li>
            <strong className="text-[var(--text)]">We update our data or explain why not</strong>
            — for example, if the board still shows the same status, or if a Sunbiz link was made
            under our high-confidence rules and remains valid.
          </li>
          <li>
            <strong className="text-[var(--text)]">We reply when we can</strong> using the email you
            provide. Response times vary; complex entity-link questions may take longer.
          </li>
        </ol>
        <p>
          We do not remove accurate public-record information because someone dislikes it. We do
          fix errors in how we present or link that information.
        </p>
      </section>

      <div className="mt-10">
        <CorrectionForm defaultSlug={defaultSlug} defaultLicense={defaultLicense} />
      </div>

      <div className="mt-10 space-y-3 text-sm text-[var(--muted)]">
        <p>
          Related:{" "}
          <Link href="/methodology" className="text-[var(--accent)]">
            Methodology
          </Link>
          {" · "}
          <Link href="/independence" className="text-[var(--accent)]">
            Independence
          </Link>
          {" · "}
          <Link href="/disclaimer" className="text-[var(--accent)]">
            Disclaimer
          </Link>
        </p>
      </div>

      <div className="mt-8">
        <LegalNotice />
      </div>
    </main>
  );
}
