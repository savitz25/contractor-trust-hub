import Link from "next/link";
import { formatDateTime } from "@/lib/contractors/format";
import type { ShareSummaryModel } from "@/lib/contractors/share-summary";
import { absoluteUrl } from "@/lib/site";

/**
 * Clean, printable evidence summary — not a ranking, not a marketplace card.
 */
export function TrustReportShareSummary({
  model,
  fullReportAbsolute,
}: {
  model: ShareSummaryModel;
  /** Absolute URL for “link back” when printing offline */
  fullReportAbsolute?: string;
}) {
  const liveHref = model.fullReportPath;
  const liveAbs = fullReportAbsolute || absoluteUrl(liveHref);

  return (
    <article
      className="trust-share-summary mx-auto max-w-2xl rounded-2xl border border-[var(--border)] bg-white px-4 py-6 shadow-sm sm:px-8 sm:py-8 print:max-w-none print:rounded-none print:border-0 print:px-0 print:py-0 print:shadow-none"
      aria-labelledby="share-summary-title"
    >
      <header className="border-b border-[var(--border)] pb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)] print:text-black">
          Contractor Trust Hub
        </p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          {model.stateContextLine}
        </p>
        <h1
          id="share-summary-title"
          className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl"
        >
          {model.displayName}
        </h1>
        {(model.legalName || model.dbaName) && (
          <p className="mt-1.5 text-sm text-[var(--muted)]">
            {model.legalName ? <>Legal / linked: {model.legalName}</> : null}
            {model.legalName && model.dbaName ? " · " : null}
            {model.dbaName ? <>DBA: {model.dbaName}</> : null}
          </p>
        )}
        {model.location ? (
          <p className="mt-1 text-sm text-[var(--muted)]">{model.location}</p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-full border border-[var(--navy)]/20 bg-[var(--navy)]/5 px-3 py-1 text-xs font-semibold text-[var(--navy)] print:border-black print:bg-transparent print:text-black">
            Independent research
          </span>
          <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 py-1 text-xs font-medium text-[var(--muted)] print:border-black">
            Not a recommendation · no paid ranking
          </span>
        </div>
      </header>

      <section className="mt-6" aria-labelledby="share-facts-heading">
        <h2
          id="share-facts-heading"
          className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]"
        >
          Evidence from public extracts
        </h2>
        <dl className="mt-3 divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {model.rows.map((row) => (
            <div
              key={row.id}
              className="grid gap-1 py-3 sm:grid-cols-[11rem_1fr] sm:gap-4 print:break-inside-avoid"
            >
              <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                {row.label}
              </dt>
              <dd className="min-w-0">
                <p className="text-sm font-medium text-[var(--text)] break-words">{row.value}</p>
                {row.detail ? (
                  <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">{row.detail}</p>
                ) : null}
              </dd>
            </div>
          ))}
          <div className="grid gap-1 py-3 sm:grid-cols-[11rem_1fr] sm:gap-4 print:break-inside-avoid">
            <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              Extract freshness
            </dt>
            <dd className="text-sm text-[var(--text)]">
              {model.freshestAt
                ? `Latest field in our data: ${formatDateTime(model.freshestAt)}`
                : "Freshness not available for this profile"}
            </dd>
          </div>
        </dl>
      </section>

      {model.meaning.length > 0 ? (
        <section className="mt-6 print:break-inside-avoid" aria-labelledby="share-means-heading">
          <h2
            id="share-means-heading"
            className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]"
          >
            What this means (plain language)
          </h2>
          <ul className="mt-3 space-y-3">
            {model.meaning.map((p) => (
              <li key={p.id} className="text-sm leading-relaxed">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  {p.label}
                </p>
                <p className="mt-0.5 text-[var(--text)]">{p.text}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg)]/80 px-4 py-4 print:break-inside-avoid print:border-black print:bg-transparent">
        <h2 className="text-sm font-semibold text-[var(--text)]">Confirm before you hire</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">
          This is independent research from public extracts —{" "}
          <strong className="font-semibold text-[var(--text)]">not a recommendation</strong>, score,
          or paid placement. Always{" "}
          <strong className="font-semibold text-[var(--text)]">confirm on the official board</strong>{" "}
          the day you hire.
        </p>
        <p className="mt-3 text-sm">
          <a
            href={model.officialBoardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[var(--navy)] underline print:text-black"
          >
            {model.officialBoardLabel}
          </a>
        </p>
      </section>

      <footer className="mt-6 border-t border-[var(--border)] pt-5">
        <p className="text-sm font-medium text-[var(--text)]">Full live Trust Report</p>
        <p className="mt-1 break-all text-sm text-[var(--accent)] print:text-black">
          <Link href={liveHref} className="underline print:no-underline">
            {liveAbs}
          </Link>
        </p>
        <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">
          Shared from Contractor Trust Hub. Evidence only — no marketplace lead forms, no winner
          ranking. Missing data means unknown, not cleared.
        </p>
      </footer>
    </article>
  );
}
