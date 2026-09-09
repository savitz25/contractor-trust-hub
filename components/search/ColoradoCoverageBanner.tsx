import Link from "next/link";
import { DORA_LOOKUP_URL } from "@/lib/states/co-dora";

type Props = {
  compact?: boolean;
  showFloridaLink?: boolean;
};

export function ColoradoCoverageBanner({ compact = false, showFloridaLink = true }: Props) {
  if (compact) {
    return (
      <div className="rounded-xl border border-sky-200/90 bg-sky-50/90 px-3 py-2.5 text-sky-950 sm:px-3.5" role="note">
        <p className="text-xs font-semibold leading-snug sm:text-[13px]">
          Colorado DORA specialty registrations — not a statewide GC
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-sky-900/85 sm:text-xs">
          Electrical contractor (EC) and plumbing contractor (PC) only. Absence from EC/PC is not an
          unlicensed general contractor. Exact lookup lives on the Colorado research page.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-sky-200/90 bg-gradient-to-b from-sky-50 to-sky-50/70 px-3.5 py-3.5 text-sky-950 sm:px-5 sm:py-4"
      role="note"
    >
      <p className="text-sm font-semibold">Colorado DORA electrical and plumbing contractor registrations</p>
      <p className="mt-2 text-sm leading-relaxed">
        Colorado has no statewide general-contractor license. Research EC/PC credentials on{" "}
        <Link href="/colorado" className="font-medium underline underline-offset-2">
          /colorado
        </Link>
        . Always confirm on{" "}
        <a href={DORA_LOOKUP_URL} className="font-medium underline underline-offset-2" rel="noopener noreferrer" target="_blank">
          DORA license lookup
        </a>
        .
        {showFloridaLink ? (
          <>
            {" "}
            Florida remains the full-journey reference:{" "}
            <Link href="/verify" className="underline underline-offset-2">
              Florida Verify
            </Link>
            .
          </>
        ) : null}
      </p>
    </div>
  );
}
