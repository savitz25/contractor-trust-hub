import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[var(--border)] bg-[var(--bg-elevated)]">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
        <div>
          <p className="text-sm font-semibold text-[var(--text)]">Contractor Trust Hub</p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            Before you hire, verify. Independent research tooling using official public
            records — not a marketplace, not paid rankings.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Product
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/verify" className="text-[var(--text)]">
                Verify a Florida contractor
              </Link>
            </li>
            <li>
              <Link href="/florida" className="text-[var(--text)]">
                Browse Florida by county & trade
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
            Sources
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
      <div className="border-t border-[var(--border)] px-4 py-4 text-center text-xs text-[var(--muted)] sm:px-6">
        Educational research only. Always confirm current status on the official licensing
        board before hiring. Public records remain property of the issuing government body.
      </div>
    </footer>
  );
}
