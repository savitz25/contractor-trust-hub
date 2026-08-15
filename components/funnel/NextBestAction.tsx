"use client";

import Link from "next/link";
import { trackFunnel, funnelDataAttrs } from "@/lib/funnel/analytics";
import type { NextActionSpec } from "@/lib/funnel/cta-matrix";

type Props = {
  spec: NextActionSpec;
  /** Optional custom primary click (e.g. open modal) */
  onPrimaryClick?: () => void;
  className?: string;
  compact?: boolean;
};

/**
 * One primary CTA · up to two secondary · continuity link.
 * Stage 8B conversion pattern for Florida surfaces.
 */
export function NextBestAction({
  spec,
  onPrimaryClick,
  className = "",
  compact = false,
}: Props) {
  const onPrimary = () => {
    trackFunnel("next_action_click", {
      surface: spec.surface,
      label: spec.primary.label,
      href: spec.primary.href,
    });
    if (spec.primary.event) {
      trackFunnel(spec.primary.event as "scope_created", { surface: spec.surface });
    }
    onPrimaryClick?.();
  };

  return (
    <section
      id="next-actions"
      className={`scroll-mt-28 rounded-3xl border border-[var(--accent)]/40 bg-[var(--accent-soft)] ${
        compact ? "p-4 sm:p-5" : "p-5 sm:p-6"
      } ${className}`}
      data-funnel-surface={spec.surface}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
        {spec.eyebrow}
      </p>
      <h2 className="mt-1 text-lg font-semibold text-[var(--text)] sm:text-xl">{spec.title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{spec.body}</p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {spec.primary.href.startsWith("#") || onPrimaryClick ? (
          <button
            type="button"
            onClick={onPrimary}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--navy)] px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-sm)]"
            {...funnelDataAttrs("next_action_click", { surface: spec.surface, role: "primary" })}
          >
            {spec.primary.label}
          </button>
        ) : (
          <Link
            href={spec.primary.href}
            onClick={onPrimary}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--navy)] px-5 py-2.5 text-sm font-semibold text-white no-underline shadow-[var(--shadow-sm)]"
            {...funnelDataAttrs("next_action_click", { surface: spec.surface, role: "primary" })}
          >
            {spec.primary.label}
          </Link>
        )}
        {spec.secondary.slice(0, 2).map((s) => (
          <Link
            key={s.href + s.label}
            href={s.href}
            onClick={() =>
              trackFunnel("next_action_click", {
                surface: spec.surface,
                label: s.label,
                role: "secondary",
              })
            }
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--navy)] no-underline"
          >
            {s.label}
          </Link>
        ))}
      </div>

      <p className="mt-3 text-xs text-[var(--muted)]">
        <Link
          href={spec.continuity.href}
          className="font-semibold text-[var(--navy)] no-underline hover:underline"
        >
          {spec.continuity.label}
        </Link>
        <span className="mx-1.5 text-[var(--border)]">·</span>
        Educational tools only — not a marketplace or endorsement.
      </p>
    </section>
  );
}

/** Compact sticky bar for mobile Trust Report / tools */
export function NextBestActionSticky({
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  surface,
}: {
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
  surface: string;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-white/95 p-3 shadow-[0_-6px_24px_rgba(10,37,64,0.1)] backdrop-blur-md sm:hidden">
      <div className="flex gap-2">
        <Link
          href={primaryHref}
          onClick={() =>
            trackFunnel("next_action_click", { surface, label: primaryLabel, sticky: true })
          }
          className="flex-1 rounded-xl bg-[var(--navy)] py-2.5 text-center text-xs font-semibold text-white no-underline"
        >
          {primaryLabel}
        </Link>
        <Link
          href={secondaryHref}
          className="flex-1 rounded-xl border border-[var(--border)] py-2.5 text-center text-xs font-semibold text-[var(--navy)] no-underline"
        >
          {secondaryLabel}
        </Link>
      </div>
    </div>
  );
}
