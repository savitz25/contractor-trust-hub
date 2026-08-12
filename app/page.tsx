import type { Metadata } from "next";
import Link from "next/link";
import { SearchForm } from "@/components/search/SearchForm";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: {
    title: "Contractor Trust Hub — Before you hire, verify",
    description:
      "Independent Florida contractor verification using official DBPR licenses, Sunbiz entities, and board discipline.",
    url: "/",
    type: "website",
  },
};

const intents = [
  {
    id: "have" as const,
    title: "I already have a contractor",
    body: "Look up their license number or business name. Confirm status, linked Sunbiz entity, and any discipline in our extracts before you sign.",
    anchor: "#search",
    hint: "Best with a license id (CBC, CGC, CCC…) or the exact company name on the contract.",
  },
  {
    id: "research" as const,
    title: "I need to research contractors",
    body: "Search by company name to open Trust Reports. Compare license class, location, and entity evidence — we don’t sell leads or rank paid listings.",
    anchor: "#search",
    hint: "Start with a distinctive name; use fewer words if you get no results.",
  },
];

const pillars = [
  {
    title: "Official sources only",
    body: "Florida DBPR construction licenses, Sunbiz business entities, and board discipline extracts — not paid directories or user reviews.",
  },
  {
    title: "High-confidence entity links",
    body: "We connect licenses to Sunbiz only when names and locations match strictly. Name search is forgiving; entity linking is not.",
  },
  {
    title: "Transparent research",
    body: "Every Trust Report shows what we checked, what matched, and when our data was last verified.",
  },
];

const stats = [
  { label: "Florida contractors", value: "270k+" },
  { label: "Board licenses", value: "143k+" },
  { label: "Sunbiz links", value: "154k+" },
  { label: "Discipline rows", value: "1.5k+" },
];

export default function HomePage() {
  return (
    <main>
      {/* Hero — search is the primary action */}
      <section className="relative border-b border-[var(--border)]">
        <div className="mx-auto max-w-6xl px-4 pb-14 pt-10 sm:px-6 sm:pb-16 sm:pt-14">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
            Before you hire, verify
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-[var(--text)] sm:text-5xl sm:leading-[1.1]">
            Check a Florida contractor against official public records.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--muted)] sm:text-lg">
            Independent research tool — not a marketplace. Look up license status, linked
            business entities, and discipline from Florida DBPR and Sunbiz.
          </p>

          <div
            id="search"
            className="mt-8 scroll-mt-28 rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 shadow-[0_0_0_1px_rgba(245,197,24,0.06)] sm:mt-10 sm:p-6 md:p-8"
          >
            <p className="text-sm font-medium text-[var(--text)]">
              Search by license number or company name
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Florida construction licenses only. Free to search — no account, no lead form.
            </p>
            <div className="mt-4 sm:mt-5">
              <SearchForm size="hero" autoFocus />
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2">
              <p className="text-xs text-[var(--muted)]">Try:</p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/verify?q=CBC015082"
                  className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1 text-xs text-[var(--accent)] no-underline hover:border-[var(--accent)]/40"
                >
                  CBC015082
                </Link>
                <Link
                  href="/verify?q=Worsham%20Construction"
                  className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1 text-xs text-[var(--text)] no-underline hover:border-[var(--accent)]/40"
                >
                  Worsham Construction
                </Link>
                <Link
                  href="/verify?q=ABC%20Roofing"
                  className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1 text-xs text-[var(--text)] no-underline hover:border-[var(--accent)]/40"
                >
                  ABC Roofing
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Consumer intents — both route to search, not lead gen */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14" aria-labelledby="intents-heading">
        <h2
          id="intents-heading"
          className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]"
        >
          How people use this
        </h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {intents.map((intent) => (
            <div
              key={intent.id}
              className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 sm:p-6"
            >
              <h3 className="text-lg font-semibold text-[var(--text)]">{intent.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--muted)]">
                {intent.body}
              </p>
              <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">{intent.hint}</p>
              <a
                href={intent.anchor}
                className="mt-5 inline-flex w-fit items-center rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm font-medium text-[var(--text)] no-underline hover:border-[var(--accent)]/40"
              >
                {intent.id === "have" ? "Search their license or name" : "Search by company name"}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-[var(--border)] bg-[var(--bg-elevated)]/50">
        <div className="mx-auto grid max-w-6xl gap-3 px-4 py-8 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-4"
            >
              <p className="text-2xl font-semibold tabular-nums text-[var(--text)]">{s.value}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-b border-[var(--border)]">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 sm:grid-cols-3 sm:px-6">
          {pillars.map((p) => (
            <div key={p.title}>
              <h2 className="text-base font-semibold text-[var(--text)]">{p.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-8">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">Browse Florida by place or trade</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--muted)]">
              Explore counties and license types, then open Trust Reports — same evidence signals as
              search, structured for discovery.
            </p>
          </div>
          <Link
            href="/florida"
            className="mt-4 inline-flex shrink-0 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-5 py-2.5 text-sm font-medium text-[var(--text)] no-underline hover:border-[var(--accent)]/40 sm:mt-0"
          >
            Open Florida discovery →
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-[var(--text)]">What a Trust Report shows</h2>
          <ol className="mt-5 space-y-4 text-sm leading-relaxed text-[var(--muted)]">
            <li>
              <span className="font-medium text-[var(--text)]">1. License evidence</span> —
              Florida DBPR status, occupation class, and dates from the public extract.
            </li>
            <li>
              <span className="font-medium text-[var(--text)]">2. Entity link</span> — high-confidence
              Sunbiz match only (exact name + geo). We do not invent corporate links.
            </li>
            <li>
              <span className="font-medium text-[var(--text)]">3. Discipline scan</span> — board
              actions linked in our extracts, with source attribution.
            </li>
          </ol>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="#search"
              className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--navy)] no-underline hover:brightness-105"
            >
              Back to search
            </a>
            <Link
              href="/methodology"
              className="rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--text)] no-underline hover:bg-[var(--bg-elevated)]"
            >
              Read methodology
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
