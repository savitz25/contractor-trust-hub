"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { WatchButton } from "@/components/projects/WatchButton";

type Props = {
  slug: string;
  name: string;
  licenseKey?: string | null;
  licenseStatus?: string | null;
  entityStatus?: string | null;
  disciplineCount?: number;
  officialHref: string;
  officialLabel: string;
  correctionHref: string;
  /** Sticky bar under summary on mobile */
  sticky?: boolean;
};

/**
 * Primary Trust Report actions: official board, Watch, Share/Print.
 * Correction is available but secondary.
 */
export function TrustReportActions({
  slug,
  name,
  licenseKey,
  licenseStatus,
  entityStatus,
  disciplineCount,
  officialHref,
  officialLabel,
  correctionHref,
  sticky = true,
}: Props) {
  const [shareNote, setShareNote] = useState<string | null>(null);

  const onShare = useCallback(async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const title = `${name} — Contractor Trust Report`;
    const text = `License evidence summary for ${name} on Contractor Trust Hub. Always confirm on the official board.`;

    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title, text, url });
        setShareNote("Shared");
        setTimeout(() => setShareNote(null), 2000);
        return;
      }
    } catch {
      // fall through to clipboard / print
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setShareNote("Link copied");
        setTimeout(() => setShareNote(null), 2500);
        return;
      }
    } catch {
      // ignore
    }

    window.print();
  }, [name]);

  const onPrint = useCallback(() => {
    window.print();
  }, []);

  const body = (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
      <a
        href={officialHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--navy)] px-4 text-sm font-semibold text-white no-underline hover:brightness-110"
      >
        {officialLabel}
      </a>
      <WatchButton
        slug={slug}
        name={name}
        licenseKey={licenseKey}
        licenseStatus={licenseStatus}
        entityStatus={entityStatus}
        disciplineCount={disciplineCount}
      />
      <button
        type="button"
        onClick={onShare}
        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--navy)] hover:border-[var(--navy)]/30"
      >
        Share
        {shareNote ? (
          <span className="ml-1.5 text-[11px] font-medium text-[var(--muted)]">· {shareNote}</span>
        ) : null}
      </button>
      <button
        type="button"
        onClick={onPrint}
        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium text-[var(--text)] hover:border-[var(--navy)]/25"
      >
        Print summary
      </button>
      <Link
        href={correctionHref}
        className="inline-flex min-h-11 items-center justify-center px-2 text-xs font-medium text-[var(--muted)] no-underline hover:text-[var(--text)] hover:underline sm:ml-auto"
      >
        Request a correction
      </Link>
    </div>
  );

  if (!sticky) {
    return (
      <div
        id="report-actions"
        className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-3.5 py-3 sm:px-4 sm:py-3.5 print:hidden"
      >
        {body}
      </div>
    );
  }

  return (
    <>
      <div
        id="report-actions"
        className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-3.5 py-3 sm:px-4 sm:py-3.5 print:hidden"
      >
        {body}
      </div>
      {/* Mobile sticky strip — primary actions without hunting */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-white/95 px-3 py-2.5 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur-md print:hidden sm:hidden">
        <div className="mx-auto flex max-w-6xl gap-2">
          <a
            href={officialHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-[var(--navy)] px-3 text-xs font-semibold text-white no-underline"
          >
            Official board
          </a>
          <div className="shrink-0">
            <WatchButton
              slug={slug}
              name={name}
              licenseKey={licenseKey}
              licenseStatus={licenseStatus}
              entityStatus={entityStatus}
              disciplineCount={disciplineCount}
              compact
            />
          </div>
          <button
            type="button"
            onClick={onShare}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-3 text-xs font-semibold text-[var(--navy)]"
          >
            Share
          </button>
        </div>
      </div>
    </>
  );
}
