import Link from "next/link";
import { MS_SBC_SEARCH_URL } from "@/lib/states/ms-sbc";

type Props = {
  compact?: boolean;
  showFloridaLink?: boolean;
};

export function MississippiCoverageBanner({ compact = false, showFloridaLink = true }: Props) {
  if (compact) {
    return (
      <div
        className="rounded-xl border border-sky-200/90 bg-sky-50/90 px-3 py-2.5 text-sky-950 sm:px-3.5"
        role="note"
      >
        <p className="text-xs font-semibold leading-snug sm:text-[13px]">
          Mississippi State Board of Contractors credentials
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-sky-900/85 sm:text-xs">
          Official MSBOC exported list. Commercial / residential as published. Always confirm on the
          official board lookup. Missing here is not proof someone is unlicensed. No bond,
          insurance, or discipline invented.
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
            Mississippi licenses contractors statewide through the State Board of Contractors
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-sky-950/90 sm:text-sm">
            This search uses the official{" "}
            <strong className="font-semibold">MSBOC exported list</strong> loaded for Verify
            (commercial, residential, and MC / SC when on the number). Always confirm on the official
            board lookup. A miss is not proof someone is unlicensed.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 sm:gap-3">
            <div className="rounded-xl border border-sky-200/70 bg-white/70 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-800/80">
                Included now
              </p>
              <p className="mt-1 text-xs leading-relaxed text-sky-950/90 sm:text-[13px]">
                Published type, status, license class / suffix (MC / SC when on the number), city /
                mailing location
              </p>
            </div>
            <div className="rounded-xl border border-sky-200/70 bg-white/70 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-800/80">
                Confirm separately
              </p>
              <p className="mt-1 text-xs leading-relaxed text-sky-950/90 sm:text-[13px]">
                Live status and classifications on official MSBOC lookup. This list does not
                publish bond, insurance, or discipline.
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-sky-900/75">
            <a
              href={MS_SBC_SEARCH_URL}
              className="font-medium text-sky-950 underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              Official MSBOC contractor lookup
            </a>
            {showFloridaLink ? (
              <>
                {" · "}
                <Link href="/verify" className="font-medium text-sky-950 underline underline-offset-2">
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
