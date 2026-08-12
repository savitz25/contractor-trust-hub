import Link from "next/link";

export function DiscoveryDisclaimer() {
  return (
    <aside className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-elevated)]/50 px-5 py-4 text-sm leading-relaxed text-[var(--muted)]">
      <p>
        Educational research only. Lists are ordered for browsing (active licenses first), not
        ranked by quality or paid placement. Always confirm current status on the official Florida
        DBPR board before hiring.{" "}
        <Link href="/methodology" className="text-[var(--accent)]">
          How matching works
        </Link>
        {" · "}
        <Link href="/verify" className="text-[var(--accent)]">
          Search by name or license
        </Link>
      </p>
    </aside>
  );
}
