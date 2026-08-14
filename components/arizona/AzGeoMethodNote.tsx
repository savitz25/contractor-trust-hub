import type { CountyDef } from "@/lib/discovery/types";
import {
  azGeoBody,
  azGeoCaveatsFor,
  azGeoHeadline,
  azGeoIsCity,
} from "@/lib/arizona/geo-copy";

export function AzGeoMethodNote({
  geo,
  compact = false,
}: {
  geo?: CountyDef | null;
  compact?: boolean;
}) {
  const isCity = geo ? azGeoIsCity(geo) : false;
  const headline = geo
    ? azGeoHeadline(geo)
    : "County browse is derived from mailing city. City pages match that city only.";
  const body = geo
    ? azGeoBody(geo)
    : "The ROC current-contractor extract is strong on city and almost empty on official county. County totals roll up a maintained city → county map. That map is not an ROC field.";
  const caveats = geo
    ? azGeoCaveatsFor(geo)
    : [
        "City of Maricopa and San Tan Valley are mapped to Pinal, not Maricopa County.",
        "Unmapped towns and out-of-state mailing cities are omitted from county totals.",
      ];

  return (
    <aside
      className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3.5 sm:px-5"
      role="note"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        {isCity ? "City match" : "How location is built"}
      </p>
      <p className="mt-1 text-sm font-semibold leading-snug text-[var(--text)]">{headline}</p>
      {compact ? null : (
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted)] sm:text-sm">{body}</p>
      )}
      {caveats.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-[var(--muted)]">
          {caveats.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      ) : null}
    </aside>
  );
}
