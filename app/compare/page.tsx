import type { Metadata } from "next";
import Link from "next/link";
import { ComparePageClient } from "@/components/compare/ComparePageClient";
import { LegalNotice } from "@/components/trust/LegalNotice";
import { getContractorBySlug } from "@/lib/contractors/queries";
import { buildCompareFields, MAX_COMPARE } from "@/lib/contractors/compare";
import { hasRelatedEntitySignal } from "@/lib/contractors/entity-signals";
import type { ContractorDetail } from "@/lib/contractors/types";
import { pageMetadata } from "@/lib/seo/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "Compare contractors (evidence shortlist)",
  description:
    "Side-by-side public-record comparison from your shortlist (max 3). License status, entity links when available, discipline signals. Not rankings or paid placement.",
  path: "/compare",
  noIndex: true,
});

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

  // Highlight rows where values differ
  const differingIds = new Set(
    fields
      .filter((f) => {
        const uniq = new Set(f.values.map((v) => v.trim().toLowerCase()));
        return uniq.size > 1;
      })
      .map((f) => f.id)
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
        Evidence shortlist
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)]">
        Compare contractors
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">
        Side-by-side public-record signals from contractors you saved on this device — not a
        ranking, score, marketplace, or recommendation to hire. Always confirm details on the
        official board for each state.
      </p>

      {slugs.length === 0 && (
        <div className="mt-10 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--panel)]/50 px-5 py-10 text-center">
          <p className="text-base font-medium text-[var(--text)]">No shortlist yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">
            From search, discovery, or a Trust Report, tap{" "}
            <strong className="text-[var(--text)]">Save</strong> on up to {MAX_COMPARE} contractors.
            Your shortlist stays on this device, then open Compare for evidence side-by-side — not a
            winner score.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/verify"
              className="inline-flex min-h-11 items-center rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--navy)] no-underline"
            >
              Go to search
            </Link>
            <Link
              href="/florida"
              className="inline-flex min-h-11 items-center rounded-xl border border-[var(--border)] px-5 text-sm font-medium text-[var(--text)] no-underline"
            >
              Browse Florida
            </Link>
          </div>
        </div>
      )}

      {slugs.length === 1 && contractors.length === 1 && (
        <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Save at least one more contractor to compare (up to {MAX_COMPARE}). Shortlist is stored on
          this device only.
        </div>
      )}

      {missing.length > 0 && (
        <p className="mt-6 text-sm text-[var(--muted)]">Could not load: {missing.join(", ")}</p>
      )}

      {contractors.length >= 1 && (
        <>
          <ComparePageClient slugs={contractors.map((c) => c.slug)} />

          {/* Header cards + actions */}
          <div
            className={`mt-8 grid gap-3 ${
              contractors.length === 1
                ? "sm:grid-cols-1"
                : contractors.length === 2
                  ? "sm:grid-cols-2"
                  : contractors.length === 3
                    ? "sm:grid-cols-3"
                    : "sm:grid-cols-2 lg:grid-cols-4"
            }`}
          >
            {contractors.map((c) => {
              const lic = c.licenses[0];
              const toolsQs = new URLSearchParams({
                name: c.displayName,
                contractor: c.slug,
              }).toString();
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
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Discipline:{" "}
                    {c.discipline.length
                      ? `${c.discipline.length} record(s)`
                      : "none in extracts"}
                    {hasRelatedEntitySignal(c) ? " · related-entity signal" : ""}
                  </p>
                  <div className="mt-3 flex flex-col gap-1.5">
                    <Link
                      href={`/contractors/${encodeURIComponent(c.slug)}`}
                      className="text-sm font-semibold text-[var(--accent)] no-underline"
                    >
                      Open Trust Report
                    </Link>
                    <Link
                      href={`/tools/quote-analyzer?${toolsQs}`}
                      className="text-xs font-medium text-[var(--navy)] no-underline"
                    >
                      Analyze a quote
                    </Link>
                    <Link
                      href={`/tools/pre-hire-checklist?${toolsQs}`}
                      className="text-xs font-medium text-[var(--navy)] no-underline"
                    >
                      Pre-hire checklist
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile stacked differences */}
          {contractors.length >= 2 && (
            <div className="mt-8 space-y-4 lg:hidden">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
                Key differences (mobile)
              </h2>
              {fields
                .filter((f) => differingIds.has(f.id))
                .slice(0, 8)
                .map((field) => (
                  <div
                    key={field.id}
                    className="rounded-2xl border border-amber-200/70 bg-amber-50/50 p-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wider text-amber-900/80">
                      {field.label}
                    </p>
                    <ul className="mt-2 space-y-2 text-sm">
                      {contractors.map((c, i) => (
                        <li key={c.id}>
                          <span className="font-medium text-[var(--text)]">{c.displayName}: </span>
                          <span className="text-[var(--muted)]">{field.values[i]}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          )}

          {/* Desktop comparison table */}
          {contractors.length >= 2 && (
            <div className="mt-8 hidden overflow-x-auto rounded-2xl border border-[var(--border)] lg:block">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
                    <th className="sticky left-0 z-10 bg-[var(--bg-elevated)] px-4 py-3 font-semibold text-[var(--muted)]">
                      Signal
                    </th>
                    {contractors.map((c) => (
                      <th key={c.id} className="px-4 py-3 font-semibold text-[var(--text)]">
                        {c.displayName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field) => {
                    const differs = differingIds.has(field.id);
                    return (
                      <tr
                        key={field.id}
                        className={`border-b border-[var(--border)]/80 ${
                          differs ? "bg-amber-50/40" : ""
                        }`}
                      >
                        <th className="sticky left-0 z-10 bg-[var(--bg)] px-4 py-3 align-top font-medium text-[var(--muted)]">
                          {field.label}
                          {differs ? (
                            <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                              Differs
                            </span>
                          ) : null}
                        </th>
                        {field.values.map((val, i) => {
                          const tone = field.tones?.[i] || "neutral";
                          const color =
                            tone === "good"
                              ? "text-emerald-800"
                              : tone === "warn"
                                ? "text-amber-900"
                                : tone === "bad"
                                  ? "text-rose-800"
                                  : "text-[var(--text)]";
                          return (
                            <td key={`${field.id}-${i}`} className={`px-4 py-3 align-top ${color}`}>
                              {val}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-8 rounded-2xl border border-[var(--border)] bg-white p-5">
            <h2 className="text-sm font-semibold text-[var(--text)]">Shared next steps</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              No winner label — prepare the same questions and scope for each candidate.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/tools/scope-builder"
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--navy)] no-underline"
              >
                Build shared scope
              </Link>
              <Link
                href="/tools/compare-bids"
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--navy)] no-underline"
              >
                Compare estimate bids
              </Link>
              <Link
                href="/tools/pre-hire-checklist"
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--navy)] no-underline"
              >
                Pre-hire checklist
              </Link>
            </div>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-[var(--muted)]">
            Years licensed are estimated from the original licensure date in the board extract when
            present. Discipline and entity links follow our published methodology — absence of
            discipline in our extract is not a warranty of clean history. Insurance is never marked
            “covered” on this page.
          </p>
        </>
      )}

      <div className="mt-10">
        <LegalNotice />
      </div>
    </main>
  );
}
