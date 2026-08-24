"use client";

export default function FloridaDiscoveryError({ reset }: { reset: () => void }) {
  return (
    <main
      className="mx-auto max-w-3xl px-4 py-16 sm:px-6"
      data-discovery-state="temporarily-unavailable"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
        Contractor records temporarily unavailable
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)]">
        We could not load the official records right now.
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--muted)]">
        This is a temporary data-source issue, not a verified zero-result search. Please try
        again shortly.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
      >
        Try again
      </button>
    </main>
  );
}
