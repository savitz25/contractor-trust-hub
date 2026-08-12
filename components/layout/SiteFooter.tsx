import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[var(--border)] bg-[var(--bg-elevated)]">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <BrandLogo height={32} surface="onLight" />
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
            Before you hire, verify. Independent research using official public records — not a
            marketplace, not paid rankings, not a lead board.
          </p>
          <p className="mt-3 text-xs text-[var(--muted)]">
            Part of the{" "}
            <a
              href="https://www.asktrusthub.com"
              className="font-medium text-[var(--navy)] underline-offset-2 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Ask Trust Hub
            </a>{" "}
            network.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Product
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/verify" className="text-[var(--text)] no-underline hover:underline">
                Verify a contractor
              </Link>
            </li>
            <li>
              <Link href="/florida" className="text-[var(--text)] no-underline hover:underline">
                Browse Florida
              </Link>
            </li>
            <li>
              <Link href="/about" className="text-[var(--text)] no-underline hover:underline">
                How it works
              </Link>
            </li>
            <li>
              <Link href="/methodology" className="text-[var(--text)] no-underline hover:underline">
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
              <Link href="/independence" className="text-[var(--text)] no-underline hover:underline">
                Independence
              </Link>
            </li>
            <li>
              <Link href="/corrections" className="text-[var(--text)] no-underline hover:underline">
                Request a correction
              </Link>
            </li>
            <li>
              <Link href="/disclaimer" className="text-[var(--text)] no-underline hover:underline">
                Disclaimer
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Network &amp; sources
          </p>
          <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
            <li>
              <a href="https://www.asktrusthub.com" target="_blank" rel="noreferrer">
                Ask Trust Hub
              </a>
            </li>
            <li>
              <a href="https://www.movetrusthub.com" target="_blank" rel="noreferrer">
                Move Trust Hub
              </a>
            </li>
            <li>
              <a href="https://www.lendertrusthub.com" target="_blank" rel="noreferrer">
                Lender Trust Hub
              </a>
            </li>
            <li>
              <a href="https://www.insurancetrusthub.com" target="_blank" rel="noreferrer">
                Insurance Trust Hub
              </a>
            </li>
            <li className="pt-1">
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
      <div className="border-t border-[var(--border)] bg-[var(--bg)] px-4 py-5 text-xs leading-relaxed text-[var(--muted)] sm:px-6">
        <p className="mx-auto max-w-6xl">
          <strong className="font-medium text-[var(--text)]">Educational research only.</strong>{" "}
          Information is derived from public records and may lag live government systems. We are not
          a consumer reporting agency, not a licensing authority, and do not sell leads or paid
          rankings. Always confirm license status and other critical details on the official board
          before hiring. Public records remain property of the issuing government body.{" "}
          <Link href="/disclaimer" className="font-medium text-[var(--navy)]">
            Full disclaimer
          </Link>
          {" · "}
          <Link href="/independence" className="font-medium text-[var(--navy)]">
            How we make money
          </Link>
          {" · "}
          <Link href="/corrections" className="font-medium text-[var(--navy)]">
            Corrections
          </Link>
        </p>
      </div>
    </footer>
  );
}
