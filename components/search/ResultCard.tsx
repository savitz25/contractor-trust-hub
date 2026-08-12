import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { statusLabel } from "@/lib/contractors/format";
import { occupationLabel } from "@/lib/states/config";
import type { SearchResult } from "@/lib/contractors/types";

function signalTone(
  kind: "license" | "entity" | "discipline",
  result: SearchResult
): "good" | "warn" | "bad" | "neutral" {
  if (kind === "discipline") return result.hasDiscipline ? "warn" : "good";
  if (kind === "entity") {
    if (!result.entityStatus) return "neutral";
    const s = result.entityStatus.toLowerCase();
    if (s === "active" || s === "current") return "good";
    if (s === "inactive" || s === "dissolved") return "bad";
    return "warn";
  }
  const s = (result.licenseStatus || "").toLowerCase();
  if (s === "active" || s === "current") return "good";
  if (s === "inactive") return "bad";
  if (!s) return "neutral";
  return "warn";
}

const toneBar: Record<string, string> = {
  good: "bg-emerald-400",
  warn: "bg-amber-300",
  bad: "bg-rose-400",
  neutral: "bg-slate-500",
};

export function ResultCard({ result }: { result: SearchResult }) {
  const location = [result.city, result.county, result.state].filter(Boolean).join(" · ");
  const licTone = signalTone("license", result);
  const entTone = signalTone("entity", result);

  return (
    <Link
      href={`/contractors/${encodeURIComponent(result.slug)}`}
      className="group block rounded-2xl border border-[var(--border)] bg-[var(--panel)] no-underline transition hover:border-[var(--accent)]/40 hover:bg-[var(--bg-elevated)] active:scale-[0.995]"
    >
      {/* Trust signal strip — license · entity · location at a glance */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--border)]/80 px-4 py-2.5 sm:px-5">
        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)]">
          <span className={`h-1.5 w-1.5 rounded-full ${toneBar[licTone]}`} aria-hidden />
          License {statusLabel(result.licenseStatus)}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)]">
          <span className={`h-1.5 w-1.5 rounded-full ${toneBar[entTone]}`} aria-hidden />
          {result.entityStatus
            ? `Entity ${statusLabel(result.entityStatus)}`
            : "No Sunbiz link"}
        </span>
        {location && (
          <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-xs text-[var(--muted)]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]/70" aria-hidden />
            {location}
          </span>
        )}
        {result.hasDiscipline && (
          <span className="inline-flex items-center gap-1.5 text-xs text-amber-200/90">
            <span className={`h-1.5 w-1.5 rounded-full ${toneBar.warn}`} aria-hidden />
            Discipline on file
          </span>
        )}
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-semibold leading-snug text-[var(--text)] group-hover:text-white sm:text-lg">
              {result.displayName}
            </h2>
            {result.primaryLicenseKey && (
              <p className="mt-1 font-mono text-sm tracking-wide text-[var(--accent)]">
                {result.primaryLicenseKey}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 sm:max-w-[42%] sm:justify-end">
            <StatusBadge
              status={result.licenseStatus}
              label={`License: ${statusLabel(result.licenseStatus)}`}
            />
            {result.entityStatus ? (
              <StatusBadge
                status={result.entityStatus}
                label={`Entity: ${statusLabel(result.entityStatus)}`}
              />
            ) : (
              <StatusBadge status="unknown" label="No Sunbiz link" />
            )}
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          {occupationLabel(result.occupationCode)}
          {result.entityName ? (
            <>
              {" · "}
              <span className="text-[var(--text)]/80">Sunbiz: {result.entityName}</span>
            </>
          ) : null}
        </p>
        <p className="mt-2 text-xs font-medium text-[var(--accent)]/90 opacity-0 transition group-hover:opacity-100 sm:opacity-100 sm:text-[var(--muted)] sm:group-hover:text-[var(--accent)]">
          Open Trust Report →
        </p>
      </div>
    </Link>
  );
}
