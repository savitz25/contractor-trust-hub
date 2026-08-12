import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { occupationLabel } from "@/lib/states/config";
import type { SearchResult } from "@/lib/contractors/types";

export function ResultCard({ result }: { result: SearchResult }) {
  const location = [result.city, result.county, result.state].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/contractors/${encodeURIComponent(result.slug)}`}
      className="block rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 no-underline transition hover:border-[var(--accent)]/40 hover:bg-[var(--bg-elevated)] sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[var(--text)] sm:text-lg">
            {result.displayName}
          </h2>
          {result.primaryLicenseKey && (
            <p className="mt-1 font-mono text-sm text-[var(--accent)]">
              {result.primaryLicenseKey}
            </p>
          )}
          {location && <p className="mt-1 text-sm text-[var(--muted)]">{location}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={result.licenseStatus} />
          {result.entityStatus && (
            <StatusBadge
              status={result.entityStatus}
              label={`Entity: ${result.entityStatus}`}
            />
          )}
          {result.hasDiscipline && (
            <StatusBadge status="warn" label="Discipline on file" />
          )}
        </div>
      </div>
      <p className="mt-3 text-sm text-[var(--muted)]">
        {occupationLabel(result.occupationCode)}
        {result.entityName ? ` · Linked entity: ${result.entityName}` : ""}
      </p>
    </Link>
  );
}
