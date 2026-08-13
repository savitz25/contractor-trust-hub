import Link from "next/link";
import { BreadcrumbJsonLd, JsonLd } from "@/components/seo/JsonLd";
import { LegalNotice } from "@/components/trust/LegalNotice";
import type { GuideMeta } from "@/lib/guides/registry";
import { listGuides } from "@/lib/guides/registry";
import { absoluteUrl } from "@/lib/site";

export function GuideShell({
  guide,
  children,
}: {
  guide: GuideMeta;
  children: React.ReactNode;
}) {
  const related = listGuides().filter((g) => g.slug !== guide.slug);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Guides", path: "/guides" },
          { name: guide.title, path: guide.path },
        ]}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: guide.title,
          description: guide.description,
          datePublished: guide.publishedAt,
          dateModified: guide.updatedAt,
          inLanguage: "en-US",
          isAccessibleForFree: true,
          author: {
            "@type": "Organization",
            name: "Contractor Trust Hub",
            url: absoluteUrl("/"),
          },
          publisher: {
            "@type": "Organization",
            name: "Contractor Trust Hub",
            url: absoluteUrl("/"),
          },
          mainEntityOfPage: absoluteUrl(guide.path),
        }}
      />

      <nav className="text-xs font-medium text-[var(--muted)]">
        <Link href="/" className="no-underline hover:text-[var(--navy)]">
          Home
        </Link>
        <span className="mx-2 opacity-50">/</span>
        <Link href="/guides" className="no-underline hover:text-[var(--navy)]">
          Guides
        </Link>
        <span className="mx-2 opacity-50">/</span>
        <span className="text-[var(--text)]">{guide.title}</span>
      </nav>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_16.5rem] lg:items-start">
        <article className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            {guide.kicker}
          </p>
          <h1 className="mt-2 text-[1.65rem] font-semibold leading-tight tracking-tight text-[var(--text)] sm:text-4xl">
            {guide.title}
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)] sm:text-base">
            Educational research for Florida homeowners. Not legal advice, not a ranking, and not a
            substitute for the official board.
          </p>
          <p className="mt-2 text-xs text-[var(--muted)]">
            Updated {guide.updatedAt}
          </p>

          <div className="prose-guide mt-8 space-y-8 text-[15px] leading-relaxed text-[var(--muted)] sm:text-base">
            {children}
          </div>
        </article>

        <aside className="space-y-4 lg:sticky lg:top-28">
          <div className="rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent-soft)] p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--navy)]">
              Next step
            </p>
            <p className="mt-1.5 text-sm font-semibold text-[var(--text)]">
              Check a name or license
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
              Free Trust Report from official Florida extracts. No lead form.
            </p>
            <Link
              href="/verify"
              className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--navy)] no-underline"
            >
              Open Verify
            </Link>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              Related guides
            </p>
            <ul className="mt-2 space-y-2">
              {related.map((g) => (
                <li key={g.slug}>
                  <Link
                    href={g.path}
                    className="text-sm font-medium text-[var(--navy)] no-underline hover:underline"
                  >
                    {g.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              Product tools
            </p>
            <ul className="mt-2 space-y-1.5 text-sm">
              <li>
                <Link href="/plan" className="text-[var(--navy)] hover:underline">
                  Plan a project
                </Link>
              </li>
              <li>
                <Link href="/florida" className="text-[var(--navy)] hover:underline">
                  Browse Florida
                </Link>
              </li>
              <li>
                <Link href="/methodology" className="text-[var(--navy)] hover:underline">
                  Methodology
                </Link>
              </li>
              <li>
                <Link href="/independence" className="text-[var(--navy)] hover:underline">
                  Independence
                </Link>
              </li>
            </ul>
          </div>
        </aside>
      </div>

      <div className="mt-12">
        <LegalNotice />
      </div>
    </main>
  );
}

export function GuideH2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-semibold tracking-tight text-[var(--text)]">{children}</h2>;
}

export function GuideH3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-base font-semibold tracking-tight text-[var(--text)]">{children}</h3>
  );
}

export function GuideCtaRow({
  items,
}: {
  items: Array<{ href: string; label: string; primary?: boolean }>;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      {items.map((item) => (
        <Link
          key={item.href + item.label}
          href={item.href}
          className={
            item.primary
              ? "inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--navy)] no-underline"
              : "inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium text-[var(--navy)] no-underline hover:bg-[var(--bg)]"
          }
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
