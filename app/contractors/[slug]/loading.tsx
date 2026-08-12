export default function ContractorLoading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="h-4 w-28 animate-pulse rounded bg-[var(--border)]" />
      <div className="mt-6 h-9 w-80 max-w-full animate-pulse rounded-lg bg-[var(--border)]" />
      <div className="mt-4 flex gap-2">
        <div className="h-6 w-24 animate-pulse rounded-full bg-[var(--border)]" />
        <div className="h-6 w-28 animate-pulse rounded-full bg-[var(--border)]" />
      </div>
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="h-56 animate-pulse rounded-2xl bg-[var(--panel)]" />
        <div className="space-y-4">
          <div className="h-40 animate-pulse rounded-2xl bg-[var(--panel)]" />
          <div className="h-40 animate-pulse rounded-2xl bg-[var(--panel)]" />
        </div>
      </div>
      <p className="mt-8 text-center text-sm text-[var(--muted)]">Loading contractor profile…</p>
    </main>
  );
}
