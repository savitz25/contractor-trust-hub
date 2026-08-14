import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { CONTRACTOR_NETWORK_LINKS } from "@/lib/network/network-links";
import { getLiveVerifyNavLinks } from "@/lib/states/config";

const planLinks = [
  { href: "/plan", label: "Plan a project" },
  { href: "/studios", label: "Project Studios" },
  { href: "/studio/kitchen", label: "Kitchen calculator" },
  { href: "/studio/bathroom", label: "Bathroom calculator" },
  { href: "/tools/scope-builder", label: "Scope Builder" },
  { href: "/property", label: "Check my address" },
  { href: "/tools/permit-planner", label: "Permit planner" },
] as const;

const decideLinks = [
  { href: "/tools/quote-analyzer", label: "Quote Analyzer" },
  { href: "/tools/compare-bids", label: "Compare bids" },
  { href: "/tools/pre-hire-checklist", label: "Pre-hire checklist" },
  { href: "/tools", label: "All decision tools" },
] as const;

const protectLinks = [
  { href: "/tools/contract-analyzer", label: "Contract Analyzer" },
  { href: "/projects", label: "Projects" },
  { href: "/passport", label: "Home Passport" },
  { href: "/account", label: "Account & alerts" },
] as const;

export function SiteFooter() {
  const verifyLinks = getLiveVerifyNavLinks();
  const researchLinks = [
    ...verifyLinks,
    { href: "/florida", label: "Browse Florida" },
    { href: "/guides", label: "Homeowner guides" },
    { href: "/tools/coverage", label: "Permit coverage" },
    { href: "/methodology", label: "Trust standards" },
    { href: "/independence", label: "Independence" },
  ];

  const columns = [
    { title: "Research", links: researchLinks },
    { title: "Plan", links: planLinks },
    { title: "Decide", links: decideLinks },
    { title: "Protect & records", links: protectLinks },
  ];

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
    </footer>
  );
}
