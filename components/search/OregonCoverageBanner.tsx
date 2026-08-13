import Link from "next/link";
import { OR_CCB_SEARCH_URL } from "@/lib/states/or-ccb";

type Props = {
  compact?: boolean;
  showFloridaLink?: boolean;
};

export function OregonCoverageBanner({ compact = false, showFloridaLink = true }: Props) {
  if (compact) {
    return (
      <div
        className="rounded-xl border border-emerald-200/90 bg-emerald-50/90 px-3 py-2.5 text-emerald-950 sm:px-3.5"
        role="note"
      >
        <p className="text-xs font-semibold leading-snug sm:text-[13px]">
          Oregon CCB statewide contractor licenses
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-emerald-900/85 sm:text-xs">
          Official Active Licenses extract. Bond and insurance fields are as published — not a live
          certificate check. Confirm on the official CCB search before hiring.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-emerald-200/90 bg-gradient-to-b from-emerald-50 to-emerald-50/70 px-3.5 py-3.5 text-emerald-950 sm:px-5 sm:py-4"
      role="note"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        <span
          className="inline-flex w-fit shrink-0 items-center rounded-full border border-emerald-300/80 bg-white/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-800 sm:mt-0.5"
          aria-hidden
        >
          Coverage
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug sm:text-[15px]">
            Oregon licenses contractors statewide through the CCB
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-emerald-950/90 sm:text-sm">
            This search uses the official <strong className="font-semibold">Active Licenses</strong>{" "}
            open-data extract (residential, commercial, specialty, and related CCB credentials).
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 sm:gap-3">
            <div className="rounded-xl border border-emerald-200/70 bg-white/70 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800/80">
                Included now
              </p>
              <p className="mt-1 text-xs leading-relaxed text-emerald-950/90 sm:text-[13px]">
                CCB license type, status, location, published bond / liability amounts, workers’
                comp Exempt/Nonexempt flag
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200/70 bg-white/70 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800/80">
                Confirm separately
              </p>
              <p className="mt-1 text-xs leading-relaxed text-emerald-950/90 sm:text-[13px]">
                Live status on the official CCB search. Bond/insurance fields are not a live COI.
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-emerald-900/75">
            <a
              href={OR_CCB_SEARCH_URL}
              className="font-medium text-emerald-950 underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              Official CCB license search
            </a>
            {showFloridaLink ? (
              <>
                {" · "}
                <Link href="/verify" className="font-medium text-emerald-950 underline underline-offset-2">
                  Florida Verify
                </Link>
              </>
            ) : null}
          </p>
        </div>
      </div>
    </div>
  );
}
