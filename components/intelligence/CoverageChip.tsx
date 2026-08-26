import { COVERAGE_LABEL, type ResearchCoverageLevel } from "@/lib/intelligence/coverage";

export function CoverageChip({
  level,
  href,
}: {
  level: ResearchCoverageLevel;
  href?: string;
}) {
  const chip = (
    <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
      {COVERAGE_LABEL[level]}
    </span>
  );
  if (!href) return chip;
  return (
    <a href={href} className="inline-flex no-underline">
      {chip}
    </a>
  );
}
