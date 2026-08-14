import Link from "next/link";
import { WA_GEO_NOTE } from "@/lib/washington/geos";
import { WA_LNI_VERIFY_URL } from "@/lib/states/wa-lni";

export function WaCoverageStrip({ compact = false }: { compact?: boolean }) {
  return (
    <aside
      className="rounded-2xl border border-cyan-200/90 bg-cyan-50/80 px-4 py-3.5 text-cyan-950 sm:px-5"
      role="note"
    >
      <p className="text-sm font-semibold">Washington L&I statewide · contractor license extract</p>
      <p className="mt-1 text-xs leading-relaxed text-cyan-950/85 sm:text-sm">
        Active contractor licenses from the official L&I open-data extract (construction,
        electrical, plumbing, elevator). No bond, insurance, or discipline fields in this feed.
        Confirm on the{" "}
        <a
          href={WA_LNI_VERIFY_URL}
          className="font-medium underline underline-offset-2"
          target="_blank"
          rel="noreferrer"
        >
          official L&I verify site
        </a>
        .
      </p>
      {compact ? null : (
        <p className="mt-2 text-[11px] leading-relaxed text-cyan-900/80 sm:text-xs">
          {WA_GEO_NOTE}{" "}
          <Link href="/verify?state=wa" className="font-medium underline underline-offset-2">
            Verify by name or license
          </Link>
          .
        </p>
      )}
    </aside>
  );
}
