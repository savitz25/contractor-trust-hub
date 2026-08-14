import Link from "next/link";

export function DiscoveryDisclaimer({
  confirmLabel = "the official Florida DBPR board",
  verifyHref = "/verify",
}: {
  confirmLabel?: string;
  verifyHref?: string;
} = {}) {
  return (
    <aside className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-elevated)]/50 px-4 py-4 text-sm leading-relaxed text-[var(--muted)] sm:px-5">
      <p>
        Educational research only. We are not a consumer reporting agency. Always confirm
        current status on {confirmLabel} before hiring.{" "}
        <Link href="/methodology" className="text-[var(--accent)]">
          Methodology
        </Link>
        {" · "}
        <Link href="/independence" className="text-[var(--accent)]">
          Independence
        </Link>
        {" · "}
        <Link href="/disclaimer" className="text-[var(--accent)]">
          Disclaimer
        </Link>
        {" · "}
        <Link href={verifyHref} className="text-[var(--accent)]">
          Search
        </Link>
      </p>
    </aside>
  );
}
