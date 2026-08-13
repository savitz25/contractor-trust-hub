import Link from "next/link";
import { WA_LNI_SEARCH_URL, WA_PILOT_COVERED, WA_PILOT_NOT_COVERED } from "@/lib/states/wa-lni";

type Props = {
  compact?: boolean;
  showFloridaLink?: boolean;
};

export function WashingtonCoverageBanner({
  compact = false,
  showFloridaLink = true,
}: Props) {
  if (compact) {
    return (
      <div
        className="rounded-xl border border-teal-200/90 bg-teal-50/90 px-3 py-2.5 text-teal-950 sm:px-3.5"
        role="note"
      >
        <p className="text-xs font-semibold leading-snug sm:text-[13px]">
          Washington L&amp;I statewide contractor licenses
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-teal-900/85 sm:text-xs">
          Official L&amp;I contractor extract. Always confirm live status on the L&amp;I verify
          site. Missing ≠ unlicensed.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-teal-200/90 bg-gradient-to-b from-teal-50 to-teal-50/70 px-3.5 py-3.5 text-teal-950 sm:px-5 sm:py-4"
      role="note"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        <span
          className="inline-flex w-fit shrink-0 items-center rounded-full border border-teal-300/80 bg-white/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-900 sm:mt-0.5"
          aria-hidden
        >
          Coverage
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug sm:text-[15px]">
            Washington licenses contractors statewide through L&amp;I
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-teal-950/90 sm:text-sm">
            This search uses the official{" "}
            <strong className="font-semibold">L&amp;I contractor extract</strong>. Always confirm
            live status on{" "}
            <a
              href={WA_LNI_SEARCH_URL}
              className="font-semibold underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              L&amp;I Verify
            </a>
            .
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 sm:gap-3">
            <div className="rounded-xl border border-teal-200/70 bg-white/70 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-900/80">
                Included now
              </p>
              <p className="mt-1 text-xs leading-relaxed text-teal-950/90 sm:text-[13px]">
                {WA_PILOT_COVERED.join(" · ")}
              </p>
            </div>
            <div className="rounded-xl border border-teal-200/70 bg-white/70 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-900/80">
                Not fully covered yet
              </p>
              <p className="mt-1 text-xs leading-relaxed text-teal-950/90 sm:text-[13px]">
                {WA_PILOT_NOT_COVERED.join(" · ")}
              </p>
            </div>
          </div>
          {showFloridaLink ? (
            <p className="mt-3 text-xs leading-relaxed text-teal-900/75">
              Need the full homeowner journey?{" "}
              <Link
                href="/verify"
                className="font-semibold text-teal-950 underline-offset-2 hover:underline"
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
