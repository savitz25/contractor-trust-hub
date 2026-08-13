import Link from "next/link";
import { NJ_PILOT_COVERED, NJ_PILOT_NOT_COVERED } from "@/lib/states/nj-credentials";

type Props = {
  compact?: boolean;
  showFloridaLink?: boolean;
};

/**
 * Honest New Jersey verification banner — no statewide GC; HIC + specialty only.
 */
export function NjCoverageBanner({ compact = false, showFloridaLink = true }: Props) {
  if (compact) {
    return (
      <div
        className="rounded-xl border border-violet-200/90 bg-violet-50/90 px-3 py-2.5 text-violet-950 sm:px-3.5"
        role="note"
      >
        <p className="text-xs font-semibold leading-snug sm:text-[13px]">
          New Jersey — HIC + specialty boards only
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-violet-900/85 sm:text-xs">
          No single statewide general contractor license. Confirm status on the official DCA /
          MyLicense site. Missing from results does not mean unlicensed.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-violet-200/90 bg-gradient-to-b from-violet-50 to-violet-50/70 px-3.5 py-3.5 text-violet-950 sm:px-5 sm:py-4"
      role="note"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        <span
          className="inline-flex w-fit shrink-0 items-center rounded-full border border-violet-300/80 bg-white/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-800 sm:mt-0.5"
          aria-hidden
        >
          Pilot
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug sm:text-[15px]">
            New Jersey verification — no statewide GC license
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-violet-950/90 sm:text-sm">
            New Jersey does <strong className="font-semibold">not</strong> issue a single statewide
            general contractor license. Current coverage prioritizes{" "}
            <strong className="font-semibold">Home Improvement Contractor (HIC)</strong>{" "}
            registrations and available specialty boards from official DCA extracts. Always
            confirm on the official DCA / MyLicense site. Educational research only — not a
            marketplace or endorsement.
          </p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 sm:gap-3">
            <div className="rounded-xl border border-violet-200/70 bg-white/70 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-800/80">
                Included now
              </p>
              <p className="mt-1 text-xs leading-relaxed text-violet-950/90 sm:text-[13px]">
                {NJ_PILOT_COVERED.join(" · ")}
              </p>
            </div>
            <div className="rounded-xl border border-violet-200/70 bg-white/70 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-800/80">
                Not covered
              </p>
              <p className="mt-1 text-xs leading-relaxed text-violet-950/90 sm:text-[13px]">
                {NJ_PILOT_NOT_COVERED.join(" · ")}
              </p>
            </div>
          </div>

          {showFloridaLink ? (
            <p className="mt-3 text-xs leading-relaxed text-violet-900/75">
              Need the full homeowner journey?{" "}
              <Link href="/verify" className="font-semibold text-violet-950 underline-offset-2 hover:underline">
                Florida Verify
              </Link>{" "}
              includes plan, property, projects, and Home Passport.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
