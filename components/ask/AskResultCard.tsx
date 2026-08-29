import Link from "next/link";
import type { AskEntityCard } from "@/lib/ask/execute";
import { SaveToResearch } from "./SaveToResearch";

export function AskResultCard({ card }: { card: AskEntityCard }) {
  return (
    <article className="cth-intel-card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[var(--text)]">{card.displayName}</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {card.credentialKey ? <span className="font-medium text-[var(--text)]">{card.credentialKey}</span> : "Credential number not published on this row"}
            {card.occupationLabel ? ` · ${card.occupationLabel}` : card.occupationCode ? ` · ${card.occupationCode}` : ""}
          </p>
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--navy)]">{card.sourceLabel}</p>
      </div>
      <ul className="flex flex-wrap gap-2" aria-label="Result facts">
        <li className="rounded-full bg-[var(--bg)] px-2.5 py-1 text-xs">{card.statusLabel}</li>
        {card.occupationLabel ? <li className="rounded-full bg-[var(--bg)] px-2.5 py-1 text-xs">{card.occupationLabel}</li> : null}
        {card.county ? <li className="rounded-full bg-[var(--bg)] px-2.5 py-1 text-xs">{card.county} recorded address</li> : null}
        {card.evidenceCount > 0 ? (
          <li className="rounded-full bg-[var(--bg)] px-2.5 py-1 text-xs">
            {card.sourceLabel} discipline: {card.evidenceCount} indexed records
          </li>
        ) : null}
      </ul>
      <p className="text-sm text-[var(--muted)]">{card.geographyNote}</p>
      <details>
        <summary className="cursor-pointer text-sm font-semibold text-[var(--navy)]">Why this matched</summary>
        <p className="mt-2 text-sm text-[var(--muted)]">{card.whyMatched}</p>
      </details>
      {card.evidenceCount > 0 ? (
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-[var(--navy)]">View evidence</summary>
          {card.evidence.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--muted)]">
              No records from this selected evidence family were linked in the current indexed public dataset. This is not equivalent to a clean record.
            </p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {card.evidence.map((row) => (
                <li key={row.id} className="rounded-lg border border-[var(--border)] p-3">
                  <p className="font-medium">{row.family}</p>
                  <p className="text-xs text-[var(--muted)]">{row.sourceLabel} · {row.sourceDataset}</p>
                  {row.caseId ? <p>Case/action: {row.caseId}</p> : null}
                  {row.actionDate ? <p>Action date: {row.actionDate}</p> : null}
                  {row.disposition ? <p>Disposition/status: {row.disposition}</p> : null}
                  <p className="mt-1 text-xs text-[var(--muted)]">Indexed source record — not a finding of guilt by ContractorTrustHub.</p>
                </li>
              ))}
            </ul>
          )}
        </details>
      ) : null}
      <div className="flex flex-wrap gap-3">
        {card.profileHref ? (
          <Link href={card.profileHref} className="font-semibold text-[var(--navy)] hover:underline">
            View research report
          </Link>
        ) : (
          <Link href="/verify" className="text-sm text-[var(--navy)] hover:underline">
            Research in Verify
          </Link>
        )}
        {card.slug ? (
          <SaveToResearch
            slug={card.slug}
            name={card.displayName}
            licenseKey={card.credentialKey}
            licenseStatus={card.statusNormalized}
          />
        ) : null}
      </div>
    </article>
  );
}
