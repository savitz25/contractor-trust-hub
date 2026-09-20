import type { ContractorDetail } from "@/lib/contractors/types";
import { CONTACT_KIND_LABEL, groupContactsByKind } from "@/lib/contractors/public-contacts";

function formatRetrievedAt(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/**
 * EA-CT-001: additive-only. Renders nothing when this contractor has zero CONFIRMED public
 * contact observations -- an empty state here would read as "we checked and found none," which is
 * not a claim this activation is licensed to make (coverage is uneven and growing).
 */
export function PublicContactSection({ contractor }: { contractor: ContractorDetail }) {
  const groups = groupContactsByKind(contractor.publicContacts);
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
        Public business-contact details reported alongside this license&apos;s own regulator
        record. Exact license join only -- never a guess from a name or address.
      </p>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        {groups.map(({ kind, items }) => (
          <div key={kind} className={items.length > 1 ? "sm:col-span-2" : undefined}>
            <dt className="text-[var(--muted)]">{CONTACT_KIND_LABEL[kind]}</dt>
            <dd className="mt-1 space-y-2">
              {items.map((item) => {
                const asOf = formatRetrievedAt(item.retrievedAt);
                return (
                  <div key={item.id} className="font-medium text-[var(--text)]">
                    <span>{item.value}</span>
                    <p className="mt-0.5 text-xs font-normal text-[var(--muted)]">
                      Source: {item.sourceSystem}
                      {asOf ? ` · Retrieved ${asOf}` : " · Retrieval date not shown in current extract"}
                    </p>
                  </div>
                );
              })}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 text-[11px] text-[var(--muted)]">
        Public business contact evidence from the licensing/permit record itself -- not verified by
        us beyond the source, not a recommendation, and not this contractor&apos;s only way to be
        reached.
      </p>
    </section>
  );
}
