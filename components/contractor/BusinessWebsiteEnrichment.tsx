import React from "react";
import Link from "next/link";
import type { BusinessWebsiteEnrichment as Enrichment } from "@/lib/contractors/enrichment-shape";
import { telHref, websiteHost } from "@/lib/contractors/enrichment-shape";

/**
 * MD-ENRICH-001 — information TrustHub found on the business's own website.
 * Additional evidence only: the DBPR primary address and license classification shown
 * elsewhere on the report stay authoritative. Not a TrustHub verification or endorsement.
 * Empty fields render nothing (no N/A / Unknown placeholders).
 */
export function BusinessWebsiteEnrichment({
  data,
  correctionHref,
  claimAvailable = false,
}: {
  data: Enrichment;
  correctionHref: string;
  /** True only when the existing ATH_CLAIM_CTA_MODE-gated ManageProfileCta renders on this page. */
  claimAvailable?: boolean;
}) {
  const observed = data.observedAt
    ? new Date(data.observedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "America/New_York" })
    : null;
  const hasContact = Boolean(data.website || data.phones.length || data.emails.length);
  return (
    <section
      id="business-website"
      aria-labelledby="business-website-heading"
      data-enrichment="business-website"
      className="scroll-mt-28 rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm sm:p-6"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">From the business website</p>
      <h2 id="business-website-heading" className="mt-1 text-xl font-semibold text-[var(--text)]">
        Business contact and services
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
        TrustHub found this information on the business&apos;s own website. It is not part of the DBPR license record and
        has not been verified by TrustHub. The license record above remains the source for license status, classification
        and primary address.
      </p>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        {hasContact ? (
          <div>
            <h3 className="font-semibold text-[var(--text)]">Business contact information</h3>
            <dl className="mt-2 space-y-2 text-sm">
              {data.website ? (
                <div>
                  <dt className="text-[var(--muted)]">Business website</dt>
                  <dd className="break-all">
                    <a className="underline" href={data.website} target="_blank" rel="nofollow noopener noreferrer">
                      {websiteHost(data.website)}
                    </a>
                  </dd>
                </div>
              ) : null}
              {data.phones.length ? (
                <div>
                  <dt className="text-[var(--muted)]">Business phone</dt>
                  {data.phones.map((p) => {
                    const href = telHref(p);
                    return <dd key={p}>{href ? <a href={href}>{p}</a> : p}</dd>;
                  })}
                </div>
              ) : null}
              {data.emails.length ? (
                <div>
                  <dt className="text-[var(--muted)]">Business email</dt>
                  {data.emails.map((e) => (
                    <dd key={e} className="break-all">
                      <a href={`mailto:${e}`}>{e}</a>
                    </dd>
                  ))}
                </div>
              ) : null}
            </dl>
          </div>
        ) : null}

        {data.otherLocations.length ? (
          <div>
            <h3 className="font-semibold text-[var(--text)]">Other locations</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">From the business website. Not the DBPR address of record.</p>
            <ul className="mt-2 space-y-1 text-sm">
              {data.otherLocations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {data.services.length ? (
          <div className="md:col-span-2">
            <h3 className="font-semibold text-[var(--text)]">Services listed by the business</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">
              As described on the business website. This is not the DBPR license classification and does not show what
              the license authorizes.
            </p>
            <ul className="mt-2 flex flex-wrap gap-2 text-sm">
              {data.services.map((s) => (
                <li key={s} className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1">
                  {s}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <p className="mt-5 text-xs text-[var(--muted)]">
        Source: business website
        {data.sourceUrls.length ? (
          <>
            {" ("}
            {data.sourceUrls.map((u, i) => (
              <React.Fragment key={u}>
                {i ? ", " : null}
                <a className="underline" href={u} target="_blank" rel="nofollow noopener noreferrer">
                  {websiteHost(u)}
                </a>
              </React.Fragment>
            ))}
            {")"}
          </>
        ) : null}
        {observed ? `, reviewed ${observed}` : null}.
      </p>
      <p className="mt-3 text-sm text-[var(--text)]" data-enrichment-claim>
        Is this your business?{" "}
        {claimAvailable ? (
          <>
            <a href="#manage-profile" className="font-semibold underline">
              Claim this profile
            </a>
            {" or "}
            <Link href={correctionHref} className="font-semibold underline">
              correct this information
            </Link>
          </>
        ) : (
          <Link href={correctionHref} className="font-semibold underline">
            Correct this profile
          </Link>
        )}
      </p>
    </section>
  );
}
