import React from "react";
import Link from "next/link";
import type { AskEntityCard } from "@/lib/ask/execute";
import {
  matchSummary,
  recordedAddressLine,
  showGeographyOnFace,
  traceMatchText,
} from "@/lib/ask/candidate-card-presentation";
import { SaveToResearch } from "./SaveToResearch";

function credentialLine(card: AskEntityCard): string {
  const identifier = card.credentialKey || "Credential number not published on this row";
  const classification = card.occupationLabel?.trim() || card.occupationCode?.trim() || "";
  return classification ? `${identifier} · ${classification}` : identifier;
}

function CardFacts({ card, matchQuery, linked }: { card: AskEntityCard; matchQuery?: string | null; linked: boolean }) {
  const summary = matchSummary(card, matchQuery);
  const address = recordedAddressLine(card);
  const jurisdiction = card.credentialJurisdictionLabel?.trim() || "";
  return (
    <>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <h3 className="min-w-0 break-words text-xl font-semibold leading-snug text-[var(--text)]">{card.displayName}</h3>
        {linked ? (
          <span className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-[var(--navy)] underline-offset-2 group-hover:underline">
            View profile →
          </span>
        ) : null}
      </div>
      <p className="mt-2 break-words text-sm text-[var(--text)]">{credentialLine(card)}</p>
      <p className="mt-2 text-sm font-medium text-[var(--text)]">
        <span className="font-semibold">Status · </span>
        {card.statusLabel}
      </p>
      {jurisdiction ? (
        <p className="mt-1 break-words text-sm text-[var(--muted)]">
          <span className="font-medium text-[var(--text)]">Credential jurisdiction · </span>
          {jurisdiction}
        </p>
      ) : card.sourceLabel ? (
        <p className="mt-1 break-words text-sm text-[var(--muted)]">
          <span className="font-medium text-[var(--text)]">Source · </span>
          {card.sourceLabel}
        </p>
      ) : null}
      {address ? (
        <p className="mt-1 break-words text-sm text-[var(--muted)]">
          <span className="font-medium text-[var(--text)]">Recorded address · </span>
          {address}
        </p>
      ) : null}
      {card.evidenceCount > 0 ? (
        <p className="mt-1 text-sm text-[var(--muted)]">
          {card.sourceLabel} discipline: {card.evidenceCount} indexed records
        </p>
      ) : null}
      {showGeographyOnFace(card) ? <p className="mt-2 text-sm text-[var(--muted)]">{card.geographyNote}</p> : null}
      {summary ? <p className="mt-3 text-sm text-[var(--text)]">{summary}</p> : card.whyMatched ? (
        <section className="mt-3" aria-label="Why this result matched">
          <h4 className="text-sm font-semibold">Why this matched</h4>
          <p className="mt-1 text-sm text-[var(--muted)]">{card.whyMatched}</p>
        </section>
      ) : null}
      {!linked ? <p className="mt-3 text-sm text-[var(--muted)]">No public profile is published for this row.</p> : null}
    </>
  );
}

export function AskResultCard({ card, matchQuery = null }: { card: AskEntityCard; matchQuery?: string | null }) {
  const profile = card.profileHref;
  const traceWhy = traceMatchText(card.whyMatched);
  const address = recordedAddressLine(card);
  return (
    <article className="cth-result-card" data-testid="ask-result-card">
      {profile ? (
        <Link
          href={profile}
          prefetch={false}
          data-search-action="profile"
          data-testid="ask-profile-link"
          className="cth-profile-link group"
        >
          <CardFacts card={card} matchQuery={matchQuery} linked />
        </Link>
      ) : (
        <div className="cth-profile-link">
          <CardFacts card={card} matchQuery={matchQuery} linked={false} />
        </div>
      )}
      <div className="cth-result-card__actions">
        {card.slug ? (
          <SaveToResearch
            slug={card.slug}
            name={card.displayName}
            licenseKey={card.credentialKey}
            licenseStatus={card.statusNormalized}
          />
        ) : null}
        {!profile ? (
          <Link href="/verify" prefetch={false} className="cth-result-secondary">
            Research in Verify
          </Link>
        ) : null}
        <details className="cth-result-disclosure">
          <summary data-search-action="trace" className="cth-result-secondary">Trace this result</summary>
          <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
            {traceWhy ? (
              <div className="sm:col-span-2">
                <dt className="text-[var(--muted)]">Why matched</dt>
                <dd className="break-words">{traceWhy}</dd>
              </div>
            ) : null}
            {card.matchedOn ? (
              <div className="sm:col-span-2">
                <dt className="text-[var(--muted)]">Match method</dt>
                <dd className="break-words">
                  {card.matchedOn.method.replaceAll("_", " ").toLowerCase()} · field: {card.matchedOn.field.replaceAll("_", " ")} · “{card.matchedOn.value}”
                </dd>
              </div>
            ) : null}
            <div><dt className="text-[var(--muted)]">Source system</dt><dd className="break-words">{card.sourceLabel}</dd></div>
            <div><dt className="text-[var(--muted)]">Credential</dt><dd className="break-all">{card.credentialKey || "Not published"}</dd></div>
            {card.credentialJurisdictionLabel ? (
              <div><dt className="text-[var(--muted)]">Credential jurisdiction</dt><dd className="break-words">{card.credentialJurisdictionLabel}</dd></div>
            ) : null}
            {address ? (
              <div><dt className="text-[var(--muted)]">Recorded address</dt><dd className="break-words">{address}</dd></div>
            ) : null}
            <div className="sm:col-span-2"><dt className="text-[var(--muted)]">Geography rule</dt><dd className="break-words">{card.geographyNote}</dd></div>
            <div className="sm:col-span-2">
              <dt className="text-[var(--muted)]">Evidence coverage</dt>
              <dd>{card.evidenceCount ? "Linked public-eligible records available" : "No positive evidence assertion; missing is not zero"}</dd>
            </div>
          </dl>
        </details>
        {card.evidenceCount > 0 ? (
          <details className="cth-result-disclosure">
            <summary className="cth-result-secondary">View evidence</summary>
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
      </div>
    </article>
  );
}
