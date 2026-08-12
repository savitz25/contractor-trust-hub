type Props = {
  message?: string;
  /** search | profile | browse */
  variant?: "search" | "profile" | "browse";
};

export function PageLoading({
  message = "Loading…",
  variant = "search",
}: Props) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10" aria-busy="true" aria-live="polite">
      <div className="h-3 w-28 animate-pulse rounded bg-[var(--border)] sm:w-40" />
      <div className="mt-4 h-8 w-56 max-w-full animate-pulse rounded-lg bg-[var(--border)] sm:h-9 sm:w-80" />
      <div className="mt-3 h-4 w-full max-w-md animate-pulse rounded bg-[var(--border)]/70" />

      {variant === "profile" ? (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            <div className="h-6 w-24 animate-pulse rounded-full bg-[var(--border)]" />
            <div className="h-6 w-28 animate-pulse rounded-full bg-[var(--border)]" />
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-[var(--panel)]" />
            ))}
          </div>
          <div className="mt-5 h-40 animate-pulse rounded-2xl bg-[var(--panel)]" />
        </>
      ) : (
        <>
          <div className="mt-8 h-12 max-w-3xl animate-pulse rounded-xl bg-[var(--panel)]" />
          <div className="mt-8 space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--panel)]/60 sm:h-28"
              />
            ))}
          </div>
        </>
      )}

      <p className="mt-8 text-center text-sm text-[var(--muted)]">{message}</p>
    </main>
  );
}
