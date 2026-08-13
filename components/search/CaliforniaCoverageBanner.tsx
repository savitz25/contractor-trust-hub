import Link from "next/link";
import {
  CA_PILOT_COVERED,
  CA_PILOT_NOT_COVERED,
} from "@/lib/states/ca-classifications";

type Props = {
  compact?: boolean;
  showFloridaLink?: boolean;
};

/**
 * Honest California Verify banner — CSLB top-county extract, not complete CA dump.
 */
export function CaliforniaCoverageBanner({
  compact = false,
  showFloridaLink = true,
}: Props) {
  if (compact) {
    return (
      <div
        className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-2.5 text-amber-950 sm:px-3.5"
        role="note"
      >
        <p className="text-xs font-semibold leading-snug sm:text-[13px]">
          California CSLB — high-impact counties in this extract
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-amber-900/85 sm:text-xs">
          Official public list downloads for selected counties. Always confirm on CSLB Instant
          License Check. Missing from results does not mean unlicensed.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-amber-200/90 bg-gradient-to-b from-amber-50 to-amber-50/70 px-3.5 py-3.5 text-amber-950 sm:px-5 sm:py-4"
      role="note"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        <span
          className="inline-flex w-fit shrink-0 items-center rounded-full border border-amber-300/80 bg-white/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-900 sm:mt-0.5"
          aria-hidden
        >
          Coverage
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug sm:text-[15px]">
            California CSLB licensing — county extract coverage
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-amber-950/90 sm:text-sm">
            California licenses contractors statewide through the{" "}
            <strong className="font-semibold">CSLB</strong>. This search uses official public list
            downloads for <strong className="font-semibold">high-impact counties</strong> in our
            current extract — not every county file. Always confirm current status on{" "}
            <a
              href="https://www.cslb.ca.gov/OnlineServices/CheckLicenseII/CheckLicense.aspx"
              className="font-semibold underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              CSLB Instant License Check
            </a>
            .
          </p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 sm:gap-3">
            <div className="rounded-xl border border-amber-200/70 bg-white/70 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-900/80">
                Included now
              </p>
              <p className="mt-1 text-xs leading-relaxed text-amber-950/90 sm:text-[13px]">
                {CA_PILOT_COVERED.join(" · ")}
              </p>
            </div>
            <div className="rounded-xl border border-amber-200/70 bg-white/70 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-900/80">
                Not fully covered yet
              </p>
              <p className="mt-1 text-xs leading-relaxed text-amber-950/90 sm:text-[13px]">
                {CA_PILOT_NOT_COVERED.join(" · ")}
              </p>
            </div>
          </div>

          {showFloridaLink ? (
            <p className="mt-3 text-xs leading-relaxed text-amber-900/75">
              Need the full homeowner journey?{" "}
              <Link
                href="/verify"
                className="font-semibold text-amber-950 underline-offset-2 hover:underline"
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
