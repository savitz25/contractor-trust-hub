import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6">
      <h1 className="text-2xl font-semibold text-[var(--text)]">Page not found</h1>
      <p className="mt-3 text-[var(--muted)]">
        That URL is not in Contractor Trust Hub. Try Verify search or browse Florida contractors.
      </p>
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/verify"
          className="inline-flex rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--navy)] no-underline"
        >
          Verify a contractor
        </Link>
        <Link
          href="/florida"
          className="inline-flex rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--text)] no-underline"
        >
          Browse Florida
        </Link>
        <Link
          href="/"
          className="inline-flex rounded-xl px-5 py-2.5 text-sm font-medium text-[var(--muted)] no-underline hover:text-[var(--navy)]"
        >
          Home
        </Link>
      </div>
    </main>
  );
}
