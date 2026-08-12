import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6">
      <h1 className="text-2xl font-semibold text-[var(--text)]">Not found</h1>
      <p className="mt-3 text-[var(--muted)]">
        That contractor profile is not in our Florida evidence set.
      </p>
      <Link
        href="/verify"
        className="mt-8 inline-flex rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--navy)] no-underline"
      >
        Search again
      </Link>
    </main>
  );
}
