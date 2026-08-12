import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[var(--border)] bg-[var(--bg-elevated)]">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4 sm:px-6">
        <div className="sm:col-span-2 lg:col-span-1">
          <p className="text-sm font-semibold text-[var(--text)]">Contractor Trust Hub</p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            Before you hire, verify. Independent research using official public records — not a
            marketplace, not paid rankings, not a lead board.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Product
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/verify" className="text-[var(--text)]">
                Verify a contractor
              </Link>
            </li>
            <li>
              <Link href="/florida" className="text-[var(--text)]">
                Browse Florida
              </Link>
            </li>
            <li>
              <Link href="/about" className="text-[var(--text)]">
                How it works
              </Link>
            </li>
            <li>
              <Link href="/methodology" className="text-[var(--text)]">
                Methodology
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Trust &amp; legal
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/independence" className="text-[var(--text)]">
                Independence
              </Link>
            </li>
            <li>
              <Link href="/corrections" className="text-[var(--text)]">
                Request a correction
              </Link>
            </li>
            <li>
              <Link href="/disclaimer" className="text-[var(--text)]">
                Disclaimer
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Official sources
          </p>
          <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
            <li>
              <a
                href="https://www2.myfloridalicense.com/construction-industry/"
                target="_blank"
                rel="noreferrer"
              >
                Florida DBPR Construction
              </a>
            </li>
            <li>
              <a href="https://dos.fl.gov/sunbiz/" target="_blank" rel="noreferrer">
                Florida Sunbiz
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[var(--border)] px-4 py-5 text-xs leading-relaxed text-[var(--muted)] sm:px-6">
        <p className="mx-auto max-w-6xl">
          <strong className="font-medium text-[var(--text)]/90">Educational research only.</strong>{" "}
          Information is derived from public records and may lag live government systems. We are not
          a consumer reporting agency, not a licensing authority, and do not sell leads or paid
          rankings. Always confirm license status and other critical details on the official board
          before hiring. Public records remain property of the issuing government body.{" "}
          <Link href="/disclaimer" className="text-[var(--accent)]">
            Full disclaimer
          </Link>
          {" · "}
          <Link href="/independence" className="text-[var(--accent)]">
            How we make money
          </Link>
          {" · "}
          <Link href="/corrections" className="text-[var(--accent)]">
            Corrections
          </Link>
        </p>
      </div>
    </footer>
  );
}
