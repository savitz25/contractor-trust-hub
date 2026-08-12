import Link from "next/link";
import { prepareNameSearch } from "@/lib/contractors/search-normalize";

type Props = {
  query: string;
  mode: "license" | "name";
};

export function EmptyResults({ query, mode }: Props) {
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
