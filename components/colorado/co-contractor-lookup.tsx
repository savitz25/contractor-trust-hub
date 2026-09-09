import { DORA_VERIFY } from "@/lib/colorado-intelligence/publication";
import type { CoLookupResult } from "@/lib/colorado-intelligence/lookup";
import { fmtInt } from "@/lib/colorado-intelligence/snapshot";

export function ColoradoContractorLookup({ result }: { result: CoLookupResult }) {
  const q = result.query;
  return (
    <section className="mt-10" aria-labelledby="co-lookup">
      <h2 id="co-lookup" className="text-lg font-semibold text-[var(--navy)]">
        Research a Colorado electrical or plumbing contractor registration
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
        Public business identity is{" "}
        <span className="font-medium text-[var(--navy)]">CO-DORA:{"{prefix}:{number}"}</span>. This
        lookup covers EC and PC business registrations only. Individual electricians, plumbers,
        apprentices, architects, and engineers are not contractor-business profiles.
      </p>
      <form action="/colorado" method="get" className="mt-4 grid gap-2 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          Business name or EC/PC credential
          <input
            name="q"
            defaultValue={q.q}
            className="mt-1 min-h-11 w-full rounded-md border border-[var(--border)] px-3 py-2"
            placeholder="EC 12345 or business name"
          />
        </label>
        <label className="text-sm">
          Prefix
          <input
            name="prefix"
            defaultValue={q.prefix}
            className="mt-1 min-h-11 w-full rounded-md border border-[var(--border)] px-3 py-2"
            placeholder="EC or PC"
          />
        </label>
        <label className="text-sm">
          License number
          <input
            name="number"
            defaultValue={q.number}
            className="mt-1 min-h-11 w-full rounded-md border border-[var(--border)] px-3 py-2"
          />
        </label>
        <label className="text-sm">
          City
          <input
            name="city"
            defaultValue={q.city}
            className="mt-1 min-h-11 w-full rounded-md border border-[var(--border)] px-3 py-2"
          />
        </label>
        <label className="text-sm">
          Status
          <input
            name="status"
            defaultValue={q.status}
            placeholder="Active"
            className="mt-1 min-h-11 w-full rounded-md border border-[var(--border)] px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="mt-2 min-h-11 rounded-md bg-[var(--navy)] px-4 py-2 text-sm font-medium text-white sm:col-span-2"
        >
          Search EC/PC registrations
        </button>
      </form>
      {!result.empty && result.hits.length === 0 ? (
        <p className="mt-4 text-sm">
          No acquired EC/PC registration matched this query. Missing from this extract is not proof of
          no DORA credential and is not proof of an unlicensed general contractor.{" "}
          <a className="underline underline-offset-2" href={DORA_VERIFY} rel="noopener noreferrer" target="_blank">
            Verify on DORA
          </a>
          .
        </p>
      ) : null}
      {result.hits.length > 0 ? (
        <div className="mt-4">
          <p className="text-sm">
            {fmtInt(result.totalMatched)} matching EC/PC credential rows
            {result.capped ? ` (showing ${result.cap})` : ""}. Sorted by name, not discipline.
          </p>
          <ul className="mt-3 space-y-3">
            {result.hits.map((hit) => (
              <li key={hit.identity} className="rounded-xl border border-[var(--border)] bg-white px-4 py-3">
                <p className="font-medium text-[var(--navy)]">{hit.name || "Unnamed business credential"}</p>
                <p className="mt-1 text-sm tabular-nums">
                  {hit.identity} · {hit.status}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {[hit.city, hit.state, hit.zip].filter(Boolean).join(", ") || "Location not published"}
                </p>
                {hit.verifyUrl ? (
                  <a
                    className="mt-2 inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-2"
                    href={hit.verifyUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Official DORA verify link
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
