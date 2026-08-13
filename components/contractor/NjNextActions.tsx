import Link from "next/link";
import { CompareToggle } from "@/components/compare/CompareToggle";
import { WatchButton } from "@/components/projects/WatchButton";

/**
 * NJ-safe next actions — generic decision tools only.
 * Does not push Florida plan/passport/lien assumptions.
 */
export function NjNextActions({
  slug,
  name,
  licenseKey,
  licenseStatus,
  entityStatus,
  disciplineCount,
}: {
  slug: string;
  name: string;
  licenseKey?: string | null;
  licenseStatus?: string | null;
  entityStatus?: string | null;
  disciplineCount?: number;
}) {
  const q = new URLSearchParams();
  q.set("name", name);
  q.set("contractor", slug);
  q.set("state", "nj");
  const toolsQs = q.toString();

  return (
    <section
      id="next-actions"
      className="scroll-mt-28 rounded-3xl border border-violet-200/60 bg-violet-50/40 p-5 sm:p-6"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-800">
        Next actions · NJ pilot
      </p>
      <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">
        Prepare questions — evidence, then tools
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Generic decision tools below. Florida-only plan, studios, permit history, and payment legal
        panels are not assumed for New Jersey.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Link
          href={`/tools/scope-builder?${toolsQs}`}
          className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--navy)] no-underline shadow-[var(--shadow-sm)]"
        >
          Scope Builder
        </Link>
        <Link
          href={`/tools/quote-analyzer?${toolsQs}`}
          className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--navy)] no-underline shadow-[var(--shadow-sm)]"
        >
          Analyze a quote
        </Link>
        <Link
          href={`/tools/compare-bids?${toolsQs}`}
          className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--navy)] no-underline shadow-[var(--shadow-sm)]"
        >
          Compare bids
        </Link>
        <Link
          href={`/tools/pre-hire-checklist?state=nj&${toolsQs}`}
          className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--navy)] no-underline shadow-[var(--shadow-sm)]"
        >
          Pre-hire checklist (NJ-safe)
        </Link>
        <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 shadow-[var(--shadow-sm)]">
          <CompareToggle slug={slug} />
          <span className="text-xs text-[var(--muted)]">Side-by-side compare</span>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 shadow-[var(--shadow-sm)]">
          <WatchButton
            slug={slug}
            name={name}
            licenseKey={licenseKey}
            licenseStatus={licenseStatus}
            entityStatus={entityStatus}
            disciplineCount={disciplineCount}
          />
        </div>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-[var(--muted)]">
        Educational tools only — not legal advice. Confirm registration, insurance, and local
        permit requirements on official New Jersey sources before you hire.
      </p>
    </section>
  );
}
