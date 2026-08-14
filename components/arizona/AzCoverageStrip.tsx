import Link from "next/link";
import { AZ_GEO_NOTE } from "@/lib/arizona/geos";
import { AZ_ROC_SEARCH_URL } from "@/lib/states/az-roc";

export function AzCoverageStrip({ compact = false }: { compact?: boolean }) {
  return (
    <aside
      className="rounded-2xl border border-amber-200/90 bg-amber-50/80 px-4 py-3.5 text-amber-950 sm:px-5"
      role="note"
    >
      <p className="text-sm font-semibold">Arizona ROC statewide · current posting list</p>
      <p className="mt-1 text-xs leading-relaxed text-amber-950/85 sm:text-sm">
        Active contractor licenses from the official ROC posting list. Disciplinary rows appear when
        linked from the official time-window extract — not a complete history. No bond or insurance
        fields. Confirm on the{" "}
        <a
          href={AZ_ROC_SEARCH_URL}
          className="font-medium underline underline-offset-2"
          target="_blank"
          rel="noreferrer"
        >
          official ROC search
        </a>
        .
      </p>
      {compact ? null : (
        <p className="mt-2 text-[11px] leading-relaxed text-amber-900/80 sm:text-xs">
          {AZ_GEO_NOTE} City of Maricopa and San Tan Valley are mapped to Pinal County.{" "}
          <Link href="/verify?state=az" className="font-medium underline underline-offset-2">
            Verify by name or license
          </Link>
          .
        </p>
      )}
    </aside>
  );
}
