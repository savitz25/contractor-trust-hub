import Link from "next/link";
import { SearchForm } from "@/components/search/SearchForm";

const pillars = [
  {
    title: "Official sources only",
    body: "Florida DBPR construction licenses, Sunbiz business entities, and board discipline extracts — not paid directories or user reviews.",
  },
  {
    title: "High-confidence links",
    body: "We connect licenses to Sunbiz entities only when names and locations match strictly. No fuzzy guessing.",
  },
  {
    title: "Transparent research",
    body: "Every profile shows what we checked, what matched, and when our data was last verified.",
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
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pt-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
          Before you hire, verify
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-[var(--text)] sm:text-5xl">
          Verify a Florida contractor with official license evidence.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
          Contractor Trust Hub is an independent research tool. Look up license status,
          linked business entities, and discipline — sourced from Florida public records,
          not paid placement.
        </p>

        <div className="mt-8 max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 sm:p-5">
          <SearchForm autoFocus />
          <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">
            Try a license like{" "}
            <Link href="/verify?q=CBC015082" className="text-[var(--accent)]">
              CBC015082
            </Link>{" "}
            or a company name. Results use official DBPR extracts; Sunbiz only when
            high-confidence linked.
          </p>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

      <section className="border-y border-[var(--border)] bg-[var(--bg-elevated)]/60">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 sm:grid-cols-3 sm:px-6">
          {pillars.map((p) => (
            <div key={p.title}>
              <h2 className="text-base font-semibold text-[var(--text)]">{p.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-[var(--text)]">How verification works</h2>
          <ol className="mt-5 space-y-4 text-sm leading-relaxed text-[var(--muted)]">
            <li>
              <span className="font-medium text-[var(--text)]">1. License extract</span> —
              Florida DBPR Construction Industry bulk public records (status, type, dates).
            </li>
            <li>
              <span className="font-medium text-[var(--text)]">2. Entity link</span> — high-confidence
              match to Sunbiz corporate filings (status, officers, document number).
            </li>
            <li>
              <span className="font-medium text-[var(--text)]">3. Discipline scan</span> — board
              discipline extracts when linked to the license or contractor.
            </li>
          </ol>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/verify"
              className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--navy)] no-underline hover:brightness-105"
            >
              Start a search
            </Link>
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
