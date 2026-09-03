import { cslbDetailUrl, CSLB_VERIFY } from "@/lib/california-intelligence/local/publication";
import type { ExactLocalActivity } from "@/lib/california-intelligence/local/lookup";
import { fmtInt } from "@/lib/california-intelligence/local/snapshot";

export function CaLocalLicenseLookup({
  action,
  query,
  hit,
  geography,
}: {
  action: string;
  query: string;
  hit: ExactLocalActivity | null;
  geography: "san-francisco" | "los-angeles";
}) {
  return (
    <section className="mt-10" aria-labelledby="exact-lookup">
      <h2 id="exact-lookup" className="text-xl font-semibold text-[var(--navy)]">
        Exact CSLB work-activity lookup
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
        This lookup uses source-native CSLB numbers only. Name-only or high-confidence business-registry
        matches are not work history. Permit activity is not quality.
      </p>
      <form action={action} method="get" className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="license">
          CSLB license number
        </label>
        <input
          id="license"
          name="license"
          defaultValue={query}
          inputMode="numeric"
          placeholder="CSLB license number"
          className="min-h-11 flex-1 rounded-lg border border-[var(--border)] px-3 text-sm"
        />
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--navy)] px-4 text-sm font-semibold text-white"
        >
          Look up exact ID
        </button>
      </form>
      {query && !hit ? (
        <p className="mt-3 text-sm">
          No exact source-native local permit/contact row for CSLB {query} in this geography&apos;s
          harvested files. Missing local record is not proof of no work.{" "}
          <a className="underline underline-offset-2" href={CSLB_VERIFY} rel="noopener noreferrer" target="_blank">
            Verify with CSLB
          </a>
          .
        </p>
      ) : null}
      {hit ? (
        <article className="mt-4 rounded-xl border border-[var(--border)] p-4 text-sm">
          <p className="font-semibold text-[var(--navy)]">{hit.caCslb}</p>
          <p className="mt-1">
            {hit.inAcquiredSpine
              ? "This number is in TrustHub’s currently acquired partial CSLB state extract."
              : "Official local record contains this CSLB license number; that number is outside TrustHub’s currently acquired partial CSLB state extract. It is not unlicensed, invalid, or a failed match."}
          </p>
          {geography === "san-francisco" ? (
            <ul className="mt-2 list-disc pl-5">
              <li>San Francisco permit-contact rows: {fmtInt(hit.sfContacts)}</li>
              <li>Distinct SF permit numbers: {fmtInt(hit.sfPermits)}</li>
              <li>
                Activity window: {hit.sfFirst || "—"} to {hit.sfLast || "—"}
              </li>
            </ul>
          ) : (
            <ul className="mt-2 list-disc pl-5">
              <li>City of LA CofO rows: {fmtInt(hit.laCofo)}</li>
              <li>City of LA PCIS rows: {fmtInt(hit.laPcis)}</li>
              <li>Distinct LA permit IDs observed: {fmtInt(hit.laPermits)}</li>
              <li>
                Activity window: {hit.laFirst || "—"} to {hit.laLast || "—"}
              </li>
            </ul>
          )}
          <p className="mt-2 text-xs text-[var(--muted)]">
            High permit count is not a better contractor. Valuation is not revenue.{" "}
            <a className="underline underline-offset-2" href={cslbDetailUrl(hit.license)} rel="noopener noreferrer" target="_blank">
              Verify with CSLB
            </a>
            .
          </p>
        </article>
      ) : null}
    </section>
  );
}
