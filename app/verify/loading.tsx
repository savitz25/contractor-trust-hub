export default function VerifyLoading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="h-3 w-40 animate-pulse rounded bg-[var(--border)]" />
      <div className="mt-4 h-9 w-72 max-w-full animate-pulse rounded-lg bg-[var(--border)]" />
      <div className="mt-3 h-4 w-full max-w-xl animate-pulse rounded bg-[var(--border)]/70" />
      <div className="mt-8 h-12 max-w-3xl animate-pulse rounded-xl bg-[var(--panel)]" />
      <div className="mt-10 space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--panel)]/60"
          />
        ))}
      </div>
      <p className="mt-6 text-center text-sm text-[var(--muted)]">Searching public records…</p>
    </main>
  );
}
