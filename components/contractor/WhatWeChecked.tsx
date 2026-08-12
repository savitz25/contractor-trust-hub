import { formatDateTime } from "@/lib/contractors/format";
import type { ContractorDetail } from "@/lib/contractors/types";

export function WhatWeChecked({ contractor }: { contractor: ContractorDetail }) {
  const lic = contractor.licenses[0];
  const ent = contractor.entities[0];
  const freshest =
    [lic?.lastVerifiedAt, ent?.lastVerifiedAt, contractor.discipline[0]?.lastVerifiedAt]
      .filter(Boolean)
      .sort()
      .reverse()[0] || null;

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg)]/60 px-4 py-4 sm:px-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
        What we checked / what we didn&apos;t
      </h2>
      <div className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
            Evidence on file
          </p>
          <ul className="mt-2 space-y-1 text-[var(--muted)]">
            <li>· Florida DBPR construction license extract (when linked)</li>
            <li>· High-confidence Sunbiz entity link (strict match only)</li>
            <li>· Board discipline rows linked in our extracts</li>
            <li>· Related-entity pattern rules on this profile</li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-900">
            Not checked here
          </p>
          <ul className="mt-2 space-y-1 text-[var(--muted)]">
            <li>· Active insurance / COI validity (request &amp; verify)</li>
            <li>· Workers&apos; comp policy status (use official portals)</li>
            <li>· Permit/activity volume (not yet linked)</li>
            <li>· Reviews, ratings, or private financials</li>
          </ul>
        </div>
      </div>
      <p className="mt-3 text-xs text-[var(--muted)]">
        Extract freshness (latest field on this profile):{" "}
        <span className="text-[var(--text)]">{formatDateTime(freshest)}</span>
        . Always re-check official boards before hiring.
      </p>
    </section>
  );
}
