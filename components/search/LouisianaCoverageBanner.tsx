import Link from "next/link";
import { LA_LSLBC_SEARCH_URL } from "@/lib/states/la-lslbc";

type Props = {
  compact?: boolean;
  showFloridaLink?: boolean;
};

export function LouisianaCoverageBanner({ compact = false, showFloridaLink = true }: Props) {
  if (compact) {
    return (
      <div
        className="rounded-xl border border-indigo-200/90 bg-indigo-50/90 px-3 py-2.5 text-indigo-950 sm:px-3.5"
        role="note"
      >
        <p className="text-xs font-semibold leading-snug sm:text-[13px]">
          Louisiana LSLBC statewide contractor licenses
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-indigo-900/85 sm:text-xs">
          Official public Request Roster (Active). Commercial, residential, home improvement, and
          mold types as published. Confirm current status on the official LSLBC lookup.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-indigo-200/90 bg-gradient-to-b from-indigo-50 to-indigo-50/70 px-3.5 py-3.5 text-indigo-950 sm:px-5 sm:py-4"
      role="note"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        <span
          className="inline-flex w-fit shrink-0 items-center rounded-full border border-indigo-300/80 bg-white/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-800 sm:mt-0.5"
          aria-hidden
        >
          Coverage
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug sm:text-[15px]">
            Louisiana licenses contractors statewide through LSLBC
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-indigo-950/90 sm:text-sm">
            This search uses the official{" "}
            <strong className="font-semibold">public Request Roster</strong> (Active commercial,
            residential, home improvement, and mold credentials).
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 sm:gap-3">
            <div className="rounded-xl border border-indigo-200/70 bg-white/70 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-800/80">
                Included now
              </p>
              <p className="mt-1 text-xs leading-relaxed text-indigo-950/90 sm:text-[13px]">
                Published type, Active status, parish / city / mailing location, effective and
                expiration dates
              </p>
            </div>
            <div className="rounded-xl border border-indigo-200/70 bg-white/70 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-800/80">
                Confirm separately
              </p>
              <p className="mt-1 text-xs leading-relaxed text-indigo-950/90 sm:text-[13px]">
                Live status and trade classifications on official LSLBC lookup. This export does not
                publish bond, insurance, discipline, or qualifying parties.
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-indigo-900/75">
            <a
              href={LA_LSLBC_SEARCH_URL}
              className="font-medium text-indigo-950 underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              Official LSLBC contractor lookup
            </a>
            {showFloridaLink ? (
              <>
                {" · "}
                <Link href="/verify" className="font-medium text-indigo-950 underline underline-offset-2">
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
