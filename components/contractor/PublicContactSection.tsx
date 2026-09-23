import type { ContractorDetail } from "@/lib/contractors/types";
import { CONTACT_KIND_LABEL, groupContactsForDisplay, type ContactSourceCitation } from "@/lib/contractors/public-contacts";

function formatRetrievedAt(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/** Only ever render a source link when it is a well-formed absolute http(s) URL -- raw ingested text is never trusted as-is. */
function safeSourceHref(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function SourceCitation({ citation }: { citation: ContactSourceCitation }) {
  const asOf = formatRetrievedAt(citation.retrievedAt);
  const href = safeSourceHref(citation.sourceUrl);
  return (
    <span>
      Source:{" "}
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="font-medium text-[var(--navy)]">
          {citation.sourceSystem}
        </a>
      ) : (
        citation.sourceSystem
      )}
      {asOf ? ` · Retrieved ${asOf}` : " · Retrieval date not shown in current extract"}
    </span>
  );
}

/**
 * EA-CT-001: additive-only. Renders nothing when this contractor has zero CONFIRMED public
 * contact observations -- an empty state here would read as "we checked and found none," which is
 * not a claim this activation is licensed to make (coverage is uneven and growing).
 */
export function PublicContactSection({ contractor }: { contractor: ContractorDetail }) {
  const groups = groupContactsForDisplay(contractor.publicContacts);
  if (!groups.length) return null;

  return (
    <section
      id="public-contact"
      className="scroll-mt-28 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-6"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
        Public business contact
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
        Public business-contact information reported in an official public permit/source record
        and linked to this contractor through an exact license identifier -- never a guess from a
        name or address.
      </p>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Coverage is uneven and growing: absence here does not mean no public contact record
        exists, only that one is not yet linked in this extract.
      </p>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        {groups.map(({ kind, items }) => (
          <div key={kind} className={items.length > 1 ? "sm:col-span-2" : undefined}>
            <dt className="text-[var(--muted)]">{CONTACT_KIND_LABEL[kind]}</dt>
            <dd className="mt-1 space-y-2">
              {items.map((item) => (
                <div key={`${item.licenseId}:${item.valueNormalized}`} className="font-medium text-[var(--text)]">
                  <span>{item.value}</span>
                  {/* Every corroborating source is cited -- a value confirmed by two sources is one
                      fact shown once, never two cards and never a dropped citation. */}
                  <div className="mt-0.5 space-y-0.5 text-xs font-normal text-[var(--muted)]">
                    {item.sources.map((citation, i) => (
                      <p key={`${citation.sourceSystem}:${citation.retrievedAt ?? i}`}>
                        <SourceCitation citation={citation} />
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 text-[11px] text-[var(--muted)]">
        Public business contact evidence reported in the source&apos;s own public permit/record
        system -- not verified by us beyond that source, not a recommendation, and not this
        contractor&apos;s only way to be reached.
      </p>
    </section>
  );
}
