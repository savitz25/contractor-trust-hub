import Link from "next/link";
import { MS_SBC_SAMPLE_QUERIES, MS_SBC_SEARCH_URL } from "@/lib/states/ms-sbc";

/** Homepage VERIFY-only tile — no map / plan / studios. */
export function MississippiVerifyTeaser() {
  return (
    <section className="mt-8 rounded-3xl border border-sky-200/80 bg-sky-50/40 p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full border border-sky-300/80 bg-white px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-800">
          Verify
        </span>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-800">
          Mississippi · State Board of Contractors
        </p>
      </div>
      <h3 className="mt-2 text-lg font-semibold text-[var(--text)]">
        Verify a Mississippi contractor
      </h3>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
        <span className="font-medium text-[var(--text)]">Scope:</span> Commercial · Residential ·
        specialty suffixes (MC / SC) when on the official number.
      </p>
      <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
        <span className="font-medium text-[var(--text)]">Integrity:</span> official MSBOC list
        extract · confirm on official lookup. No bond, insurance, or discipline invented.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {MS_SBC_SAMPLE_QUERIES.map((s) => (
          <Link
            key={s.q}
            href={`/verify?state=ms&q=${encodeURIComponent(s.q)}`}
            className="inline-flex min-h-9 items-center rounded-full border border-sky-200 bg-white px-3 text-xs font-medium text-sky-950 no-underline"
          >
            {s.label}
          </Link>
        ))}
      </div>
      <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
        <Link href="/verify?state=ms" className="text-sm font-semibold text-[var(--navy)]">
          Open Mississippi Verify →
        </Link>
        <a
          href={MS_SBC_SEARCH_URL}
          className="text-sm font-medium text-[var(--muted)] underline-offset-2 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          Official MSBOC lookup
        </a>
      </p>
    </section>
  );
}
