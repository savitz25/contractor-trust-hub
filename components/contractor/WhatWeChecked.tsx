import { formatDateTime } from "@/lib/contractors/format";
import type { ContractorDetail } from "@/lib/contractors/types";
import {
  checkedItems,
  notCheckedItems,
} from "@/lib/states/evidence-copy";
import { isEvidenceCopySlug, reportJurisdiction } from "@/lib/states/jurisdiction";

const NEUTRAL_CHECKED = [
  "Published credential record when linked",
  "Source attribution and extract freshness on this profile",
  "Business location as recorded on the profile",
];

const NEUTRAL_UNCHECKED = [
  "A live board check at page load",
  "Insurance certificate validity",
  "Reviews, rankings, or a hire recommendation",
];

export function WhatWeChecked({ contractor }: { contractor: ContractorDetail }) {
  const lic = contractor.licenses[0];
  const ent = contractor.entities[0];
  const report = reportJurisdiction(contractor.licenses);
  const copySlug = report.slug && isEvidenceCopySlug(report.slug) ? report.slug : null;
  const checked = copySlug
    ? checkedItems(copySlug)
    : report.state
      ? [`${report.state.name} credential record when linked`, ...NEUTRAL_CHECKED.slice(1)]
      : NEUTRAL_CHECKED;
  const notChecked = copySlug ? notCheckedItems(copySlug) : NEUTRAL_UNCHECKED;
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
            {checked.map((line) => (
              <li key={line}>· {line}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-900">
            Not checked here
          </p>
          <ul className="mt-2 space-y-1 text-[var(--muted)]">
            {notChecked.map((line) => (
              <li key={line}>· {line}</li>
            ))}
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
