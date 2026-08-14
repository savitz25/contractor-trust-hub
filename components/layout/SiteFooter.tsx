import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { CONTRACTOR_NETWORK_LINKS } from "@/lib/network/network-links";

const columns = [
  {
    title: "Research",
    links: [
      { href: "/verify", label: "Verify a contractor (Florida)" },
      { href: "/verify?state=tx", label: "Texas specialty verify (TDLR)" },
      { href: "/verify?state=or", label: "Oregon CCB verify" },
      { href: "/verify?state=wa", label: "Washington L&I verify" },
      { href: "/verify?state=az", label: "Arizona ROC verify" },
      { href: "/verify?state=la", label: "Louisiana LSLBC verify" },
      { href: "/verify?state=ms", label: "Mississippi MSBOC verify" },
      { href: "/florida", label: "Browse Florida" },
      { href: "/arizona", label: "Explore Arizona" },
      { href: "/oregon", label: "Explore Oregon" },
      { href: "/washington", label: "Explore Washington" },
      { href: "/guides", label: "Homeowner guides" },
      { href: "/tools/coverage", label: "Permit coverage" },
      { href: "/methodology", label: "Trust standards" },
      { href: "/independence", label: "Independence" },
    ],
  },
  {
    title: "Plan",
    links: [
      { href: "/plan", label: "Plan a project" },
      { href: "/studios", label: "Project Studios" },
      { href: "/studio/kitchen", label: "Kitchen calculator" },
      { href: "/studio/bathroom", label: "Bathroom calculator" },
      { href: "/tools/scope-builder", label: "Scope Builder" },
      { href: "/property", label: "Check my address" },
      { href: "/tools/permit-planner", label: "Permit planner" },
    ],
  },
  {
    title: "Decide",
    links: [
      { href: "/tools/quote-analyzer", label: "Quote Analyzer" },
      { href: "/tools/compare-bids", label: "Compare bids" },
      { href: "/tools/pre-hire-checklist", label: "Pre-hire checklist" },
      { href: "/tools", label: "All decision tools" },
    ],
  },
  {
    title: "Protect & records",
    links: [
      { href: "/tools/contract-analyzer", label: "Contract Analyzer" },
      { href: "/projects", label: "Projects" },
      { href: "/passport", label: "Home Passport" },
      { href: "/account", label: "Account & alerts" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[var(--border)] bg-[var(--bg-elevated)]">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-6">
          <div className="sm:col-span-2 lg:col-span-2">
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
            <ul className="mt-4 space-y-1.5 text-xs text-[var(--muted)]">
              <li>
                <Link href="/disclaimer" className="hover:underline">
                  Disclaimer
                </Link>
                {" · "}
                <Link href="/corrections" className="hover:underline">
                  Corrections
                </Link>
                {" · "}
                <Link href="/about" className="hover:underline">
                  About
                </Link>
              </li>
              <li>
                <a
                  href="https://www2.myfloridalicense.com/construction-industry/"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  Florida DBPR Construction
                </a>
              </li>
              <li>
                <a
                  href="https://dos.fl.gov/sunbiz/"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  Florida Sunbiz
                </a>
              </li>
            </ul>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                {col.title}
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {col.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link
                      href={l.href}
                      className="text-[var(--text)] no-underline hover:underline"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 border-t border-[var(--border)] pt-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Our network
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--muted)]">
            {CONTRACTOR_NETWORK_LINKS.map((hub) => (
              <li key={hub.id}>
                <a
                  href={hub.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--text)] no-underline hover:underline"
                >
                  {hub.label}
                </a>
              </li>
            ))}
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
