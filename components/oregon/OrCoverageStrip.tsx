import Link from "next/link";
import { OREGON_GEO_NOTE } from "@/lib/oregon/counties";
import { OR_CCB_SEARCH_URL } from "@/lib/states/or-ccb";

export function OrCoverageStrip({ compact = false }: { compact?: boolean }) {
  return (
    <aside
      className="rounded-2xl border border-emerald-200/90 bg-emerald-50/80 px-4 py-3.5 text-emerald-950 sm:px-5"
      role="note"
    >
      <p className="text-sm font-semibold">Oregon CCB statewide · active licenses</p>
      <p className="mt-1 text-xs leading-relaxed text-emerald-950/85 sm:text-sm">
        Official Active Licenses extract. Bond and liability fields are as published — not a live
        certificate check. Confirm on the{" "}
        <a
          href={OR_CCB_SEARCH_URL}
          className="font-medium underline underline-offset-2"
          target="_blank"
          rel="noreferrer"
        >
          official CCB search
        </a>
        .
      </p>
      {compact ? null : (
        <p className="mt-2 text-[11px] leading-relaxed text-emerald-900/80 sm:text-xs">
          {OREGON_GEO_NOTE}{" "}
          <Link href="/verify?state=or" className="font-medium underline underline-offset-2">
            Verify by name or license
          </Link>
          .
        </p>
      )}
    </aside>
  );
}
