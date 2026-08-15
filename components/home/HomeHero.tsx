import Link from "next/link";
import {
  getLiveStateCount,
  getLiveVerifyPeerStates,
} from "@/lib/states/config";

/**
 * Homepage hero — clear in under 5 seconds.
 * Two primary paths only; coverage detail lives in StateLandscape.
 */
export function HomeHero() {
  const liveCount = getLiveStateCount();
  const peerCount = getLiveVerifyPeerStates().length;

  return (
    <section className="relative border-b border-[var(--border)]">
      <div className="mx-auto max-w-6xl px-4 pb-8 pt-10 sm:px-6 sm:pb-10 sm:pt-14">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
          Before you hire, verify
        </p>
        <h1 className="mt-3 max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-[var(--text)] sm:text-4xl sm:leading-[1.12] lg:text-5xl">
          Check official license evidence before you hire.
        </h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-[var(--muted)] sm:text-lg">
          Search board records by name or license number
          {liveCount > 1 ? (
            <>
              {" "}
              across{" "}
              <strong className="font-medium text-[var(--text)]">
                {liveCount} live states
              </strong>
              . Florida also has plan and browse tools.
            </>
          ) : (
            <> from official public records.</>
          )}
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:mt-7 sm:flex-row sm:flex-wrap sm:items-center">
          <Link
            href="/#search"
            data-entry-path="verify"
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--accent)] px-6 py-3 text-center text-sm font-semibold text-[var(--navy)] no-underline shadow-[var(--shadow-sm)] hover:brightness-105 sm:min-h-11"
          >
            I have a name or license
            <span className="ml-1.5 text-[11px] font-medium text-[var(--navy)]/70">
              → Verify
            </span>
          </Link>
          <Link
            href="/plan/start"
            data-entry-path="plan"
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--navy)]/20 bg-[var(--navy)] px-6 py-3 text-center text-sm font-semibold text-white no-underline shadow-[var(--shadow-sm)] hover:brightness-110 sm:min-h-11"
          >
            I&apos;m planning a project
            <span className="ml-1.5 text-[11px] font-medium text-white/80">
              → Choose state
            </span>
          </Link>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-[var(--muted)]">
          <Link
            href="/#states"
            className="font-medium text-[var(--navy)] underline-offset-2 hover:underline"
          >
            {peerCount > 0
              ? `${liveCount} states with evidence`
              : "Where we have evidence"}
          </Link>
          <span className="mx-1.5 text-[var(--border)]" aria-hidden>
            ·
          </span>
          <Link
            href="/independence"
            className="underline-offset-2 hover:underline"
          >
            Independent research — not a marketplace
          </Link>
        </p>
      </div>
    </section>
  );
}
