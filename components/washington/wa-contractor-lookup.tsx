import { LNI_VERIFY } from "@/lib/washington-intelligence/publication";
import { formatPhoneDisplay, type WaLookupResult } from "@/lib/washington-intelligence/lookup";
import { fmtInt } from "@/lib/washington-intelligence/snapshot";

function FilingNote({ cls }: { cls: string }) {
  if (cls === "CURRENT_FILING_AS_OF") {
    return <span>L&I record indicates current filing as of the source date. Not a TrustHub guarantee.</span>;
  }
  if (cls === "EXPIRED") return <span>Source dates indicate this filing is expired. Expired is not discipline.</span>;
  if (cls === "CANCELLED") return <span>Source cancel date is present.</span>;
  if (cls === "IMPAIRED") return <span>Source marks this bond impaired.</span>;
  return <span>Filing class {cls || "unclassified"} from official dates/flags only.</span>;
}

export function WaContractorLookup({ result }: { result: WaLookupResult }) {
  const q = result.query;
  return (
    <section className="mt-10" aria-labelledby="wa-lookup">
      <h2 id="wa-lookup" className="text-xl font-semibold text-[var(--navy)]">
        Research a Washington L&I contractor
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
        Public identity is <span className="font-medium text-[var(--navy)]">WA-LNI:{"{ContractorLicenseNumber}"}</span>.
        UBI is a separate exact identifier. Results are capped and sorted alphabetically or by query
        relevance — never by bond amount, insurance amount, or enforcement count.
      </p>
      <form action="/washington" method="get" className="mt-4 grid gap-2 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium">Business name, registration, or UBI</span>
          <input name="q" defaultValue={q.q} className="min-h-11 w-full rounded-lg border border-[var(--border)] px-3 text-sm" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">L&I registration</span>
          <input name="registration" defaultValue={q.registration} className="min-h-11 w-full rounded-lg border border-[var(--border)] px-3 text-sm" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">UBI</span>
          <input name="ubi" defaultValue={q.ubi} inputMode="numeric" className="min-h-11 w-full rounded-lg border border-[var(--border)] px-3 text-sm" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">City</span>
          <input name="city" defaultValue={q.city} className="min-h-11 w-full rounded-lg border border-[var(--border)] px-3 text-sm" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">ZIP</span>
          <input name="zip" defaultValue={q.zip} inputMode="numeric" className="min-h-11 w-full rounded-lg border border-[var(--border)] px-3 text-sm" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Type code (CC / EC / PC)</span>
          <input name="type" defaultValue={q.type} className="min-h-11 w-full rounded-lg border border-[var(--border)] px-3 text-sm" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Specialty</span>
          <input name="specialty" defaultValue={q.specialty} className="min-h-11 w-full rounded-lg border border-[var(--border)] px-3 text-sm" />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium">Source-native status</span>
          <input name="status" defaultValue={q.status} placeholder="ACTIVE, EXPIRED, SUSPENDED…" className="min-h-11 w-full max-w-xs rounded-lg border border-[var(--border)] px-3 text-sm" />
        </label>
        <div className="sm:col-span-2">
          <button type="submit" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--navy)] px-4 text-sm font-semibold text-white">
            Search L&I identity
          </button>
        </div>
      </form>

      {!result.empty && result.hits.length === 0 ? (
        <p className="mt-4 text-sm">
          No acquired L&I identity matched this query. Missing local record is not proof of no
          registration.{" "}
          <a className="underline underline-offset-2" href={LNI_VERIFY} rel="noopener noreferrer" target="_blank">
            Verify with L&I
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
            . Bond + insurance is not a Trust Score.
          </p>
          <ul className="mt-3 space-y-4">
            {result.hits.map((hit) => (
              <li key={hit.registration} className="rounded-xl border border-[var(--border)] p-4 text-sm">
                <p className="font-semibold text-[var(--navy)]">{hit.company}</p>
                <p className="mt-1">{hit.waLni}{hit.ubi ? ` · UBI ${hit.ubi}` : ""}</p>
                <div className="mt-3 grid gap-3">
                  <article className="rounded-lg border border-[var(--border)] p-3">
                    <h3 className="font-semibold">Registration</h3>
                    <p className="mt-1 text-xs text-[var(--muted)]">Washington L&I · source-native ContractorLicenseStatus</p>
                    <ul className="mt-2 list-disc pl-5">
                      <li>Type {hit.typeCode || "—"} · status {hit.status || "—"}</li>
                      <li>Specialty {hit.specialty || "—"}</li>
                      <li>
                        {hit.city || "—"} {hit.zip || ""}
                        {hit.phone ? ` · ${formatPhoneDisplay(hit.phone)}` : ""}
                      </li>
                    </ul>
                    {hit.phone ? (
                      <p className="mt-1 text-xs text-[var(--muted)]">Provenance WA_LNI_CONTRACTOR_PHONE. Not a personal number from a principal field.</p>
                    ) : null}
                  </article>
                  <article className="rounded-lg border border-[var(--border)] p-3">
                    <h3 className="font-semibold">Bond record</h3>
                    <p className="mt-1 text-xs text-[var(--muted)]">Bond record published by Washington L&I. Bond record is not an endorsement.</p>
                    {hit.bondCount === 0 ? (
                      <p className="mt-2">NO_BOND_ROW_IN_ACQUIRED_SOURCE. A missing bond row is not unbonded.</p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {hit.bonds.map((b, i) => (
                          <li key={`${hit.registration}-b-${i}`}>
                            {b.firm || "—"} · amount {b.amount || "—"} · effective {b.effective || "—"} · expiration {b.expiration || "—"}
                            {b.cancel ? ` · cancel ${b.cancel}` : ""}
                            {b.impaired ? ` · impaired ${b.impaired}` : ""}
                            <div className="text-xs text-[var(--muted)]"><FilingNote cls={b.filingClass} /></div>
                          </li>
                        ))}
                        {hit.bondCount > hit.bonds.length ? (
                          <li className="text-xs">Multiple bond records ({fmtInt(hit.bondCount)}). Sample capped.</li>
                        ) : null}
                      </ul>
                    )}
                  </article>
                  <article className="rounded-lg border border-[var(--border)] p-3">
                    <h3 className="font-semibold">Liability insurance record</h3>
                    <p className="mt-1 text-xs text-[var(--muted)]">Liability-insurance record published by Washington L&I. Insurance record is not safety.</p>
                    {hit.insuranceCount === 0 ? (
                      <p className="mt-2">NO_INSURANCE_ROW_IN_ACQUIRED_SOURCE. A missing insurance row is not uninsured.</p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {hit.insurance.map((ins, i) => (
                          <li key={`${hit.registration}-i-${i}`}>
                            {ins.company || "—"} · policy {ins.policy || "—"} · amount {ins.amount || "—"} · effective {ins.effective || "—"} · expiration {ins.expiration || "—"}
                            {ins.cancel ? ` · cancel ${ins.cancel}` : ""}
                            <div className="text-xs text-[var(--muted)]"><FilingNote cls={ins.filingClass} /></div>
                          </li>
                        ))}
                        {hit.insuranceCount > hit.insurance.length ? (
                          <li className="text-xs">Multiple insurance records ({fmtInt(hit.insuranceCount)}). Sample capped.</li>
                        ) : null}
                      </ul>
                    )}
                  </article>
                </div>
                <p className="mt-3 text-xs">
                  <a className="underline underline-offset-2" href={LNI_VERIFY} rel="noopener noreferrer" target="_blank">
                    Verify with L&I
                  </a>
                  . These three cards are not one verified-contractor badge.
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
