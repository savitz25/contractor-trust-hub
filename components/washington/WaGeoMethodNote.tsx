import Link from "next/link";
import type { CountyDef } from "@/lib/discovery/types";
import { WA_LNI_VERIFY_URL } from "@/lib/states/wa-lni";
import {
  WA_GEO_METHOD_POINTS,
  waGeoBody,
  waGeoCaveatsFor,
  waGeoHeadline,
  waGeoIsCity,
  waGeoIsOutOfState,
} from "@/lib/washington/geo-copy";

export function WaGeoMethodNote({
  geo,
  compact = false,
}: {
  geo?: CountyDef | null;
  compact?: boolean;
}) {
  const isCity = geo ? waGeoIsCity(geo) : false;
  const isOos = geo ? waGeoIsOutOfState(geo) : false;
  const headline = geo
    ? waGeoHeadline(geo)
    : "County is derived from ZIP5. City pages match mailing city + Washington.";
  const body = geo ? waGeoBody(geo) : null;
  const caveats = geo ? waGeoCaveatsFor(geo) : [...WA_GEO_METHOD_POINTS];

  return (
    <aside
      className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3.5 sm:px-5"
      role="note"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        {isOos ? "Mailing address" : isCity ? "City match" : "How location is built"}
      </p>
      <p className="mt-1 text-sm font-semibold leading-snug text-[var(--text)]">{headline}</p>
      {compact || !body ? null : (
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted)] sm:text-sm">{body}</p>
      )}
      {caveats.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-[var(--muted)]">
          {caveats.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      ) : null}
      {geo ? null : (
        <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
          <Link href="/washington/out-of-state" className="font-medium text-[var(--navy)] underline-offset-2 hover:underline">
            Out-of-state mailing list
          </Link>
          {" · "}
          <a
            href={WA_LNI_VERIFY_URL}
            className="font-medium text-[var(--navy)] underline-offset-2 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Official L&I verify
          </a>
        </p>
      )}
    </aside>
  );
}
