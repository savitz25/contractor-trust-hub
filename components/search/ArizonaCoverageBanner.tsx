import Link from "next/link";
import {
  AZ_PILOT_COVERED,
  AZ_PILOT_NOT_COVERED,
  AZ_ROC_SEARCH_URL,
} from "@/lib/states/az-roc";

type Props = {
  compact?: boolean;
  showFloridaLink?: boolean;
};

/**
 * Honest Arizona Verify banner —
 * statewide ROC licensing from official current-contractor posting lists.
 */
export function ArizonaCoverageBanner({
  compact = false,
  showFloridaLink = true,
}: Props) {
  if (compact) {
    return (
      <div
        className="rounded-xl border border-sky-200/90 bg-sky-50/90 px-3 py-2.5 text-sky-950 sm:px-3.5"
        role="note"
      >
        <p className="text-xs font-semibold leading-snug sm:text-[13px]">
          Arizona ROC statewide contractor licenses
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-sky-900/85 sm:text-xs">
          Official current active posting list. Always confirm live status on the ROC contractor
          search. Missing ≠ unlicensed.
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
          className="inline-flex w-fit shrink-0 items-center rounded-full border border-sky-300/80 bg-white/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-900 sm:mt-0.5"
          aria-hidden
        >
          Coverage
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug sm:text-[15px]">
            Arizona licenses contractors statewide through the ROC
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-sky-950/90 sm:text-sm">
            This search uses the official{" "}
            <strong className="font-semibold">current active contractor posting list</strong> from
            the Arizona Registrar of Contractors — residential, commercial, and dual licenses. It is
            not a full historical archive. Always confirm live status on{" "}
            <a
              href={AZ_ROC_SEARCH_URL}
              className="font-semibold underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              ROC contractor search
            </a>
            .
          </p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 sm:gap-3">
            <div className="rounded-xl border border-sky-200/70 bg-white/70 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-900/80">
                Included now
              </p>
              <p className="mt-1 text-xs leading-relaxed text-sky-950/90 sm:text-[13px]">
                {AZ_PILOT_COVERED.join(" · ")}
              </p>
            </div>
            <div className="rounded-xl border border-sky-200/70 bg-white/70 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-900/80">
                Not fully covered yet
              </p>
              <p className="mt-1 text-xs leading-relaxed text-sky-950/90 sm:text-[13px]">
                {AZ_PILOT_NOT_COVERED.join(" · ")}
              </p>
            </div>
          </div>

          {showFloridaLink ? (
            <p className="mt-3 text-xs leading-relaxed text-sky-900/75">
              Need the full homeowner journey?{" "}
              <Link
                href="/verify"
                className="font-semibold text-sky-950 underline-offset-2 hover:underline"
              >
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
