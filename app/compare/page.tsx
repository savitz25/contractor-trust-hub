import type { Metadata } from "next";
import Link from "next/link";
import { ComparePageClient } from "@/components/compare/ComparePageClient";
import { LegalNotice } from "@/components/trust/LegalNotice";
import { getContractorBySlug } from "@/lib/contractors/queries";
import { buildCompareFields, MAX_COMPARE } from "@/lib/contractors/compare";
import type { ContractorDetail } from "@/lib/contractors/types";

export const metadata: Metadata = {
  title: "Compare Florida contractors",
  description:
    "Side-by-side evidence comparison: license status, Sunbiz entity, discipline, and location. Not rankings.",
  alternates: { canonical: "/compare" },
  robots: { index: false, follow: true },
};

type Props = {
  searchParams: Promise<{ slugs?: string }>;
};

function parseSlugs(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => decodeURIComponent(s.trim()))
    .filter(Boolean)
    .slice(0, MAX_COMPARE);
}

export default async function ComparePage({ searchParams }: Props) {
  const sp = await searchParams;
  const slugs = parseSlugs(sp.slugs);

  const contractors: ContractorDetail[] = [];
  const missing: string[] = [];

  for (const slug of slugs) {
    try {
      const c = await getContractorBySlug(slug, "fl");
      if (c) contractors.push(c);
      else missing.push(slug);
    } catch {
      missing.push(slug);
    }
  }

  const fields = buildCompareFields(contractors);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
        Evidence comparison
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)]">
        Compare contractors
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">
        Side-by-side public-record signals — not a ranking, score, or recommendation to hire.
        Always confirm details on the official Florida DBPR board before you decide.
      </p>

      {slugs.length === 0 && (
        <div className="mt-10 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--panel)]/50 px-5 py-10 text-center">
          <p className="text-base font-medium text-[var(--text)]">No contractors selected</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">
            From search or a Trust Report, tap <strong className="text-[var(--text)]">Compare</strong>{" "}
            on 2–3 contractors, then open the compare bar.
          </p>
          <Link
            href="/verify"
            className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--navy)] no-underline"
          >
            Go to search
          </Link>
        </div>
      )}

      {slugs.length === 1 && contractors.length === 1 && (
        <div className="mt-8 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Add at least one more contractor to compare. You can keep searching with this one in your
          compare list.
        </div>
      )}

      {missing.length > 0 && (
        <p className="mt-6 text-sm text-[var(--muted)]">
          Could not load: {missing.join(", ")}
        </p>
      )}

      {contractors.length >= 1 && (
        <>
          <ComparePageClient slugs={contractors.map((c) => c.slug)} />

          {/* Header cards */}
          <div
            className={`mt-8 grid gap-3 ${
              contractors.length === 1
                ? "sm:grid-cols-1"
                : contractors.length === 2
                  ? "sm:grid-cols-2"
                  : "sm:grid-cols-3"
            }`}
          >
            {contractors.map((c) => {
              const lic = c.licenses[0];
              return (
                <div
                  key={c.id}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4"
                >
                  <h2 className="text-base font-semibold leading-snug text-[var(--text)]">
                    {c.displayName}
                  </h2>
                  {lic && (
                    <p className="mt-1 font-mono text-sm text-[var(--accent)]">{lic.externalKey}</p>
                  )}
                  <Link
                    href={`/contractors/${encodeURIComponent(c.slug)}`}
                    className="mt-3 inline-flex text-sm text-[var(--accent)]"
                  >
                    Open Trust Report →
                  </Link>
                </div>
              );
            })}
          </div>

          {/* Comparison table */}
          {contractors.length >= 2 && (
            <div className="mt-8 overflow-x-auto rounded-2xl border border-[var(--border)]">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
                    <th className="sticky left-0 z-10 bg-[var(--bg-elevated)] px-4 py-3 font-semibold text-[var(--muted)]">
                      Signal
                    </th>
                    {contractors.map((c) => (
                      <th
                        key={c.id}
                        className="px-4 py-3 font-semibold text-[var(--text)]"
                      >
                        {c.displayName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field) => (
                    <tr key={field.id} className="border-b border-[var(--border)]/80">
                      <th className="sticky left-0 z-10 bg-[var(--bg)] px-4 py-3 align-top font-medium text-[var(--muted)]">
                        {field.label}
                      </th>
                      {field.values.map((val, i) => {
                        const tone = field.tones?.[i] || "neutral";
                        const color =
                          tone === "good"
                            ? "text-emerald-200"
                            : tone === "warn"
                              ? "text-amber-100"
                              : tone === "bad"
                                ? "text-rose-200"
                                : "text-[var(--text)]";
                        return (
                          <td key={`${field.id}-${i}`} className={`px-4 py-3 align-top ${color}`}>
                            {val}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-4 text-xs leading-relaxed text-[var(--muted)]">
            Years licensed are estimated from the original licensure date in the board extract when
            present. Discipline and entity links follow our published methodology — absence of
            discipline in our extract is not a warranty of clean history.
          </p>
        </>
      )}

      <div className="mt-10">
        <LegalNotice />
      </div>
    </main>
  );
}
