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
    <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--panel)]/50 px-5 py-9 sm:px-8">
      <p className="text-base font-medium text-[var(--text)]">
        No licensed Florida contractors matched &ldquo;{query}&rdquo;
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
        {mode === "license"
          ? "We looked for that license id in Florida DBPR construction records."
          : "We searched board display names, legal names, and DBAs (legal suffixes like LLC / Inc are ignored when matching)."}
      </p>

      <ul className="mt-5 space-y-2.5 text-sm leading-relaxed text-[var(--muted)]">
        {mode === "license" ? (
          <>
            <li>
              Use the full alternate license id when possible (e.g.{" "}
              <Link href="/verify?q=CBC015082" className="text-[var(--accent)]">
                CBC015082
              </Link>
              ). Spaces and dashes are OK.
            </li>
            <li>If you only have a company name, search by name instead of a partial number.</li>
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
            <li>Use fewer distinctive words from the legal or DBA name (drop LLC, Inc, Company).</li>
            <li>Check spelling — we match official board extracts, not marketing or “doing business as” nicknames that never appear on the license.</li>
            <li>
              Prefer a license number when you have one — most precise. Example:{" "}
              <Link href="/verify?q=CBC015082" className="text-[var(--accent)]">
                CBC015082
              </Link>
            </li>
          </>
        )}
      </ul>

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
              className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-xs text-[var(--text)] no-underline hover:border-[var(--accent)]/40"
            >
              {ex.label}
            </Link>
          ))}
        </div>
      </div>

      <p className="mt-5 text-xs leading-relaxed text-[var(--muted)]">
        Thin “qualifying business” shells without a full license board record are hidden from
        consumer search by design. Entity links stay high-confidence only — missing Sunbiz on a
        result is not the same as “no business filing.”
      </p>
    </div>
  );
}
