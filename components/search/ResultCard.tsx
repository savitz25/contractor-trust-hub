import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { statusLabel } from "@/lib/contractors/format";
import { occupationLabel } from "@/lib/states/config";
import type { SearchResult } from "@/lib/contractors/types";

export function ResultCard({ result }: { result: SearchResult }) {
  const location = [result.city, result.county, result.state].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/contractors/${encodeURIComponent(result.slug)}`}
      className="block rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 no-underline transition hover:border-[var(--accent)]/40 hover:bg-[var(--bg-elevated)] active:scale-[0.995] sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-snug text-[var(--text)] sm:text-lg">
            {result.displayName}
          </h2>
          {result.primaryLicenseKey && (
            <p className="mt-1 font-mono text-sm tracking-wide text-[var(--accent)]">
              {result.primaryLicenseKey}
            </p>
          )}
          {location && <p className="mt-1 text-sm text-[var(--muted)]">{location}</p>}
        </div>
        <div className="flex flex-wrap gap-1.5 sm:max-w-[45%] sm:justify-end">
          <StatusBadge
            status={result.licenseStatus}
            label={`License: ${statusLabel(result.licenseStatus)}`}
          />
          {result.entityStatus ? (
            <StatusBadge
              status={result.entityStatus}
              label={`Entity: ${statusLabel(result.entityStatus)}`}
            />
          ) : null}
          {result.hasDiscipline && (
            <StatusBadge status="warn" label="Discipline on file" />
          )}
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
        {occupationLabel(result.occupationCode)}
        {result.entityName ? ` · Sunbiz: ${result.entityName}` : " · No high-confidence Sunbiz link"}
      </p>
    </Link>
  );
}
