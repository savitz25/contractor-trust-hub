import { TDLR_VERIFY, TSBPE_VERIFY } from "@/lib/texas-intelligence/local/publication";
import { formatPhoneDisplay, type AustinLookupResult } from "@/lib/texas-intelligence/local/lookup";
import { fmtInt } from "@/lib/texas-intelligence/local/snapshot";

export function TxAustinIdentityLookup({ result }: { result: AustinLookupResult }) {
  const q = result.query;
  return (
    <section className="mt-10" aria-labelledby="austin-lookup">
      <h2 id="austin-lookup" className="text-xl font-semibold text-[var(--navy)]">
        Research a City of Austin permit contractor
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
        Public identity is normalized contractor company plus normalized contractor phone when both
        exist on the issued-permit row ({" "}
        <span className="font-medium text-[var(--navy)]">AUSTIN_PERMIT_CONTRACTOR_IDENTITY</span>
        ). That key is not a TDLR or TSBPE credential. Person-name-only rows are not published.
        Results are capped and sorted alphabetically or by query relevance — never by permit count
        or valuation.
      </p>
      <form action="/texas/austin" method="get" className="mt-4 grid gap-2 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Company</span>
          <input
            name="company"
            defaultValue={q.company}
            placeholder="Contractor company name"
            className="min-h-11 w-full rounded-lg border border-[var(--border)] px-3 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Phone</span>
          <input
            name="phone"
            defaultValue={q.phone}
            inputMode="tel"
            placeholder="Contractor phone"
            className="min-h-11 w-full rounded-lg border border-[var(--border)] px-3 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Permit number</span>
          <input
            name="permit"
            defaultValue={q.permit}
            placeholder="City of Austin permit number"
            className="min-h-11 w-full rounded-lg border border-[var(--border)] px-3 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Trade (optional)</span>
          <input
            name="trade"
            defaultValue={q.trade}
            placeholder="Electrical, plumbing, mechanical…"
            className="min-h-11 w-full rounded-lg border border-[var(--border)] px-3 text-sm"
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium">Contractor ZIP (optional)</span>
          <input
            name="zip"
            defaultValue={q.zip}
            inputMode="numeric"
            placeholder="5-digit ZIP"
            className="min-h-11 w-full max-w-xs rounded-lg border border-[var(--border)] px-3 text-sm"
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--navy)] px-4 text-sm font-semibold text-white"
          >
            Search local permit identity
          </button>
        </div>
      </form>

      {q.permit ? (
        <p className="mt-3 text-xs text-[var(--muted)]">
          Permit-number search uses a capped sample of recent permits per identity. This is not a
          complete City of Austin permit directory.
        </p>
      ) : null}

      {!result.empty && result.hits.length === 0 ? (
        <p className="mt-4 text-sm">
          No public company+phone identity matched this query in the acquired City of Austin extract.
          Missing local record is not proof of no work.{" "}
          <a className="underline underline-offset-2" href={TDLR_VERIFY} rel="noopener noreferrer" target="_blank">
            Verify with TDLR
          </a>
          {" · "}
          <a className="underline underline-offset-2" href={TSBPE_VERIFY} rel="noopener noreferrer" target="_blank">
            Verify with TSBPE
          </a>
          .
        </p>
      ) : null}

      {result.hits.length > 0 ? (
        <div className="mt-4">
          <p className="text-sm">
            Showing {fmtInt(result.hits.length)}
            {result.capped
              ? ` of ${fmtInt(result.totalMatched)} matches (cap ${result.cap})`
              : ` match${result.hits.length === 1 ? "" : "es"}`}
            . High permit count is not a better contractor.
          </p>
          <ul className="mt-3 space-y-3">
            {result.hits.map((hit) => (
              <li key={`${hit.company}|${hit.phone}`} className="rounded-xl border border-[var(--border)] p-4 text-sm">
                <p className="font-semibold text-[var(--navy)]">{hit.company}</p>
                <p className="mt-1">
                  Phone {formatPhoneDisplay(hit.phone)}
                  {hit.address ? ` · ${hit.address}` : ""}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Provenance: AUSTIN_PERMIT_CONTRACTOR_PHONE
                  {hit.address ? " / AUSTIN_PERMIT_CONTRACTOR_ADDRESS" : ""}. This is the permit-row
                  contractor contact, not a TDLR or TSBPE contact.
                </p>
                <ul className="mt-2 list-disc pl-5">
                  <li>Issued-permit rows in extract: {fmtInt(hit.permitCount)}</li>
                  <li>
                    Activity window: {hit.firstIssued || "—"} to {hit.lastIssued || "—"}
                  </li>
                  <li>Trade on file: {hit.trades.length ? hit.trades.join(", ") : "—"}</li>
                </ul>
                {hit.recent.length ? (
                  <div className="mt-2">
                    <p className="text-xs font-medium">Recent permits in this identity sample</p>
                    <ul className="mt-1 list-disc pl-5 text-xs">
                      {hit.recent.map((p) => (
                        <li key={p.permit}>
                          {p.permit}
                          {p.type ? ` · ${p.type}` : ""}
                          {p.date ? ` · ${p.date}` : ""}
                          {p.status ? ` · ${p.status}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Permit activity is not quality. Valuation is not revenue. FINAL is not inspections
                  passed. Local identity is not a state license.{" "}
                  <a className="underline underline-offset-2" href={TDLR_VERIFY} rel="noopener noreferrer" target="_blank">
                    Verify state trade credential
                  </a>
                  .
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
