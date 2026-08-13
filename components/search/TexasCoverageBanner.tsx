import Link from "next/link";
import { TX_COVERED_TRADES_PLAIN } from "@/lib/states/tx-trades";

type Props = {
  /** Tighter layout for Trust Report / empty follow-ups */
  compact?: boolean;
  /** Extra bottom link context (empty state already has actions) */
  showFloridaLink?: boolean;
};

/**
 * Calm, persistent honesty banner for Texas Verify —
 * TDLR specialty trades + TSBPE plumbing. Not a statewide GC directory.
 */
export function TexasCoverageBanner({
  compact = false,
  showFloridaLink = true,
}: Props) {
  const trades = TX_COVERED_TRADES_PLAIN.join(" · ");

  if (compact) {
    return (
      <div
        className="rounded-xl border border-sky-200/90 bg-sky-50/90 px-3 py-2.5 text-sky-950 sm:px-3.5"
        role="note"
      >
        <p className="text-xs font-semibold leading-snug sm:text-[13px]">
          Specialty trades + plumbing — not a statewide general contractor directory
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-sky-900/85 sm:text-xs">
          Covers selected TDLR licenses ({trades.toLowerCase().replace(" · plumbing (tsbpe)", "")})
          and TSBPE plumbing. No statewide GC license in Texas. City/county builder registration is
          not fully covered here.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-sky-200/90 bg-gradient-to-b from-sky-50 to-sky-50/70 px-3.5 py-3.5 text-sky-950 sm:px-5 sm:py-4"
      role="note"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        <span
          className="inline-flex w-fit shrink-0 items-center rounded-full border border-sky-300/80 bg-white/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-800 sm:mt-0.5"
          aria-hidden
        >
          Coverage
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug sm:text-[15px]">
            Texas coverage is TDLR specialty trades + TSBPE plumbing
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-sky-950/90 sm:text-sm">
            Texas does <strong className="font-semibold">not</strong> issue a statewide general
            contractor license. This search checks selected TDLR specialty contractor licenses and
            TSBPE plumbing credentials — not every builder in the state.
          </p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 sm:gap-3">
            <div className="rounded-xl border border-sky-200/70 bg-white/70 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-800/80">
                Included now
              </p>
              <p className="mt-1 text-xs leading-relaxed text-sky-950/90 sm:text-[13px]">
                {trades}
              </p>
            </div>
            <div className="rounded-xl border border-sky-200/70 bg-white/70 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-800/80">
                Not fully covered yet
              </p>
              <p className="mt-1 text-xs leading-relaxed text-sky-950/90 sm:text-[13px]">
                Most general builders registered only with a city or county. Confirm local
                requirements.
              </p>
            </div>
          </div>

          {showFloridaLink ? (
            <p className="mt-3 text-xs leading-relaxed text-sky-900/75">
              Looking for Florida DBPR construction licenses?{" "}
              <Link href="/verify" className="font-medium text-sky-950 underline underline-offset-2">
                Open Florida Verify
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
