"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { IntelligenceCounty } from "@/lib/intelligence/payload-types";
import { COVERAGE_LABEL } from "@/lib/intelligence/coverage";
import { formatIntelNumber } from "./format";

export function IntelligenceGeographyExplorer({
  counties,
  timedOut,
  countiesRepresented,
}: {
  counties: IntelligenceCounty[];
  timedOut: boolean;
  countiesRepresented: number | null;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return counties;
    return counties.filter(
      (c) => c.name.toLowerCase().includes(needle) || c.slug.includes(needle)
    );
  }, [counties, q]);

  const top = counties.slice(0, 8);

  return (
    <section id="geography" aria-labelledby="geography-heading" className="scroll-mt-24">
      <h2 id="geography-heading" className="text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
        Florida geographic intelligence
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">
        County counts are <strong className="font-medium text-[var(--text)]">credential mailing / HQ
        base county</strong> from official DBPR county codes. A contractor may perform work in
        other counties. This is not operating activity and is not a permit map.
      </p>
      <p className="mt-2 text-sm text-[var(--muted)]">
        {timedOut
          ? "County credential totals are temporarily unavailable."
          : `${formatIntelNumber(countiesRepresented, false)} Florida counties have at least one credential HQ/base assignment. Statewide credential totals are not a sum of future operating-county counts.`}
      </p>

      <ul className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {top.map((c) => (
          <li key={c.slug}>
            <Link
              href={c.href}
              className="flex min-h-12 flex-col justify-center rounded-xl border border-[var(--border)] bg-white px-3 py-3 no-underline shadow-[var(--shadow-sm)] hover:border-[var(--navy)]/20"
            >
              <span className="text-sm font-medium text-[var(--text)]">{c.name}</span>
              <span className="mt-1 text-xs tabular-nums text-[var(--muted)]">
                {formatIntelNumber(timedOut ? null : c.tracked, timedOut)} credentials ·{" "}
                {COVERAGE_LABEL[c.coverageLevel]}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <label htmlFor="county-filter" className="text-sm font-medium text-[var(--text)]">
          All 67 Florida counties
        </label>
        <input
          id="county-filter"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter counties"
          className="th-field mt-2 w-full max-w-md bg-white px-3 text-[16px] text-[var(--text)]"
        />

        <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--border)]">
          <table className="min-w-full text-left text-sm">
            <caption className="sr-only">
              Florida contractor credentials by home or base county
            </caption>
            <thead className="bg-[var(--bg)] text-xs uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  County
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Credentials (HQ/base)
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Active credentials
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Coverage
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.slug} className="border-t border-[var(--border)]">
                  <th scope="row" className="px-3 py-2 font-medium">
                    <Link href={c.href} className="text-[var(--text)]">
                      {c.name}
                    </Link>
                  </th>
                  <td className="px-3 py-2 tabular-nums">
                    {formatIntelNumber(timedOut ? null : c.tracked, timedOut)}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {formatIntelNumber(timedOut ? null : c.active, timedOut)}
                  </td>
                  <td className="px-3 py-2 text-[var(--muted)]">
                    {COVERAGE_LABEL[c.coverageLevel]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
