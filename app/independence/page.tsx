import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { LegalNotice } from "@/components/trust/LegalNotice";
import { pageMetadata } from "@/lib/seo/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "Independence & how we make money",
  description:
    "Contractor Trust Hub does not sell leads or paid rankings. How we stay independent and transparent about verification research.",
  path: "/independence",
});

export default function IndependencePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Independence", path: "/independence" },
        ]}
      />
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
        Trust infrastructure
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)]">
        Independence & how we make money
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)] sm:text-base">
        Trust only works if incentives are clear. This page states how Contractor Trust Hub is
        positioned — and what we will not do — so you can judge our research on the evidence, not
        on hidden commercial pressure.
      </p>

      <section className="mt-10 space-y-4 text-sm leading-relaxed text-[var(--muted)]">
        <h2 className="text-lg font-semibold text-[var(--text)]">What we are</h2>
        <p>
          An independent research tool that organizes official public records (starting with
          Florida construction licenses and Sunbiz entities) so homeowners and buyers can verify
          before they hire. Our tagline is literal:{" "}
          <strong className="text-[var(--text)]">Before you hire, verify.</strong>
        </p>
      </section>

      <section className="mt-10 space-y-4 text-sm leading-relaxed text-[var(--muted)]">
        <h2 className="text-lg font-semibold text-[var(--text)]">What we are not</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-[var(--text)]">Not a lead marketplace.</strong> We do not sell
            your contact information to contractors. We do not run “get three free quotes” funnels
            that monetize your inquiry.
          </li>
          <li>
            <strong className="text-[var(--text)]">Not a paid ranking product.</strong> Contractors
            cannot pay to appear higher in search or discovery. Ordering on browse pages is for
            navigation (e.g. active licenses first, then name) — not a quality score or sponsored
            placement.
          </li>
          <li>
            <strong className="text-[var(--text)]">Not an endorsement engine.</strong> Showing a
            license record is not a recommendation to hire. Absence of discipline in our extract is
            not a certificate of excellence.
          </li>
          <li>
            <strong className="text-[var(--text)]">Not a consumer reporting agency.</strong> We do
            not produce FCRA consumer reports for employment, credit, or insurance underwriting.
          </li>
        </ul>
      </section>

      <section className="mt-10 space-y-4 text-sm leading-relaxed text-[var(--muted)]">
        <h2 className="text-lg font-semibold text-[var(--text)]">How we make money (today &amp; later)</h2>
        <p>
          <strong className="text-[var(--text)]">Today:</strong> the Florida Verify product is
          operated as independent research infrastructure. Consumer search, discovery, and Trust
          Reports are free to use. We do not charge contractors for placement.
        </p>
        <p>
          <strong className="text-[var(--text)]">Later (if ever):</strong> any revenue model must
          preserve independence. Acceptable examples include optional tools, data partnerships that
          do not alter consumer rankings, or network-level products that never sell leads or paid
          “featured” contractor slots. Unacceptable examples include selling homeowner leads,
          auctioning rankings, or accepting payment to suppress discipline history.
        </p>
        <p>
          If our funding or revenue model changes in a way that affects this page, we will update it
          here — not hide it in fine print.
        </p>
      </section>

      <section className="mt-10 space-y-4 text-sm leading-relaxed text-[var(--muted)]">
        <h2 className="text-lg font-semibold text-[var(--text)]">Network principles</h2>
        <p>
          Contractor Trust Hub is part of the Ask Trust Hub network alongside Move, Lender, and
          Insurance Trust Hub — independent research surfaces under common ownership, with
          separated research and listing order and no paid placements. Network principles favor
          evidence over opinion, transparency over black-box scores, and user agency over capture.
          We would rather show less data than invent a false link or a paid “top contractor” badge.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Prefer official public sources over user reviews or paid directories</li>
          <li>Prefer no Sunbiz link over a low-confidence guess</li>
          <li>Publish methodology so others can challenge our rules</li>
          <li>Provide a corrections path when we are wrong</li>
        </ul>
      </section>

      <section className="mt-10 space-y-4 text-sm leading-relaxed text-[var(--muted)]">
        <h2 className="text-lg font-semibold text-[var(--text)]">Conflicts of interest</h2>
        <p>
          We do not accept payment from contractors to alter Trust Reports, search results, or
          discovery listings. Staff and operators should not have undisclosed financial interests
          that depend on promoting a specific contractor through this product.
        </p>
      </section>

      <div className="mt-10 flex flex-wrap gap-3 text-sm">
        <Link href="/methodology" className="text-[var(--accent)]">
          Methodology
        </Link>
        <span className="text-[var(--border)]">·</span>
        <Link href="/corrections" className="text-[var(--accent)]">
          Request a correction
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
