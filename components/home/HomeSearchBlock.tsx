import Link from "next/link";
import { SearchForm } from "@/components/search/SearchForm";
import { getLiveStateCount } from "@/lib/states/config";

/** Compact verify search for visitors who already know a name or license. */
export function HomeSearchBlock({ embedded = false }: { embedded?: boolean }) {
  const liveCount = getLiveStateCount();
  const heading = embedded ? (
    <p className="text-sm text-[var(--muted)]">
      Choose a state ({liveCount} live), then search. Free — no account, no lead form.{" "}
      <Link href="/#states" className="font-medium text-[var(--navy)] underline-offset-2 hover:underline">
        Coverage by state
      </Link>
    </p>
  ) : (
    <>
      <h2
        id="search-heading"
        className="text-lg font-semibold text-[var(--text)] sm:text-xl"
      >
        Search by license number or company name
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Choose a state ({liveCount} live), then search. Free — no account, no lead form.{" "}
        <Link href="/#states" className="font-medium text-[var(--navy)] underline-offset-2 hover:underline">
          Coverage by state
        </Link>
      </p>
    </>
  );

  const body = (
        <div className="rounded-3xl border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-md)] sm:p-6 md:p-8">
          {heading}
          <div className="mt-4 sm:mt-5">
            <SearchForm size="hero" showStatePicker />
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2">
            <p className="text-xs text-[var(--muted)]">Try:</p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/verify?q=CBC015082"
                className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1 text-xs text-[var(--navy)] no-underline hover:border-[var(--navy)]/40"
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
                href="/verify?state=or&q=259513"
                className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1 text-xs text-[var(--text)] no-underline hover:border-[var(--accent)]/40"
              >
                OR 259513
              </Link>
              <Link
                href="/verify?state=wa&q=COLUMEG793KJ"
                className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1 text-xs text-[var(--text)] no-underline hover:border-[var(--accent)]/40"
              >
                WA COLUMEG793KJ
              </Link>
              <Link
                href="/verify?state=ca&q=815758"
                className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1 text-xs text-[var(--text)] no-underline hover:border-[var(--accent)]/40"
              >
                CA 815758
              </Link>
              <Link
                href="/verify?state=az&q=002386"
                className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1 text-xs text-[var(--text)] no-underline hover:border-[var(--accent)]/40"
              >
                AZ 002386
              </Link>
            </div>
          </div>
        </div>
  );

  if (embedded) {
    return (
      <div id="search" className="scroll-mt-24">
        {body}
      </div>
    );
  }

  return (
    <section
      id="search"
      aria-labelledby="search-heading"
      className="border-b border-[var(--border)]"
    >
      <div className="th-shell py-10 sm:py-12">{body}</div>
    </section>
  );
}
