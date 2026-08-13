import Link from "next/link";
import { prepareNameSearch } from "@/lib/contractors/search-normalize";
import { TX_COVERED_TRADES_PLAIN } from "@/lib/states/tx-trades";

type Props = {
  query: string;
  mode: "license" | "name";
  /** Evidence state: fl (default) | tx */
  stateSlug?: string;
};

export function EmptyResults({ query, mode, stateSlug = "fl" }: Props) {
  if (stateSlug === "tx") {
    return <TexasEmptyResults query={query} mode={mode} />;
  }
  if (stateSlug === "nj") {
    return <NjEmptyResults query={query} mode={mode} />;
  }
  return <FloridaEmptyResults query={query} mode={mode} />;
}

function NjEmptyResults({ query, mode }: { query: string; mode: "license" | "name" }) {
  return (
    <div className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/40 px-4 py-8 sm:px-8 sm:py-9">
      <p className="text-base font-medium text-[var(--text)]">
        No New Jersey registrations matched &ldquo;{query}&rdquo;
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
        {mode === "license"
          ? "We looked for that registration / license key in the NJ DCA extract (HIC and available specialty boards)."
          : "We searched business and owner names in the NJ HIC / specialty extract only."}
      </p>
      <ul className="mt-5 list-disc space-y-2.5 pl-5 text-sm leading-relaxed text-[var(--muted)]">
        <li>
          New Jersey has <strong className="font-medium text-[var(--text)]">no single statewide general contractor license</strong>{" "}
          — coverage is HIC registration plus specialty boards when bulk data is loaded.
        </li>
        <li>Missing from results does not prove someone is unregistered — always confirm on the official DCA / MyLicense site.</li>
        <li>
          Florida&apos;s full journey (plan, property, projects, passport) remains at{" "}
          <Link href="/verify" className="text-[var(--accent)]">
            /verify
          </Link>
          .
        </li>
      </ul>
      <div className="mt-5 flex flex-wrap gap-2 text-sm font-semibold">
        <Link href="/verify?state=nj" className="text-[var(--navy)]">
          Clear search
        </Link>
        <Link href="/verify" className="text-[var(--navy)]">
          Florida Verify
        </Link>
      </div>
    </div>
  );
}

function FloridaEmptyResults({ query, mode }: { query: string; mode: "license" | "name" }) {
  const prepared = prepareNameSearch(query);
  const strippedDiffers =
    prepared.stripped.length >= 2 &&
    prepared.stripped.toLowerCase() !== query.trim().toLowerCase();

  return (
    <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--panel)]/50 px-4 py-8 sm:px-8 sm:py-9">
      <p className="text-base font-medium text-[var(--text)]">
        No licensed Florida contractors matched &ldquo;{query}&rdquo;
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
        {mode === "license"
          ? "We looked for that license id in Florida DBPR construction records."
          : "We searched board display names, legal names, and DBAs (legal endings like LLC / Inc are ignored when matching)."}
      </p>

      <ul className="mt-5 list-disc space-y-2.5 pl-5 text-sm leading-relaxed text-[var(--muted)]">
        {mode === "license" ? (
          <>
            <li>
              Use the full license id when you can (e.g.{" "}
              <Link href="/verify?q=CBC015082" className="text-[var(--accent)]">
                CBC015082
              </Link>
              ). Spaces and dashes are fine.
            </li>
            <li>If you only have a company name, try a name search instead.</li>
          </>
        ) : (
          <>
            {strippedDiffers && (
              <li>
                Try without legal endings:{" "}
                <Link
                  href={`/verify?q=${encodeURIComponent(prepared.stripped)}`}
                  className="text-[var(--accent)]"
                >
                  {prepared.stripped}
                </Link>
              </li>
            )}
            <li>Use fewer distinctive words from the legal or DBA name.</li>
            <li>We match official board extracts — not marketing nicknames.</li>
            <li>
              Prefer a license number when you have one — e.g.{" "}
              <Link href="/verify?q=CBC015082" className="text-[var(--accent)]">
                CBC015082
              </Link>
            </li>
          </>
        )}
      </ul>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link
          href="/#research"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--navy)] no-underline"
        >
          Browse by county & trade
        </Link>
        <Link
          href="/florida"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-medium text-[var(--text)] no-underline hover:bg-[var(--bg-elevated)]"
        >
          Open Florida discovery
        </Link>
        <Link
          href="/guides/how-to-verify-florida-contractor"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-medium text-[var(--text)] no-underline hover:bg-[var(--bg-elevated)]"
        >
          How to verify
        </Link>
        <Link
          href="/verify?state=tx"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-medium text-[var(--text)] no-underline hover:bg-[var(--bg-elevated)]"
        >
          Try Texas specialty search
        </Link>
      </div>

      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/80 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          Example searches
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            { q: "CBC015082", label: "CBC015082" },
            { q: "Worsham Construction", label: "Worsham Construction" },
            { q: "ABC Roofing", label: "ABC Roofing" },
          ].map((ex) => (
            <Link
              key={ex.q}
              href={`/verify?q=${encodeURIComponent(ex.q)}`}
              className="min-h-9 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-xs text-[var(--text)] no-underline hover:border-[var(--accent)]/40"
            >
              {ex.label}
            </Link>
          ))}
        </div>
      </div>

      <p className="mt-5 text-xs leading-relaxed text-[var(--muted)]">
        Some thin business shells without a full board license are hidden from search by design.
        Missing Sunbiz on a result only means no high-confidence link — not “no business filing.”
      </p>
    </div>
  );
}

function TexasEmptyResults({ query, mode }: { query: string; mode: "license" | "name" }) {
  const prepared = prepareNameSearch(query);
  const strippedDiffers =
    prepared.stripped.length >= 2 &&
    prepared.stripped.toLowerCase() !== query.trim().toLowerCase();
  const trades = TX_COVERED_TRADES_PLAIN.join(", ");

  return (
    <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--panel)]/50 px-4 py-6 sm:px-8 sm:py-9">
      <p className="text-base font-medium leading-snug text-[var(--text)]">
        No Texas specialty or plumbing licenses matched &ldquo;{query}&rdquo;
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
        {mode === "license"
          ? "We searched TDLR specialty numbers and TSBPE plumbing numbers in our extract. A miss does not mean the person is unlicensed — they may hold a different credential or only a local registration."
          : "We searched business and owner names on selected TDLR specialty licenses and TSBPE plumbing credentials. General builders are outside this search by design."}
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/80 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            This search includes
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--text)]">{trades}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/80 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Usually not here
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--text)]">
            Statewide general contractors (Texas has no statewide GC license) and most
            city/county-only builders
          </p>
        </div>
      </div>

      <ul className="mt-5 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[var(--muted)]">
        {mode === "license" ? (
          <>
            <li>Try the numeric TDLR license number alone (e.g. 10001).</li>
            <li>Double-check digits; keys like TX-TDLR:… also work when you have the full id.</li>
            <li>If you only have a company name, switch to a short distinctive name search.</li>
          </>
        ) : (
          <>
            {strippedDiffers ? (
              <li>
                Try without legal endings:{" "}
                <Link
                  href={`/verify?state=tx&q=${encodeURIComponent(prepared.stripped)}`}
                  className="text-[var(--accent)]"
                >
                  {prepared.stripped}
                </Link>
              </li>
            ) : null}
            <li>Use fewer distinctive words from the business or owner name.</li>
            <li>Prefer a TDLR license number when you have one — it is more precise.</li>
            <li>We match official TDLR open-data names, not marketing nicknames.</li>
          </>
        )}
      </ul>

      <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
        <Link
          href="/verify?state=tx"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-medium text-[var(--text)] no-underline hover:bg-[var(--bg-elevated)]"
        >
          Clear search & try again
        </Link>
        <Link
          href="/verify"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--navy)] no-underline"
        >
          Search Florida instead
        </Link>
        <a
          href="https://www.tdlr.texas.gov/LicenseSearch/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-medium text-[var(--text)] no-underline hover:bg-[var(--bg-elevated)]"
        >
          Official TDLR search
        </a>
        <a
          href="https://tsbpe.texas.gov/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-medium text-[var(--text)] no-underline hover:bg-[var(--bg-elevated)]"
        >
          Official TSBPE (plumbing)
        </a>
      </div>

      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/80 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          Example specialty searches
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            { q: "10001", label: "License 10001" },
            { q: "air conditioning", label: "Air conditioning" },
            { q: "electrical", label: "Electrical" },
          ].map((ex) => (
            <Link
              key={ex.q}
              href={`/verify?state=tx&q=${encodeURIComponent(ex.q)}`}
              className="min-h-9 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-xs text-[var(--text)] no-underline hover:border-[var(--accent)]/40"
            >
              {ex.label}
            </Link>
          ))}
        </div>
      </div>

      <p className="mt-5 text-xs leading-relaxed text-[var(--muted)]">
        Evidence only — not a directory of all Texas contractors, and not a substitute for checking
        local permitting or registration requirements.
      </p>
    </div>
  );
}
