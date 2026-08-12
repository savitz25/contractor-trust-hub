import Link from "next/link";

/**
 * Required honesty banner for Texas Verify — specialty trades only.
 */
export function TexasCoverageBanner({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`rounded-2xl border border-amber-200 bg-amber-50 text-amber-950 ${
        compact ? "px-3 py-2.5 text-xs" : "px-4 py-3.5 text-sm"
      }`}
      role="note"
    >
      <p className="font-semibold">Texas coverage is specialty trades only</p>
      <ul className={`mt-1.5 list-disc space-y-1 pl-4 leading-relaxed ${compact ? "text-[11px]" : "text-xs sm:text-sm"}`}>
        <li>
          Texas does <strong className="font-semibold">not</strong> issue a statewide general
          contractor license.
        </li>
        <li>
          This search covers selected{" "}
          <strong className="font-semibold">TDLR specialty licenses</strong> (electrical, A/C,
          appliance install, elevator, water well, and related contractor classes).
        </li>
        <li>
          Plumbing is under the Texas State Board of Plumbing Examiners (TSBPE) — not fully covered
          here yet.
        </li>
        <li>
          Many general builders are registered only with a city or county — always confirm local
          requirements.
        </li>
      </ul>
      {!compact ? (
        <p className="mt-2 text-xs text-amber-900/80">
          Florida full construction license verification remains at{" "}
          <Link href="/verify?state=fl" className="font-medium underline">
            /verify?state=fl
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
