import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { listGuides } from "@/lib/guides/registry";
import { pageMetadata } from "@/lib/seo/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "Florida contractor guides",
  description:
    "Short educational guides for Florida homeowners: how to verify a contractor, hiring red flags, and license types. Evidence-only research — not a marketplace or ranking list.",
  path: "/guides",
});

export default function GuidesIndexPage() {
  const guides = listGuides();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Guides", path: "/guides" },
        ]}
      />
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
        Florida · education
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)]">
        Guides for homeowners
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)] sm:text-base">
        Practical research pages — not a blog of “best contractors,” not lead forms, and not legal
        advice. Each guide routes back into Verify, Plan, and official sources.
      </p>

      <ul className="mt-8 space-y-3">
        {guides.map((g) => (
          <li key={g.slug}>
            <Link
              href={g.path}
              className="block rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 no-underline shadow-[var(--shadow-sm)] transition hover:border-[var(--navy)]/20 sm:p-5"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                {g.kicker}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">{g.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">{g.intent}</p>
              <p className="mt-3 text-sm font-medium text-[var(--navy)]">Read guide →</p>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/verify"
          className="inline-flex min-h-11 items-center rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--navy)] no-underline"
        >
          Verify a contractor
        </Link>
        <Link
          href="/plan"
          className="inline-flex min-h-11 items-center rounded-xl border border-[var(--border)] px-4 text-sm font-medium text-[var(--navy)] no-underline"
        >
          Plan a project
        </Link>
      </div>
    </main>
  );
}
