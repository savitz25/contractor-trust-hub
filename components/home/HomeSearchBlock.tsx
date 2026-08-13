import Link from "next/link";
import { SearchForm } from "@/components/search/SearchForm";

/** Compact verify search for visitors who already know a name or license. */
export function HomeSearchBlock() {
  return (
    <section
      id="search"
      aria-labelledby="search-heading"
      className="border-b border-[var(--border)]"
    >
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="rounded-3xl border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-md)] sm:p-6 md:p-8">
          <h2
            id="search-heading"
            className="text-lg font-semibold text-[var(--text)] sm:text-xl"
          >
            Search by license number or company name
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Pick Florida (full construction licenses), Texas (specialty trades), or New Jersey (HIC +
            specialty boards). Free — no account, no lead form.
          </p>
          <div className="mt-4 sm:mt-5">
            <SearchForm size="hero" showStatePicker />
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2">
            <p className="text-xs text-[var(--muted)]">Try:</p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/verify?q=CBC015082"
                className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1 text-xs text-[var(--accent)] no-underline hover:border-[var(--accent)]/40"
              >
                FL CBC015082
              </Link>
              <Link
                href="/verify?state=tx&q=10001"
                className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1 text-xs text-[var(--text)] no-underline hover:border-[var(--accent)]/40"
              >
                TX 10001
              </Link>
              <Link
                href="/verify?state=nj&q=13VH13621300"
                className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1 text-xs text-[var(--text)] no-underline hover:border-[var(--accent)]/40"
              >
                NJ 13VH13621300
              </Link>
              <Link
                href="/verify?state=nj&q=VISTA%20FENCING"
                className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1 text-xs text-[var(--text)] no-underline hover:border-[var(--accent)]/40"
              >
                NJ Vista Fencing
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
